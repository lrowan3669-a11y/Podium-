const express = require('express');
const multer = require('multer');
const supabase = require('../db/db');
const { SCHOOL_ASSETS_BUCKET } = require('../lib/storage');
const { requireApproved, requireRole } = require('../middleware/auth');
const { must } = require('../lib/dbHelpers');

const router = express.Router();

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) return cb(new Error('only jpeg, png, webp or svg images are allowed'));
    cb(null, true);
  },
});

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

function logoUrl(logoPath) {
  if (!logoPath) return null;
  return supabase.storage.from(SCHOOL_ASSETS_BUCKET).getPublicUrl(logoPath).data.publicUrl;
}

// Public: the gate/login screens need this before anyone is signed in.
router.get('/', route(async (req, res) => {
  const school = must(await supabase.from('school_settings').select('*').eq('id', true).single());
  res.json({ name: school.name, logoUrl: logoUrl(school.logo_path) });
}));

router.put('/', requireApproved, requireRole('admin'), route(async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  must(await supabase.from('school_settings').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', true));
  res.json({ ok: true });
}));

router.post('/logo', requireApproved, requireRole('admin'), upload.single('logo'), route(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field name must be "logo")' });
  const path = `logo.${EXT_BY_MIME[req.file.mimetype]}`;
  const { error: upErr } = await supabase.storage.from(SCHOOL_ASSETS_BUCKET).upload(path, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);
  must(await supabase.from('school_settings').update({ logo_path: path, updated_at: new Date().toISOString() }).eq('id', true));
  res.json({ ok: true, logoUrl: logoUrl(path) });
}));

module.exports = router;
