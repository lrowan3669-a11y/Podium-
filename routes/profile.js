const express = require('express');
const supabase = require('../db/db');
const { requireApproved } = require('../middleware/auth');
const { must } = require('../lib/dbHelpers');

const router = express.Router();
router.use(requireApproved);

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

function cleanList(input) {
  if (!Array.isArray(input)) return [];
  return input.map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
}

function cleanText(input, maxLen) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

function aboutMeShape(p) {
  return {
    likes: p.likes || [],
    dislikes: p.dislikes || [],
    bio: p.bio || null,
    fun_fact: p.fun_fact || null,
    favourites: p.favourites || [],
  };
}

// Every account's own "about me" — self-authored, shown on My Profile.
router.get('/me', route(async (req, res) => {
  const p = must(await supabase.from('profiles').select('likes, dislikes, bio, fun_fact, favourites').eq('id', req.profile.id).single());
  res.json(aboutMeShape(p));
}));

router.put('/me', route(async (req, res) => {
  const { likes, dislikes, bio, fun_fact, favourites } = req.body || {};
  must(
    await supabase
      .from('profiles')
      .update({
        likes: cleanList(likes),
        dislikes: cleanList(dislikes),
        favourites: cleanList(favourites),
        bio: cleanText(bio, 1000),
        fun_fact: cleanText(fun_fact, 300),
      })
      .eq('id', req.profile.id)
  );
  res.json({ ok: true });
}));

// Admin-only: view any staff/parent's profile — the same shape My Profile
// shows for yourself, so admin can click through from a class roster to
// its teacher without that being a general "look up anyone" feature.
router.get('/:profileId', route(async (req, res) => {
  if (req.profile.role !== 'admin') return res.status(403).json({ error: 'forbidden' });

  const p = must(await supabase.from('profiles').select('*').eq('id', req.params.profileId).maybeSingle());
  if (!p) return res.status(404).json({ error: 'not found' });

  let classes = [];
  let children = [];
  if (p.role === 'teacher') {
    const links = must(await supabase.from('teacher_class_links').select('class_id').eq('teacher_profile_id', p.id));
    classes = links.length ? must(await supabase.from('classes').select('id, name').in('id', links.map((l) => l.class_id))) : [];
  } else if (p.role === 'parent') {
    const links = must(await supabase.from('parent_pupil_links').select('pupil_id').eq('parent_profile_id', p.id));
    children = links.length ? must(await supabase.from('pupils').select('id, name').in('id', links.map((l) => l.pupil_id))) : [];
  }

  res.json({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    ...aboutMeShape(p),
    classes,
    children,
  });
}));

module.exports = router;
