const supabase = require('../db/db');

const AVATAR_BUCKET = 'avatars';

// Idempotent: called once at server startup so a fresh Supabase project
// works without a manual "create the bucket" step in the dashboard. The
// bucket is also created by db/schema.sql directly, so this is a backstop.
async function ensureAvatarBucket() {
  try {
    const { data } = await supabase.storage.getBucket(AVATAR_BUCKET);
    if (data) return;
  } catch (err) {
    // fall through to create
  }
  const { error } = await supabase.storage.createBucket(AVATAR_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (error && !/already exists/i.test(error.message)) {
    console.warn(`Could not ensure '${AVATAR_BUCKET}' storage bucket exists: ${error.message}`);
  }
}

module.exports = { AVATAR_BUCKET, ensureAvatarBucket };
