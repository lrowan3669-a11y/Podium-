const express = require('express');
const crypto = require('crypto');
const supabase = require('../db/db');
const { freshAuthClient } = require('../db/authClient');
const { requireApproved, requireRole } = require('../middleware/auth');
const { canAccessPupil } = require('../lib/authorization');
const { must } = require('../lib/dbHelpers');
const { createSession, setSessionCookie } = require('../lib/session');

const router = express.Router();

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days — plenty of time to actually send the link on

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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicProfile(p) {
  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role: p.role,
    approval_status: p.approval_status,
    pupil_id: p.pupil_id,
    avatar_path: p.avatar_path,
  };
}

async function findLiveInvite(token) {
  const invite = must(await supabase.from('pupil_invites').select('*').eq('token_hash', hashToken(token)).maybeSingle());
  if (!invite) return null;
  if (invite.used_at) return null;
  if (new Date(invite.expires_at) < new Date()) return null;
  return invite;
}

// A teacher/admin generates a one-time link for a specific pupil — the
// school sends it to the parent by whatever channel it already uses (email,
// text, WhatsApp). There's no email-sending in this app.
router.post('/invites/:pupilId', requireApproved, requireRole('teacher', 'admin'), route(async (req, res) => {
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  must(
    await supabase.from('pupil_invites').insert({
      pupil_id: req.params.pupilId,
      token_hash: hashToken(token),
      created_by: req.profile.id,
      expires_at: expiresAt.toISOString(),
    })
  );
  res.status(201).json({ token, expiresAt });
}));

// Public: the parent lands here from the shared link, before any account
// exists — just enough info to confirm whose parent they're signing up as.
router.get('/invite/:token', route(async (req, res) => {
  const invite = await findLiveInvite(req.params.token);
  if (!invite) return res.status(410).json({ error: 'This invite link has expired or already been used — ask staff for a new one.' });
  const pupil = must(await supabase.from('pupils').select('name').eq('id', invite.pupil_id).maybeSingle());
  if (!pupil) return res.status(404).json({ error: 'pupil not found' });
  res.json({ pupilName: pupil.name });
}));

// Public: claims the invite — creates the parent account, auto-approved and
// auto-linked (the invite itself, sent by staff to a specific pupil, is the
// authorization — no separate admin approval step needed), then signs them
// straight in.
router.post('/invite/:token', route(async (req, res) => {
  const invite = await findLiveInvite(req.params.token);
  if (!invite) return res.status(410).json({ error: 'This invite link has expired or already been used — ask staff for a new one.' });

  const { full_name, email, password } = req.body || {};
  if (!email || !password || !full_name) return res.status(400).json({ error: 'full_name, email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });

  const authClient = freshAuthClient();
  const { data: created, error: createErr } = await authClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr) return res.status(400).json({ error: createErr.message });

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: created.user.id,
    email,
    full_name: full_name.trim(),
    role: 'parent',
    approval_status: 'approved',
    signup_hint: { via: 'invite', pupil_id: invite.pupil_id },
  });
  if (profileErr) {
    await authClient.auth.admin.deleteUser(created.user.id);
    return res.status(500).json({ error: profileErr.message });
  }

  must(await supabase.from('parent_pupil_links').insert({ parent_profile_id: created.user.id, pupil_id: invite.pupil_id }));
  must(await supabase.from('pupil_invites').update({ used_at: new Date().toISOString(), used_by: created.user.id }).eq('id', invite.id));

  const profile = must(await supabase.from('profiles').select('*').eq('id', created.user.id).single());
  const { token: sessionToken, expiresAt } = await createSession(profile.id);
  setSessionCookie(res, sessionToken, expiresAt);
  res.status(201).json({ profile: publicProfile(profile) });
}));

module.exports = router;
