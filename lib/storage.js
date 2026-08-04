const supabase = require('../db/db');

const AVATAR_BUCKET = 'avatars';
const SCHOOL_ASSETS_BUCKET = 'school-assets';

async function ensureBucket(name, options) {
  try {
    const { data } = await supabase.storage.getBucket(name);
    if (data) return;
  } catch (err) {
    // fall through to create
  }
  const { error } = await supabase.storage.createBucket(name, options);
  if (error && !/already exists/i.test(error.message)) {
    console.warn(`Could not ensure '${name}' storage bucket exists: ${error.message}`);
  }
}

// Idempotent: called once at server startup so a fresh Supabase project
// works without a manual "create the bucket" step in the dashboard. Both
// buckets are also created by db/schema.sql directly, so this is a backstop.
async function ensureAvatarBucket() {
  await ensureBucket(AVATAR_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
}

// Public: the school logo needs to render on the pre-login gate screen, so
// there's no access check to gate it behind — nothing sensitive lives here.
async function ensureSchoolAssetsBucket() {
  await ensureBucket(SCHOOL_ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  });
}

module.exports = { AVATAR_BUCKET, SCHOOL_ASSETS_BUCKET, ensureAvatarBucket, ensureSchoolAssetsBucket };
