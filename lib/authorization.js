const supabase = require('./../db/db');
const { must } = require('./dbHelpers');

// Can this profile see/act on this pupil's data? Mirrors the access model
// from the headteacher's brief: admin sees everyone, a teacher sees only
// pupils in a class they're linked to, a parent sees only pupils they're
// explicitly linked to, and a pupil sees only themselves.
async function canAccessPupil(profile, pupilId) {
  if (!profile || !pupilId) return false;
  if (profile.role === 'admin') return true;
  if (profile.role === 'pupil') return String(profile.pupil_id) === String(pupilId);

  if (profile.role === 'teacher') {
    const pupil = must(await supabase.from('pupils').select('class_id').eq('id', pupilId).maybeSingle());
    if (!pupil) return false;
    const link = must(
      await supabase
        .from('teacher_class_links')
        .select('id')
        .eq('teacher_profile_id', profile.id)
        .eq('class_id', pupil.class_id)
        .maybeSingle()
    );
    return !!link;
  }

  if (profile.role === 'parent') {
    const link = must(
      await supabase
        .from('parent_pupil_links')
        .select('id')
        .eq('parent_profile_id', profile.id)
        .eq('pupil_id', pupilId)
        .maybeSingle()
    );
    return !!link;
  }

  return false;
}

// Class ids a teacher may act within. null means "no restriction" (admin).
async function accessibleClassIds(profile) {
  if (profile.role === 'admin') return null;
  if (profile.role !== 'teacher') return [];
  const rows = must(await supabase.from('teacher_class_links').select('class_id').eq('teacher_profile_id', profile.id));
  return rows.map((r) => r.class_id);
}

// Can these two accounts message each other? Per the brief: teacher<->pupil
// and parent<->teacher only, never pupil<->pupil, and only within an actual
// class link (a teacher can't message just any pupil in the school). Admin
// can message and be messaged by anyone — same "sees everything" rule as
// the rest of the app.
async function canMessage(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.role === 'admin' || b.role === 'admin') return true;

  const teacher = a.role === 'teacher' ? a : b.role === 'teacher' ? b : null;
  const other = teacher === a ? b : a;
  if (!teacher || !['pupil', 'parent'].includes(other.role)) return false;

  const teacherClassIds = await accessibleClassIds(teacher);
  let otherClassIds = [];
  if (other.role === 'pupil') {
    if (!other.pupil_id) return false;
    const pupil = must(await supabase.from('pupils').select('class_id').eq('id', other.pupil_id).maybeSingle());
    if (pupil && pupil.class_id) otherClassIds = [pupil.class_id];
  } else {
    const links = must(await supabase.from('parent_pupil_links').select('pupil_id').eq('parent_profile_id', other.id));
    const pupilIds = links.map((l) => l.pupil_id);
    if (pupilIds.length) {
      const pupils = must(await supabase.from('pupils').select('class_id').in('id', pupilIds));
      otherClassIds = pupils.map((p) => p.class_id).filter(Boolean);
    }
  }
  return otherClassIds.some((c) => teacherClassIds.includes(c));
}

module.exports = { canAccessPupil, accessibleClassIds, canMessage };
