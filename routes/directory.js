const express = require('express');
const supabase = require('../db/db');
const { requireApproved, requireRole } = require('../middleware/auth');
const { accessibleClassIds } = require('../lib/authorization');
const { must } = require('../lib/dbHelpers');

const router = express.Router();
router.use(requireApproved, requireRole('teacher', 'admin'));

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

// Pupils with no class yet — visible to every teacher (not just those
// linked to a class) until someone claims them. Once claimed, normal
// class-scoped visibility (lib/authorization.js) takes over.
router.get('/', route(async (req, res) => {
  const rows = must(await supabase.from('pupils').select('id, name, created_at').eq('active', true).is('class_id', null).order('name'));
  res.json(rows);
}));

router.post('/claim/:pupilId', route(async (req, res) => {
  const { class_id } = req.body || {};
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  if (req.profile.role === 'teacher') {
    const classIds = await accessibleClassIds(req.profile);
    if (!classIds.includes(class_id)) return res.status(403).json({ error: 'you can only claim pupils into your own class' });
  } else {
    const cls = must(await supabase.from('classes').select('id').eq('id', class_id).maybeSingle());
    if (!cls) return res.status(400).json({ error: 'unknown class_id' });
  }

  const pupil = must(await supabase.from('pupils').select('id, class_id').eq('id', req.params.pupilId).maybeSingle());
  if (!pupil) return res.status(404).json({ error: 'pupil not found' });
  if (pupil.class_id) return res.status(409).json({ error: 'this pupil has already been claimed' });

  must(await supabase.from('pupils').update({ class_id }).eq('id', req.params.pupilId));
  res.json({ ok: true });
}));

module.exports = router;
