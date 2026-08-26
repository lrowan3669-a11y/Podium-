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

// ---------- attendance (AM/PM) ----------

const ATTENDANCE_STATUSES = ['present', 'late', 'authorised_absent', 'unauthorised_absent'];

router.get('/attendance/:pupilId', route(async (req, res) => {
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });
  const rows = must(
    await supabase.from('attendance_entries').select('*').eq('pupil_id', req.params.pupilId).order('entry_date', { ascending: false })
  );
  res.json(rows);
}));

router.post('/attendance/:pupilId', route(async (req, res) => {
  if (!canRecord(req.profile)) return res.status(403).json({ error: 'only staff can record attendance' });
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const { entry_date, session, status } = req.body || {};
  if (!entry_date) return res.status(400).json({ error: 'entry_date is required' });
  if (!['am', 'pm'].includes(session)) return res.status(400).json({ error: "session must be 'am' or 'pm'" });
  if (!ATTENDANCE_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${ATTENDANCE_STATUSES.join(', ')}` });

  // One mark per pupil/day/session — recording again just corrects it.
  const existing = must(
    await supabase
      .from('attendance_entries')
      .select('id')
      .eq('pupil_id', req.params.pupilId)
      .eq('entry_date', entry_date)
      .eq('session', session)
      .maybeSingle()
  );
  if (existing) {
    must(await supabase.from('attendance_entries').update({ status, recorded_by: req.profile.id, recorded_at: new Date().toISOString() }).eq('id', existing.id));
    return res.json({ ok: true, id: existing.id });
  }
  const row = must(
    await supabase.from('attendance_entries').insert({ pupil_id: req.params.pupilId, entry_date, session, status, recorded_by: req.profile.id }).select('*').single()
  );
  res.status(201).json(row);
}));

// ---------- qualifications ----------

router.get('/qualifications/:pupilId', route(async (req, res) => {
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });
  const rows = must(
    await supabase.from('qualifications').select('*').eq('pupil_id', req.params.pupilId).order('updated_at', { ascending: false })
  );
  res.json(rows);
}));

router.post('/qualifications/:pupilId', route(async (req, res) => {
  if (!canRecord(req.profile)) return res.status(403).json({ error: 'only staff can record qualifications' });
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const { title, percent } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return res.status(400).json({ error: 'percent must be an integer 0-100' });

  const row = must(
    await supabase
      .from('qualifications')
      .insert({ pupil_id: req.params.pupilId, title: title.trim(), percent, recorded_by: req.profile.id })
      .select('*')
      .single()
  );
  res.status(201).json(row);
}));

router.put('/qualifications/:pupilId/:qualId', route(async (req, res) => {
  if (!canRecord(req.profile)) return res.status(403).json({ error: 'only staff can update qualifications' });
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const { percent } = req.body || {};
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return res.status(400).json({ error: 'percent must be an integer 0-100' });

  must(
    await supabase
      .from('qualifications')
      .update({ percent, recorded_by: req.profile.id, updated_at: new Date().toISOString() })
      .eq('id', req.params.qualId)
      .eq('pupil_id', req.params.pupilId)
  );
  res.json({ ok: true });
}));

// ---------- feedback ----------

router.get('/feedback/:pupilId', route(async (req, res) => {
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });
  const rows = must(
    await supabase.from('feedback_entries').select('*').eq('pupil_id', req.params.pupilId).order('created_at', { ascending: false })
  );
  const authorIds = [...new Set(rows.map((r) => r.author_id))];
  const authors = authorIds.length ? must(await supabase.from('profiles').select('id, full_name').in('id', authorIds)) : [];
  const nameById = Object.fromEntries(authors.map((a) => [a.id, a.full_name]));
  res.json(rows.map((r) => ({ ...r, author_name: nameById[r.author_id] || 'Staff' })));
}));

router.post('/feedback/:pupilId', route(async (req, res) => {
  if (!canRecord(req.profile)) return res.status(403).json({ error: 'only staff can leave feedback' });
  if (!(await canAccessPupil(req.profile, req.params.pupilId))) return res.status(403).json({ error: 'forbidden' });

  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });

  const row = must(
    await supabase.from('feedback_entries').insert({ pupil_id: req.params.pupilId, author_id: req.profile.id, body: body.trim() }).select('*').single()
  );
  res.status(201).json({ ...row, author_name: req.profile.full_name });
}));

module.exports = router;
