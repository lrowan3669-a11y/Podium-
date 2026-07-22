const express = require('express');
const path = require('path');
const supabase = require('./db/db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

// Wraps an async route handler so a thrown/rejected error becomes a 500
// instead of an unhandled rejection — every handler below is async because
// every Supabase call is a network round trip.
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

async function getCurrentWeek() {
  const data = must(await supabase.from('meta').select('value').eq('key', 'current_week').single());
  return Number(data.value);
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
  };
}

function flourishFor(classRowObj, points) {
  return classRowObj.award_flourish.replace('{points}', String(points));
}

// ---------- classes ----------

app.get('/api/classes', route(async (req, res) => {
  const rows = must(await supabase.from('classes').select('*').order('name'));
  res.json(rows.map(classRow));
}));

// ---------- pupils ----------

app.get('/api/pupils', route(async (req, res) => {
  const week = await getCurrentWeek();
  const pupils = must(
    await supabase.from('pupils').select('id, name, class_id, active, classes(name, colour_hex)').order('name')
  );
  const awards = must(await supabase.from('awards').select('pupil_id, points, week'));

  const rows = pupils.map((p) => {
    const mine = awards.filter((a) => a.pupil_id === p.id);
    return {
      id: p.id,
      name: p.name,
      class_id: p.class_id,
      active: p.active,
      class_name: p.classes.name,
      colour_hex: p.classes.colour_hex,
      season_points: mine.reduce((sum, a) => sum + a.points, 0),
      weekly_points: mine.filter((a) => a.week === week).reduce((sum, a) => sum + a.points, 0),
    };
  });
  res.json(rows);
}));

app.post('/api/pupils', route(async (req, res) => {
  const { name, class_id } = req.body || {};
  if (!name || !class_id) return res.status(400).json({ error: 'name and class_id are required' });
  const cls = must(await supabase.from('classes').select('id').eq('id', class_id).maybeSingle());
  if (!cls) return res.status(400).json({ error: 'unknown class_id' });
  const data = must(
    await supabase.from('pupils').insert({ name: name.trim(), class_id }).select('id').single()
  );
  res.status(201).json({ id: data.id });
}));

app.put('/api/pupils/:id', route(async (req, res) => {
  const { name, class_id, active } = req.body || {};
  const pupil = must(await supabase.from('pupils').select('*').eq('id', req.params.id).maybeSingle());
  if (!pupil) return res.status(404).json({ error: 'not found' });
  if (class_id) {
    const cls = must(await supabase.from('classes').select('id').eq('id', class_id).maybeSingle());
    if (!cls) return res.status(400).json({ error: 'unknown class_id' });
  }
  must(
    await supabase
      .from('pupils')
      .update({
        name: name ?? pupil.name,
        class_id: class_id ?? pupil.class_id,
        active: active === undefined ? pupil.active : !!active,
      })
      .eq('id', req.params.id)
  );
  res.json({ ok: true });
}));

app.delete('/api/pupils/:id', route(async (req, res) => {
  must(await supabase.from('pupils').delete().eq('id', req.params.id));
  res.json({ ok: true });
}));

// ---------- question sets ----------

app.get('/api/question-sets', route(async (req, res) => {
  const sets = must(
    await supabase.from('question_sets').select('id, term, subject, created_at').order('created_at', { ascending: false })
  );
  const questions = must(await supabase.from('questions').select('id, question_set_id'));
  const rows = sets.map((s) => ({
    ...s,
    question_count: questions.filter((q) => q.question_set_id === s.id).length,
  }));
  res.json(rows);
}));

app.get('/api/question-sets/:id', route(async (req, res) => {
  const qs = must(await supabase.from('question_sets').select('*').eq('id', req.params.id).maybeSingle());
  if (!qs) return res.status(404).json({ error: 'not found' });
  const questions = must(
    await supabase
      .from('questions')
      .select('id, question_text, answer_text, options')
      .eq('question_set_id', qs.id)
      .order('order_index')
  );
  res.json({ ...qs, questions });
}));

// play view: no answers leaked to the client before grading
app.get('/api/question-sets/:id/play', route(async (req, res) => {
  const qs = must(await supabase.from('question_sets').select('id, term, subject').eq('id', req.params.id).maybeSingle());
  if (!qs) return res.status(404).json({ error: 'not found' });
  const questions = must(
    await supabase
      .from('questions')
      .select('id, question_text, options')
      .eq('question_set_id', qs.id)
      .order('order_index')
  );
  res.json({ ...qs, questions });
}));

async function saveQuestions(questionSetId, questions) {
  must(await supabase.from('questions').delete().eq('question_set_id', questionSetId));
  const rows = questions.map((q, i) => ({
    question_set_id: questionSetId,
    order_index: i,
    question_text: q.question_text.trim(),
    answer_text: q.answer_text.trim(),
    options: q.options && q.options.length ? q.options : null,
  }));
  must(await supabase.from('questions').insert(rows));
}

app.post('/api/question-sets', route(async (req, res) => {
  const { term, subject, questions } = req.body || {};
  if (!term || !subject || !Array.isArray(questions) || questions.length < 3) {
    return res.status(400).json({ error: 'term, subject and at least 3 questions are required' });
  }
  const data = must(
    await supabase.from('question_sets').insert({ term: term.trim(), subject: subject.trim() }).select('id').single()
  );
  await saveQuestions(data.id, questions);
  res.status(201).json({ id: data.id });
}));

app.put('/api/question-sets/:id', route(async (req, res) => {
  const { term, subject, questions } = req.body || {};
  const qs = must(await supabase.from('question_sets').select('*').eq('id', req.params.id).maybeSingle());
  if (!qs) return res.status(404).json({ error: 'not found' });
  must(
    await supabase
      .from('question_sets')
      .update({ term: term ?? qs.term, subject: subject ?? qs.subject })
      .eq('id', qs.id)
  );
  if (Array.isArray(questions) && questions.length >= 3) await saveQuestions(qs.id, questions);
  res.json({ ok: true });
}));

app.delete('/api/question-sets/:id', route(async (req, res) => {
  must(await supabase.from('question_sets').delete().eq('id', req.params.id));
  res.json({ ok: true });
}));

// ---------- attempts / awards ----------

app.post('/api/attempts', route(async (req, res) => {
  const { pupil_id, question_set_id, answers } = req.body || {};
  if (!pupil_id || !question_set_id || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'pupil_id, question_set_id and answers are required' });
  }
  const pupil = must(await supabase.from('pupils').select('*').eq('id', pupil_id).maybeSingle());
  if (!pupil) return res.status(404).json({ error: 'pupil not found' });
  const cls = must(await supabase.from('classes').select('*').eq('id', pupil.class_id).maybeSingle());
  const questions = must(
    await supabase.from('questions').select('*').eq('question_set_id', question_set_id).order('order_index')
  );
  if (!questions.length) return res.status(404).json({ error: 'question set not found' });

  const results = questions.map((q, i) => {
    const given = (answers[i] ?? '').toString().trim().toLowerCase();
    const correct = given === q.answer_text.trim().toLowerCase();
    return { question_id: q.id, question_text: q.question_text, correct };
  });
  const score = results.filter((r) => r.correct).length;
  const points = score; // [DECIDE] default: 1 point per correct answer

  const week = await getCurrentWeek();
  must(
    await supabase.rpc('record_attempt', {
      p_pupil_id: pupil_id,
      p_question_set_id: question_set_id,
      p_class_id: pupil.class_id,
      p_score: score,
      p_points: points,
      p_week: week,
    })
  );

  res.json({
    score,
    points,
    total: questions.length,
    results,
    flourish: flourishFor(cls, points),
    class: classRow(cls),
  });
}));

app.post('/api/awards', route(async (req, res) => {
  const { pupil_id, points, note } = req.body || {};
  if (!pupil_id || !Number.isFinite(points)) {
    return res.status(400).json({ error: 'pupil_id and numeric points are required' });
  }
  const pupil = must(await supabase.from('pupils').select('*').eq('id', pupil_id).maybeSingle());
  if (!pupil) return res.status(404).json({ error: 'pupil not found' });
  const week = await getCurrentWeek();
  must(
    await supabase.from('awards').insert({
      pupil_id,
      class_id: pupil.class_id,
      points,
      week,
      source: note ? `manual:${note}` : 'manual',
    })
  );
  res.status(201).json({ ok: true });
}));

// ---------- standings ----------

app.get('/api/standings/individual', route(async (req, res) => {
  const pupils = must(
    await supabase.from('pupils').select('id, name, class_id, classes(name, colour_hex)').eq('active', true)
  );
  const awards = must(await supabase.from('awards').select('pupil_id, points'));

  const rows = pupils
    .map((p) => ({
      id: p.id,
      name: p.name,
      class_id: p.class_id,
      class_name: p.classes.name,
      colour_hex: p.classes.colour_hex,
      points: awards.filter((a) => a.pupil_id === p.id).reduce((sum, a) => sum + a.points, 0),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  res.json(rows);
}));

async function classStandingsRows(weekFilter) {
  const classes = must(await supabase.from('classes').select('*'));
  const pupils = must(await supabase.from('pupils').select('id, class_id').eq('active', true));

  let awardsQuery = supabase.from('awards').select('class_id, points');
  if (weekFilter !== null) awardsQuery = awardsQuery.eq('week', weekFilter);
  const awards = must(await awardsQuery);

  return classes
    .map((c) => {
      const pupilCount = pupils.filter((p) => p.class_id === c.id).length;
      const totalPoints = awards.filter((a) => a.class_id === c.id).reduce((sum, a) => sum + a.points, 0);
      return {
        ...c,
        total_points: totalPoints,
        pupil_count: pupilCount,
        average: pupilCount > 0 ? Math.round((totalPoints / pupilCount) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

app.get('/api/standings/classes', route(async (req, res) => {
  res.json(await classStandingsRows(null));
}));

app.get('/api/standings/weekly', route(async (req, res) => {
  const week = await getCurrentWeek();

  const pupils = must(
    await supabase.from('pupils').select('id, name, class_id, classes(name, colour_hex)').eq('active', true)
  );
  const awards = must(await supabase.from('awards').select('pupil_id, points').eq('week', week));
  const attempts = must(await supabase.from('attempts').select('pupil_id').eq('week', week));

  const pupilRows = pupils
    .map((p) => ({
      id: p.id,
      name: p.name,
      class_id: p.class_id,
      class_name: p.classes.name,
      colour_hex: p.classes.colour_hex,
      points: awards.filter((a) => a.pupil_id === p.id).reduce((sum, a) => sum + a.points, 0),
      attempts: attempts.filter((a) => a.pupil_id === p.id).length,
    }))
    .sort((a, b) => b.points - a.points || a.attempts - b.attempts || a.name.localeCompare(b.name));

  const classRows = await classStandingsRows(week);

  res.json({
    week,
    champion: pupilRows.length && pupilRows[0].points > 0 ? pupilRows[0] : null,
    classChampion: classRows.length && classRows[0].total_points > 0 ? classRows[0] : null,
    pupilRows,
    classRows,
  });
}));

// ---------- week marker ----------

app.get('/api/meta/week', route(async (req, res) => {
  res.json({ week: await getCurrentWeek() });
}));

app.post('/api/meta/week/advance', route(async (req, res) => {
  const week = (await getCurrentWeek()) + 1;
  must(await supabase.from('meta').update({ value: String(week) }).eq('key', 'current_week'));
  res.json({ week });
}));

// ---------- fallback ----------

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Podium server running on http://localhost:${PORT}`));
}

module.exports = app;
