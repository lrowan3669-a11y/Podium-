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

module.exports = router;
