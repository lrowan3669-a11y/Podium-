const express = require('express');
const multer = require('multer');
const supabase = require('../db/db');
const { CLASS_ASSETS_BUCKET } = require('../lib/storage');
const { requireApproved, requireRole } = require('../middleware/auth');
const { accessibleClassIds } = require('../lib/authorization');
const { must } = require('../lib/dbHelpers');

const router = express.Router();

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) return cb(new Error('only jpeg, png or webp images are allowed'));
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

function photoUrl(photoPath) {
  if (!photoPath) return null;
  return supabase.storage.from(CLASS_ASSETS_BUCKET).getPublicUrl(photoPath).data.publicUrl;
}

function classRow(c) {
  return {
    id: c.id,
    name: c.name,
    namesake: c.namesake,
    sportTheme: c.sport_theme,
    unitLabel: c.unit_label,
    colourHex: c.colour_hex,
    awardFlourish: c.award_flourish,
    photoUrl: photoUrl(c.photo_path),
  };
}

// A small, hand-picked palette so classes stay visually distinct even when
// nobody bothers to choose a colour — same "restrained accents" spirit as
// the app's own UI chrome, just with more room to spread across many classes.
const PALETTE = [
  '#E24B4A', '#1BAF7A', '#378ADD', '#EDA100', '#4A3AA7',
  '#9b5cf6', '#29d9cb', '#ff6b4a', '#c6ea3d', '#e85d9c',
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

async function pickColour(requested) {
  if (requested && HEX_RE.test(requested)) return requested;
  const existing = must(await supabase.from('classes').select('id'));
  return PALETTE[existing.length % PALETTE.length];
}

async function uniqueId(name) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'class';
  let id = base;
  let suffix = 1;
  // classes.id is a hand-chosen text primary key, not a generated sequence —
  // small tables at this app's scale, so a linear existence check is fine.
  while (must(await supabase.from('classes').select('id').eq('id', id).maybeSingle())) {
    suffix += 1;
    id = `${base}_${suffix}`;
  }
  return id;
}

// Public: non-sensitive reference data, and the signup form needs it before
// an account exists to be "approved".
router.get('/', route(async (req, res) => {
  const rows = must(await supabase.from('classes').select('*').order('name'));
  res.json(rows.map(classRow));
}));

// Any teacher or admin can create a class — creating it auto-links the
// teacher to it (teacher_class_links), same as if an admin had approved
// them into it.
router.post('/', requireApproved, requireRole('teacher', 'admin'), route(async (req, res) => {
  const { name, colour_hex } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const id = await uniqueId(name);
  const colour = await pickColour(colour_hex);
  must(
    await supabase.from('classes').insert({
      id,
      name: name.trim(),
      colour_hex: colour,
      award_flourish: `+{points} points for ${name.trim()}!`,
      created_by: req.profile.id,
    })
  );
  if (req.profile.role === 'teacher') {
    must(await supabase.from('teacher_class_links').insert({ teacher_profile_id: req.profile.id, class_id: id }));
  }
  res.status(201).json(classRow({ id, name: name.trim(), colour_hex: colour, award_flourish: `+{points} points for ${name.trim()}!` }));
}));

router.post('/:id/photo', requireApproved, requireRole('teacher', 'admin'), upload.single('photo'), route(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field name must be "photo")' });
  const cls = must(await supabase.from('classes').select('id').eq('id', req.params.id).maybeSingle());
  if (!cls) return res.status(404).json({ error: 'class not found' });

  if (req.profile.role === 'teacher') {
    const classIds = await accessibleClassIds(req.profile);
    if (!classIds.includes(req.params.id)) return res.status(403).json({ error: 'not your class' });
  }

  const objectPath = `${req.params.id}.${EXT_BY_MIME[req.file.mimetype]}`;
  const { error: upErr } = await supabase.storage.from(CLASS_ASSETS_BUCKET).upload(objectPath, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);
  must(await supabase.from('classes').update({ photo_path: objectPath }).eq('id', req.params.id));
  res.json({ ok: true, photoUrl: photoUrl(objectPath) });
}));

module.exports = router;
