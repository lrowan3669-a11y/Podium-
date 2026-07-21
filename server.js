const express = require('express');
const path = require('path');
const db = require('./db/db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

function getCurrentWeek() {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'current_week'`).get();
  return Number(row.value);
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

app.get('/api/classes', (req, res) => {
  const rows = db.prepare(`SELECT * FROM classes ORDER BY name`).all();
  res.json(rows.map(classRow));
});

// ---------- pupils ----------

app.get('/api/pupils', (req, res) => {
  const week = getCurrentWeek();
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.class_id, p.active, c.name AS class_name, c.colour_hex,
        COALESCE((SELECT SUM(points) FROM awards a WHERE a.pupil_id = p.id), 0) AS season_points,
        COALESCE((SELECT SUM(points) FROM awards a WHERE a.pupil_id = p.id AND a.week = ?), 0) AS weekly_points
       FROM pupils p JOIN classes c ON c.id = p.class_id
       ORDER BY p.name`
    )
    .all(week);
  res.json(rows);
});

app.post('/api/pupils', (req, res) => {
  const { name, class_id } = req.body || {};
  if (!name || !class_id) return res.status(400).json({ error: 'name and class_id are required' });
  const cls = db.prepare(`SELECT id FROM classes WHERE id = ?`).get(class_id);
  if (!cls) return res.status(400).json({ error: 'unknown class_id' });
  const info = db.prepare(`INSERT INTO pupils (name, class_id) VALUES (?, ?)`).run(name.trim(), class_id);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/pupils/:id', (req, res) => {
  const { name, class_id, active } = req.body || {};
  const pupil = db.prepare(`SELECT * FROM pupils WHERE id = ?`).get(req.params.id);
  if (!pupil) return res.status(404).json({ error: 'not found' });
  if (class_id) {
    const cls = db.prepare(`SELECT id FROM classes WHERE id = ?`).get(class_id);
    if (!cls) return res.status(400).json({ error: 'unknown class_id' });
  }
  db.prepare(`UPDATE pupils SET name = ?, class_id = ?, active = ? WHERE id = ?`).run(
    name ?? pupil.name,
    class_id ?? pupil.class_id,
    active === undefined ? pupil.active : active ? 1 : 0,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/pupils/:id', (req, res) => {
  db.prepare(`DELETE FROM pupils WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- question sets ----------

app.get('/api/question-sets', (req, res) => {
  const rows = db
    .prepare(
      `SELECT qs.id, qs.term, qs.subject, qs.created_at, COUNT(q.id) AS question_count
       FROM question_sets qs LEFT JOIN questions q ON q.question_set_id = qs.id
       GROUP BY qs.id ORDER BY qs.created_at DESC`
    )
    .all();
  res.json(rows);
});

app.get('/api/question-sets/:id', (req, res) => {
  const qs = db.prepare(`SELECT * FROM question_sets WHERE id = ?`).get(req.params.id);
  if (!qs) return res.status(404).json({ error: 'not found' });
  const questions = db
    .prepare(`SELECT * FROM questions WHERE question_set_id = ? ORDER BY order_index`)
    .all(qs.id)
    .map((q) => ({
      id: q.id,
      question_text: q.question_text,
      answer_text: q.answer_text,
      options: q.options_json ? JSON.parse(q.options_json) : null,
    }));
  res.json({ ...qs, questions });
});

// play view: no answers leaked to the client before grading
app.get('/api/question-sets/:id/play', (req, res) => {
  const qs = db.prepare(`SELECT * FROM question_sets WHERE id = ?`).get(req.params.id);
  if (!qs) return res.status(404).json({ error: 'not found' });
  const questions = db
    .prepare(`SELECT id, question_text, options_json FROM questions WHERE question_set_id = ? ORDER BY order_index`)
    .all(qs.id)
    .map((q) => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options_json ? JSON.parse(q.options_json) : null,
    }));
  res.json({ id: qs.id, term: qs.term, subject: qs.subject, questions });
});

function saveQuestions(questionSetId, questions) {
  const del = db.prepare(`DELETE FROM questions WHERE question_set_id = ?`);
  const ins = db.prepare(
    `INSERT INTO questions (question_set_id, order_index, question_text, answer_text, options_json)
     VALUES (?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((qs) => {
    del.run(questionSetId);
    qs.forEach((q, i) => {
      ins.run(
        questionSetId,
        i,
        q.question_text.trim(),
        q.answer_text.trim(),
        q.options && q.options.length ? JSON.stringify(q.options) : null
      );
    });
  });
  tx(questions);
}

app.post('/api/question-sets', (req, res) => {
  const { term, subject, questions } = req.body || {};
  if (!term || !subject || !Array.isArray(questions) || questions.length < 3) {
    return res.status(400).json({ error: 'term, subject and at least 3 questions are required' });
  }
  const info = db.prepare(`INSERT INTO question_sets (term, subject) VALUES (?, ?)`).run(term.trim(), subject.trim());
  saveQuestions(info.lastInsertRowid, questions);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/question-sets/:id', (req, res) => {
  const { term, subject, questions } = req.body || {};
  const qs = db.prepare(`SELECT * FROM question_sets WHERE id = ?`).get(req.params.id);
  if (!qs) return res.status(404).json({ error: 'not found' });
  db.prepare(`UPDATE question_sets SET term = ?, subject = ? WHERE id = ?`).run(
    term ?? qs.term,
    subject ?? qs.subject,
    qs.id
  );
  if (Array.isArray(questions) && questions.length >= 3) saveQuestions(qs.id, questions);
  res.json({ ok: true });
});

app.delete('/api/question-sets/:id', (req, res) => {
  db.prepare(`DELETE FROM question_sets WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- attempts / awards ----------

app.post('/api/attempts', (req, res) => {
  const { pupil_id, question_set_id, answers } = req.body || {};
  if (!pupil_id || !question_set_id || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'pupil_id, question_set_id and answers are required' });
  }
  const pupil = db.prepare(`SELECT * FROM pupils WHERE id = ?`).get(pupil_id);
  if (!pupil) return res.status(404).json({ error: 'pupil not found' });
  const cls = db.prepare(`SELECT * FROM classes WHERE id = ?`).get(pupil.class_id);
  const questions = db
    .prepare(`SELECT * FROM questions WHERE question_set_id = ? ORDER BY order_index`)
    .all(question_set_id);
  if (!questions.length) return res.status(404).json({ error: 'question set not found' });

  const results = questions.map((q, i) => {
    const given = (answers[i] ?? '').toString().trim().toLowerCase();
    const correct = given === q.answer_text.trim().toLowerCase();
    return { question_id: q.id, question_text: q.question_text, correct };
  });
  const score = results.filter((r) => r.correct).length;
  const points = score; // [DECIDE] default: 1 point per correct answer

  const week = getCurrentWeek();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO attempts (pupil_id, question_set_id, score, week) VALUES (?, ?, ?, ?)`
    ).run(pupil_id, question_set_id, score, week);
    db.prepare(
      `INSERT INTO awards (pupil_id, class_id, points, week, source) VALUES (?, ?, ?, ?, ?)`
    ).run(pupil_id, pupil.class_id, points, week, `question_set:${question_set_id}`);
  });
  tx();

  res.json({
    score,
    points,
    total: questions.length,
    results,
    flourish: flourishFor(cls, points),
    class: classRow(cls),
  });
});

app.post('/api/awards', (req, res) => {
  const { pupil_id, points, note } = req.body || {};
  if (!pupil_id || !Number.isFinite(points)) {
    return res.status(400).json({ error: 'pupil_id and numeric points are required' });
  }
  const pupil = db.prepare(`SELECT * FROM pupils WHERE id = ?`).get(pupil_id);
  if (!pupil) return res.status(404).json({ error: 'pupil not found' });
  const week = getCurrentWeek();
  db.prepare(
    `INSERT INTO awards (pupil_id, class_id, points, week, source) VALUES (?, ?, ?, ?, ?)`
  ).run(pupil_id, pupil.class_id, points, week, note ? `manual:${note}` : 'manual');
  res.status(201).json({ ok: true });
});

// ---------- standings ----------

app.get('/api/standings/individual', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.class_id, c.name AS class_name, c.colour_hex,
        COALESCE(SUM(a.points), 0) AS points
       FROM pupils p
       JOIN classes c ON c.id = p.class_id
       LEFT JOIN awards a ON a.pupil_id = p.id
       WHERE p.active = 1
       GROUP BY p.id
       ORDER BY points DESC, p.name ASC`
    )
    .all();
  res.json(rows.map((r, i) => ({ ...r, rank: i + 1 })));
});

function classStandingsRows(weekFilter) {
  const params = [];
  let awardsWhere = '';
  if (weekFilter !== null) {
    awardsWhere = 'AND a.week = ?';
    params.push(weekFilter);
  }
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.colour_hex, c.unit_label, c.namesake,
        COALESCE(SUM(a.points), 0) AS total_points,
        (SELECT COUNT(*) FROM pupils p2 WHERE p2.class_id = c.id AND p2.active = 1) AS pupil_count
       FROM classes c
       LEFT JOIN awards a ON a.class_id = c.id ${awardsWhere}
       GROUP BY c.id`
    )
    .all(...params);
  return rows
    .map((r) => ({
      ...r,
      average: r.pupil_count > 0 ? Math.round((r.total_points / r.pupil_count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

app.get('/api/standings/classes', (req, res) => {
  res.json(classStandingsRows(null));
});

app.get('/api/standings/weekly', (req, res) => {
  const week = getCurrentWeek();

  const pupilRows = db
    .prepare(
      `SELECT p.id, p.name, p.class_id, c.name AS class_name, c.colour_hex,
        COALESCE(SUM(a.points), 0) AS points,
        COALESCE((SELECT COUNT(*) FROM attempts att WHERE att.pupil_id = p.id AND att.week = ?), 0) AS attempts
       FROM pupils p
       JOIN classes c ON c.id = p.class_id
       LEFT JOIN awards a ON a.pupil_id = p.id AND a.week = ?
       WHERE p.active = 1
       GROUP BY p.id
       ORDER BY points DESC, attempts ASC, p.name ASC`
    )
    .all(week, week);

  const classRows = classStandingsRows(week);

  res.json({
    week,
    champion: pupilRows.length && pupilRows[0].points > 0 ? pupilRows[0] : null,
    classChampion: classRows.length && classRows[0].total_points > 0 ? classRows[0] : null,
    pupilRows,
    classRows,
  });
});

// ---------- week marker ----------

app.get('/api/meta/week', (req, res) => {
  res.json({ week: getCurrentWeek() });
});

app.post('/api/meta/week/advance', (req, res) => {
  const week = getCurrentWeek() + 1;
  db.prepare(`UPDATE meta SET value = ? WHERE key = 'current_week'`).run(String(week));
  res.json({ week });
});

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
