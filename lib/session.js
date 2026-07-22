const crypto = require('crypto');
const supabase = require('../db/db');

const SESSION_COOKIE = 'podium_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(profileId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { error } = await supabase
    .from('sessions')
    .insert({ profile_id: profileId, token_hash: hashToken(token), expires_at: expiresAt.toISOString() });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

async function getProfileForToken(token) {
  if (!token) return null;
  const { data: session } = await supabase
    .from('sessions')
    .select('profile_id, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.profile_id).maybeSingle();
  return profile || null;
}

async function destroySession(token) {
  if (!token) return;
  await supabase.from('sessions').delete().eq('token_hash', hashToken(token));
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

module.exports = {
  SESSION_COOKIE,
  createSession,
  getProfileForToken,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
};
