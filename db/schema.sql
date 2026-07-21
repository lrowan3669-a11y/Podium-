-- Podium schema

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  namesake TEXT NOT NULL,
  sport_theme TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  colour_hex TEXT NOT NULL,
  award_flourish TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pupils (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  options_json TEXT
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pupil_id INTEGER NOT NULL REFERENCES pupils(id),
  question_set_id INTEGER NOT NULL REFERENCES question_sets(id),
  score INTEGER NOT NULL,
  week INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pupil_id INTEGER NOT NULL REFERENCES pupils(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  points INTEGER NOT NULL,
  week INTEGER NOT NULL,
  source TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_awards_week ON awards(week);
CREATE INDEX IF NOT EXISTS idx_awards_pupil ON awards(pupil_id);
CREATE INDEX IF NOT EXISTS idx_attempts_week ON attempts(week);
CREATE INDEX IF NOT EXISTS idx_pupils_class ON pupils(class_id);
