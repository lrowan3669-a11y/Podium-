const express = require('express');
const supabase = require('../db/db');
const { requireApproved } = require('../middleware/auth');
const { canAccessPupil, accessibleClassIds } = require('../lib/authorization');

const router = express.Router();
router.use(requireApproved);

function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };
}

function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function pupilSummary(pupilId) {
  const pupil = must(await supabase.from('pupils').select('*, classes(name, colour_hex)').eq('id', pupilId).maybeSingle());
  if (!pupil) return null;
  const awards = must(await supabase.from('awards').select('points').eq('pupil_id', pupilId));
  const linkedProfile = must(await supabase.from('profiles').select('id').eq('pupil_id', pupilId).maybeSingle());
  return {
    id: pupil.id,
    name: pupil.name,
    class_id: pupil.class_id,
    class_name: pupil.classes.name,
    colour_hex: pupil.classes.colour_hex,
    season_points: awards.reduce((sum, a) => sum + a.points, 0),
    profile_id: linkedProfile ? linkedProfile.id : null,
  };
}

// A single "what should I see when I land on my dashboard" endpoint —
// shape depends entirely on the caller's role.
router.get('/me', route(async (req, res) => {
  const profile = req.profile;

  if (profile.role === 'pupil') {
    if (!profile.pupil_id) return res.json({ role: 'pupil', pupil: null, message: 'Not yet linked to a pupil record.' });
    return res.json({ role: 'pupil', pupil: await pupilSummary(profile.pupil_id) });
  }

  if (profile.role === 'teacher') {
    const classIds = await accessibleClassIds(profile);
    const pupils = classIds.length
      ? must(await supabase.from('pupils').select('id, name, class_id, classes(name, colour_hex)').in('class_id', classIds).eq('active', true))
      : [];
    const awards = must(await supabase.from('awards').select('pupil_id, points'));
    return res.json({
      role: 'teacher',
      classIds,
      pupils: pupils.map((p) => ({
        id: p.id,
        name: p.name,
        class_name: p.classes.name,
        colour_hex: p.classes.colour_hex,
        season_points: awards.filter((a) => a.pupil_id === p.id).reduce((sum, a) => sum + a.points, 0),
      })),
    });
  }

  if (profile.role === 'parent') {
    const links = must(await supabase.from('parent_pupil_links').select('pupil_id').eq('parent_profile_id', profile.id));
    const children = (await Promise.all(links.map((l) => pupilSummary(l.pupil_id)))).filter(Boolean);
    return res.json({ role: 'parent', children });
  }

  // admin — small tables at this app's scale, so plain counts in JS are fine
  const [pendingRes, pupilsRes, staffRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('approval_status', 'pending'),
    supabase.from('pupils').select('id').eq('active', true),
    supabase.from('profiles').select('id, role').eq('approval_status', 'approved'),
  ]);
  const pending = must(pendingRes);
  const pupils = must(pupilsRes);
  const staff = must(staffRes);
  res.json({
    role: 'admin',
    pendingApprovals: pending.length,
    totalPupils: pupils.length,
    totalStaff: staff.filter((s) => s.role === 'teacher' || s.role === 'admin').length,
  });
}));

// Detail view for one pupil — used by the pupil themselves, or by a
// teacher/parent/admin who's allowed to see that particular pupil.
router.get('/pupil/:pupilId', route(async (req, res) => {
  const pupilId = req.params.pupilId;
  if (!(await canAccessPupil(req.profile, pupilId))) return res.status(403).json({ error: 'forbidden' });

  const summary = await pupilSummary(pupilId);
  if (!summary) return res.status(404).json({ error: 'not found' });

  const academic = must(await supabase.from('academic_progress').select('*').eq('pupil_id', pupilId).order('recorded_at', { ascending: false }));
  const psd = must(await supabase.from('psd_entries').select('*').eq('pupil_id', pupilId).order('recorded_at', { ascending: false }));

  res.json({ pupil: summary, academicProgress: academic, psd });
}));

module.exports = router;
