const express = require('express');
const supabase = require('../db/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };
}

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

router.get('/pending', route(async (req, res) => {
  const rows = must(
    await supabase.from('profiles').select('*').eq('approval_status', 'pending').order('created_at')
  );
  res.json(rows);
}));

router.get('/profiles', route(async (req, res) => {
  const rows = must(await supabase.from('profiles').select('*').order('created_at', { ascending: false }));
  res.json(rows);
}));

// Approves a pending account and performs the linking that grants it real
// access — this is the one moment a parent/teacher/pupil signup actually
// becomes able to see anyone's data, and it's an explicit admin action
// selecting real records, never something the signup form itself controls.
router.post('/approve/:profileId', route(async (req, res) => {
  const profile = must(await supabase.from('profiles').select('*').eq('id', req.params.profileId).maybeSingle());
  if (!profile) return res.status(404).json({ error: 'not found' });

  if (profile.role === 'pupil') {
    let pupilId = req.body.pupil_id;
    if (!pupilId) {
      const { new_pupil_name, class_id } = req.body || {};
      if (!new_pupil_name) {
        return res.status(400).json({ error: 'pupil_id, or new_pupil_name (optionally with class_id), is required' });
      }
      // class_id is optional: with none, the pupil lands unclaimed in the
      // staff directory until a teacher claims them into a class.
      const created = must(
        await supabase.from('pupils').insert({ name: new_pupil_name.trim(), class_id: class_id || null }).select('id').single()
      );
      pupilId = created.id;
    }
    must(await supabase.from('profiles').update({ approval_status: 'approved', pupil_id: pupilId }).eq('id', profile.id));
  } else if (profile.role === 'teacher') {
    const classIds = req.body.class_ids;
    if (!Array.isArray(classIds) || !classIds.length) {
      return res.status(400).json({ error: 'class_ids (non-empty array) is required for a teacher' });
    }
    must(
      await supabase.from('teacher_class_links').insert(classIds.map((class_id) => ({ teacher_profile_id: profile.id, class_id })))
    );
    must(await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', profile.id));
  } else if (profile.role === 'parent') {
    const pupilIds = req.body.pupil_ids;
    if (!Array.isArray(pupilIds) || !pupilIds.length) {
      return res.status(400).json({ error: 'pupil_ids (non-empty array) is required for a parent' });
    }
    must(
      await supabase.from('parent_pupil_links').insert(pupilIds.map((pupil_id) => ({ parent_profile_id: profile.id, pupil_id })))
    );
    must(await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', profile.id));
  } else {
    return res.status(400).json({ error: `cannot approve role ${profile.role} via this endpoint` });
  }

  res.json({ ok: true });
}));

router.post('/reject/:profileId', route(async (req, res) => {
  must(await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', req.params.profileId));
  res.json({ ok: true });
}));

module.exports = router;
