const { SESSION_COOKIE, getProfileForToken } = require('../lib/session');

// Runs on every request: attaches req.profile (or null) so downstream
// handlers/routes can make their own decision about what's required.
function attachProfile() {
  return async (req, res, next) => {
    try {
      const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
      req.profile = token ? await getProfileForToken(token) : null;
    } catch (err) {
      req.profile = null;
    }
    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.profile) return res.status(401).json({ error: 'not signed in' });
  next();
}

function requireApproved(req, res, next) {
  if (!req.profile) return res.status(401).json({ error: 'not signed in' });
  if (req.profile.approval_status !== 'approved') {
    return res.status(403).json({ error: 'account pending approval', pending: req.profile.approval_status === 'pending' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) return res.status(401).json({ error: 'not signed in' });
    if (!roles.includes(req.profile.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

module.exports = { attachProfile, requireAuth, requireApproved, requireRole };
