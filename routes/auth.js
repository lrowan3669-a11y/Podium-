const express = require('express');
const supabase = require('../db/db');
const { freshAuthClient } = require('../db/authClient');
const { SESSION_COOKIE, createSession, destroySession, setSessionCookie, clearSessionCookie } = require('../lib/session');

const router = express.Router();

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

const SELF_SERVICE_ROLES = ['pupil', 'teacher', 'parent']; // admin accounts are promoted manually, never self-signup — see README

// Comma-separated allowlist (set in Vercel/​.env) so the very first admin —
// and any test admin accounts — can be created just by signing up, no SQL
// needed. Anyone signing up with a matching email is auto-approved as
// admin regardless of which role they picked in the form. Leave unset in
// a real rollout once the school's admins are all set up, so this stops
// being a live door.
const BOOTSTRAP_ADMIN_EMAILS = (process.env.ADMIN_BOOTSTRAP_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

router.post('/signup', route(async (req, res) => {
  const { email, password, full_name, role, hint } = req.body || {};
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email, password, full_name and role are required' });
  }
  if (!SELF_SERVICE_ROLES.includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(String(email).trim().toLowerCase());

  const authClient = freshAuthClient();
  const { data: created, error: createErr } = await authClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // approval by an admin is the real gate, not email verification
  });
  if (createErr) return res.status(400).json({ error: createErr.message });

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: created.user.id,
    email,
    full_name: full_name.trim(),
    role: isBootstrapAdmin ? 'admin' : role,
    approval_status: isBootstrapAdmin ? 'approved' : 'pending',
    signup_hint: hint || null,
  });
  if (profileErr) {
    await authClient.auth.admin.deleteUser(created.user.id); // don't leave an orphaned auth user behind
    return res.status(500).json({ error: profileErr.message });
  }

  res.status(201).json({
    ok: true,
    message: isBootstrapAdmin
      ? 'Admin account created — you can sign in right away.'
      : 'Account created. A school admin needs to approve it before you can sign in.',
  });
}));

router.post('/login', route(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const authClient = freshAuthClient();
  const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.user) return res.status(401).json({ error: 'invalid email or password' });

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', signIn.user.id).maybeSingle();
  if (!profile) return res.status(401).json({ error: 'no profile for this account — contact an admin' });
  if (profile.approval_status === 'rejected') {
    return res.status(403).json({ error: 'this account was not approved' });
  }
  if (profile.approval_status === 'pending') {
    return res.status(403).json({ error: 'pending approval', pending: true });
  }

  const { token, expiresAt } = await createSession(profile.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ profile: publicProfile(profile) });
}));

router.post('/logout', route(async (req, res) => {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  await destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

router.get('/me', route(async (req, res) => {
  if (!req.profile) return res.status(401).json({ error: 'not signed in' });
  res.json({ profile: publicProfile(req.profile) });
}));

module.exports = router;
