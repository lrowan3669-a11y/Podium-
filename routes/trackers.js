const express = require('express');
const supabase = require('../db/db');
const { requireApproved } = require('../middleware/auth');
const { canAccessPupil } = require('../lib/authorization');

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

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const ACADEMIC_SKILLS = {
  english: ['reading', 'writing', 'speaking', 'listening'],
  maths: ['adding', 'subtracting', 'multiplication', 'division'],
  other: ['science', 'history', 'geography', 'creative_arts'],
};

const PSD_CATEGORIES = [
  'attendance_and_learning',
  'respect_to_others',
  'positive_pathway',
  'making_friends',
  'arriving_on_time',
  'activities_outside_school',
];

function canRecord(profile) {
  return profile.role === 'teacher' || profile.role === 'admin';
}

// ---------- academic progress ----------

router.get('/academic/:pupilId', route(async (req, res) => {
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });
  const rows = must(
    await supabase.from('academic_progress').select('*').eq('pupil_id', req.params.pupilId).order('recorded_at', { ascending: false })
  );
  res.json(rows);
}));

router.post('/academic/:pupilId', route(async (req, res) => {
  if (!canRecord(req.profile)) return res.status(403).json({ error: 'only staff can record progress' });
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const { subject_area, skill, score, note } = req.body || {};
  const skills = ACADEMIC_SKILLS[subject_area];
  if (!skills) return res.status(400).json({ error: `subject_area must be one of: ${Object.keys(ACADEMIC_SKILLS).join(', ')}` });
  if (!skills.includes(skill)) return res.status(400).json({ error: `skill must be one of: ${skills.join(', ')}` });
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'score must be an integer 1-5' });

  const row = must(
    await supabase
      .from('academic_progress')
      .insert({
        pupil_id: req.params.pupilId,
        subject_area,
        skill,
        score,
        note: note || null,
        recorded_by: req.profile.id,
      })
      .select('*')
      .single()
  );
  res.status(201).json(row);
}));

// ---------- PSD tracker ----------

router.get('/psd/:pupilId', route(async (req, res) => {
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });
  const rows = must(
    await supabase.from('psd_entries').select('*').eq('pupil_id', req.params.pupilId).order('recorded_at', { ascending: false })
  );
  res.json(rows);
}));

router.post('/psd/:pupilId', route(async (req, res) => {
  if (!canRecord(req.profile)) return res.status(403).json({ error: 'only staff can record PSD entries' });
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const { category, score, note } = req.body || {};
  if (!PSD_CATEGORIES.includes(category)) return res.status(400).json({ error: `category must be one of: ${PSD_CATEGORIES.join(', ')}` });
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'score must be an integer 1-5' });

  const row = must(
    await supabase
      .from('psd_entries')
      .insert({
        pupil_id: req.params.pupilId,
        category,
        score,
        note: note || null,
        recorded_by: req.profile.id,
      })
      .select('*')
      .single()
  );
  res.status(201).json(row);
}));

module.exports = router;
