require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// A brand-new client per auth call, never reused across requests. The
// shared client in db/db.js is a long-lived singleton (fine for plain
// data queries), but supabase-js keeps auth state (the "current user")
// in memory on the client instance — sharing one client for
// signInWithPassword() across concurrent requests risks one request's
// login state bleeding into another's. Auth operations are infrequent
// (signup/login only), so the cost of a fresh client each time is
// negligible.
function freshAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { freshAuthClient };
