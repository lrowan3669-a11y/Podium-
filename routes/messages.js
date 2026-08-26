const express = require('express');
const supabase = require('../db/db');
const { requireApproved } = require('../middleware/auth');
const { accessibleClassIds, canMessage } = require('../lib/authorization');
const { must } = require('../lib/dbHelpers');

const router = express.Router();
router.use(requireApproved);

function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  };
}

// Who this profile is allowed to message at all — teacher<->pupil and
// parent<->teacher within an actual class link, admin<->anyone. Used to
// populate "start a new conversation" rather than to gate sending (that's
// canMessage, checked independently on every read/write of a thread).
async function getContacts(profile) {
  const approved = (rows) => supabase.from('profiles').select('id, full_name, role').in('id', rows).eq('approval_status', 'approved');

  if (profile.role === 'admin') {
    return must(await supabase.from('profiles').select('id, full_name, role').eq('approval_status', 'approved').neq('id', profile.id));
  }

  const admins = must(await supabase.from('profiles').select('id, full_name, role').eq('role', 'admin').eq('approval_status', 'approved'));

  if (profile.role === 'teacher') {
    const classIds = await accessibleClassIds(profile);
    if (!classIds.length) return admins;
    const pupils = must(await supabase.from('pupils').select('id').in('class_id', classIds));
    const pupilIds = pupils.map((p) => p.id);
    const pupilProfiles = pupilIds.length
      ? must(await supabase.from('profiles').select('id, full_name, role').in('pupil_id', pupilIds).eq('approval_status', 'approved'))
      : [];
    const parentLinks = pupilIds.length ? must(await supabase.from('parent_pupil_links').select('parent_profile_id').in('pupil_id', pupilIds)) : [];
    const parentIds = [...new Set(parentLinks.map((l) => l.parent_profile_id))];
    const parentProfiles = parentIds.length ? must(await approved(parentIds)) : [];
    return [...pupilProfiles, ...parentProfiles, ...admins];
  }

  if (profile.role === 'pupil') {
    if (!profile.pupil_id) return admins;
    const pupil = must(await supabase.from('pupils').select('class_id').eq('id', profile.pupil_id).maybeSingle());
    if (!pupil || !pupil.class_id) return admins;
    const teacherLinks = must(await supabase.from('teacher_class_links').select('teacher_profile_id').eq('class_id', pupil.class_id));
    const teacherIds = [...new Set(teacherLinks.map((l) => l.teacher_profile_id))];
    const teacherProfiles = teacherIds.length ? must(await approved(teacherIds)) : [];
    return [...teacherProfiles, ...admins];
  }

  if (profile.role === 'parent') {
    const links = must(await supabase.from('parent_pupil_links').select('pupil_id').eq('parent_profile_id', profile.id));
    const pupilIds = links.map((l) => l.pupil_id);
    if (!pupilIds.length) return admins;
    const pupils = must(await supabase.from('pupils').select('class_id').in('id', pupilIds));
    const classIds = [...new Set(pupils.map((p) => p.class_id).filter(Boolean))];
    const teacherLinks = classIds.length ? must(await supabase.from('teacher_class_links').select('teacher_profile_id').in('class_id', classIds)) : [];
    const teacherIds = [...new Set(teacherLinks.map((l) => l.teacher_profile_id))];
    const teacherProfiles = teacherIds.length ? must(await approved(teacherIds)) : [];
    return [...teacherProfiles, ...admins];
  }

  return [];
}

router.get('/contacts', route(async (req, res) => {
  res.json(await getContacts(req.profile));
}));

// One row per contact who either has an existing thread or is an allowed
// new contact, sorted by most recent activity so it reads like a normal
// inbox rather than a bare directory.
router.get('/inbox', route(async (req, res) => {
  const contacts = await getContacts(req.profile);
  const messages = must(
    await supabase.from('messages').select('*').or(`sender_id.eq.${req.profile.id},recipient_id.eq.${req.profile.id}`).order('created_at', { ascending: false })
  );

  const rows = contacts.map((contact) => {
    const thread = messages.filter((m) => m.sender_id === contact.id || m.recipient_id === contact.id);
    const last = thread[0] || null;
    const unreadCount = thread.filter((m) => m.recipient_id === req.profile.id && m.sender_id === contact.id && !m.read_at).length;
    return { contact, lastMessage: last, unreadCount };
  });

  rows.sort((a, b) => {
    const at = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
    const bt = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
    return bt - at;
  });
  res.json(rows);
}));

router.get('/thread/:otherId', route(async (req, res) => {
  const other = must(await supabase.from('profiles').select('*').eq('id', req.params.otherId).maybeSingle());
  if (!other) return res.status(404).json({ error: 'not found' });
  if (!(await canMessage(req.profile, other))) return res.status(403).json({ error: 'forbidden' });

  const messages = must(
    await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${req.profile.id},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${req.profile.id})`)
      .order('created_at', { ascending: true })
  );

  const unread = messages.filter((m) => m.recipient_id === req.profile.id && !m.read_at);
  if (unread.length) {
    must(await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread.map((m) => m.id)));
    unread.forEach((m) => { m.read_at = new Date().toISOString(); });
  }

  res.json({ contact: { id: other.id, full_name: other.full_name, role: other.role }, messages });
}));

router.post('/thread/:otherId', route(async (req, res) => {
  const other = must(await supabase.from('profiles').select('*').eq('id', req.params.otherId).maybeSingle());
  if (!other) return res.status(404).json({ error: 'not found' });
  if (!(await canMessage(req.profile, other))) return res.status(403).json({ error: 'forbidden' });

  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });

  const row = must(
    await supabase.from('messages').insert({ sender_id: req.profile.id, recipient_id: other.id, body: body.trim() }).select('*').single()
  );
  res.status(201).json(row);
}));

module.exports = router;
