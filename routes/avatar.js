const express = require('express');
const multer = require('multer');
const supabase = require('../db/db');
const { AVATAR_BUCKET } = require('../lib/storage');
const { requireApproved } = require('../middleware/auth');
const { canAccessPupil } = require('../lib/authorization');

const router = express.Router();

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) {
      return cb(new Error('only jpeg, png or webp images are allowed'));
    }
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

async function uploadAvatarFor(profileId, file) {
  const path = `${profileId}.${EXT_BY_MIME[file.mimetype]}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { error: updErr } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profileId);
  if (updErr) throw new Error(updErr.message);
  return path;
}

// Upload your own photo.
router.post('/me', requireApproved, upload.single('avatar'), route(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field name must be "avatar")' });
  const path = await uploadAvatarFor(req.profile.id, req.file);
  res.json({ ok: true, avatar_path: path });
}));

// Admin uploading on someone else's behalf (e.g. helping a pupil who needs it).
router.post('/:profileId', requireApproved, upload.single('avatar'), route(async (req, res) => {
  if (req.profile.role !== 'admin') {
    return res.status(403).json({ error: "only an admin can upload on someone else's behalf" });
  }
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field name must be "avatar")' });
  const path = await uploadAvatarFor(req.params.profileId, req.file);
  res.json({ ok: true, avatar_path: path });
}));

// Serves the actual image bytes — never a public/signed URL, always mediated
// by this authorization check first, so nothing about a pupil's photo is
// ever reachable without going through our own access control.
router.get('/:profileId', requireApproved, route(async (req, res) => {
  const { data: target } = await supabase.from('profiles').select('*').eq('id', req.params.profileId).maybeSingle();
  if (!target || !target.avatar_path) return res.status(404).json({ error: 'no avatar' });

  let allowed = req.profile.role === 'admin' || req.profile.id === target.id;
  if (!allowed && target.role === 'pupil' && target.pupil_id) {
    allowed = await canAccessPupil(req.profile, target.pupil_id);
  }
  if (!allowed) return res.status(403).json({ error: 'forbidden' });

  const { data: blob, error } = await supabase.storage.from(AVATAR_BUCKET).download(target.avatar_path);
  if (error) return res.status(404).json({ error: 'avatar not found' });
  const buffer = Buffer.from(await blob.arrayBuffer());
  const ext = target.avatar_path.split('.').pop();
  res.set('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
  res.set('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}));

module.exports = router;
