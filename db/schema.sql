-- Podium schema for Supabase (Postgres).
--
-- Run this once against your Supabase project: open the project's SQL
-- Editor (https://supabase.com/dashboard/project/_/sql) and paste this
-- whole file in, or run it via the Supabase CLI (`supabase db push`).
-- It's safe to re-run — tables/seed rows use IF NOT EXISTS / ON CONFLICT.

create table if not exists classes (
  id text primary key,
  name text not null,
  namesake text not null,
  sport_theme text not null,
  unit_label text not null,
  colour_hex text not null,
  award_flourish text not null
);

create table if not exists pupils (
  id bigint generated always as identity primary key,
  name text not null,
  class_id text not null references classes(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists question_sets (
  id bigint generated always as identity primary key,
  term text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id bigint generated always as identity primary key,
  question_set_id bigint not null references question_sets(id) on delete cascade,
  order_index int not null,
  question_text text not null,
  answer_text text not null,
  options jsonb
);

create table if not exists attempts (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id),
  question_set_id bigint not null references question_sets(id),
  score int not null,
  week int not null,
  "timestamp" timestamptz not null default now()
);

create table if not exists awards (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id),
  class_id text not null references classes(id),
  points int not null,
  week int not null,
  source text not null,
  "timestamp" timestamptz not null default now()
);

create table if not exists meta (
  key text primary key,
  value text not null
);

create index if not exists idx_awards_week on awards(week);
create index if not exists idx_awards_pupil on awards(pupil_id);
create index if not exists idx_attempts_week on attempts(week);
create index if not exists idx_pupils_class on pupils(class_id);

-- seed the five classes
insert into classes (id, name, namesake, sport_theme, unit_label, colour_hex, award_flourish) values
  ('fury', 'Fury', 'Tyson Fury', 'Boxing (heavyweight)', 'a 3rd-round knockdown', '#E24B4A', 'Knockdown! +{points} for Fury'),
  ('hamilton', 'Hamilton', 'Lewis Hamilton', 'Formula 1', 'a 4-second pit stop', '#1BAF7A', 'Box box! 4-second stop — +{points} for Hamilton'),
  ('charlton', 'Charlton', 'Bobby Charlton', 'Football', 'a back-post header', '#378ADD', 'Back-post header! +{points} for Charlton'),
  ('sweet_science', 'Sweet Science', 'Boxing', 'Boxing', 'a 3-punch combo', '#EDA100', 'Three-punch combo! +{points} for Sweet Science'),
  ('the_power', 'The Power', 'Phil ''The Power'' Taylor', 'Darts', 'a double 20', '#4A3AA7', 'One hundred and eighty… double 20! +{points} for The Power')
on conflict (id) do nothing;

insert into meta (key, value) values ('current_week', '1')
on conflict (key) do nothing;

-- Atomically records a question-mode attempt plus the award it earns, so the
-- two inserts either both land or neither does (mirrors the db.transaction()
-- used when this app ran on better-sqlite3).
create or replace function record_attempt(
  p_pupil_id bigint,
  p_question_set_id bigint,
  p_class_id text,
  p_score int,
  p_points int,
  p_week int
) returns bigint as $$
declare
  v_attempt_id bigint;
begin
  insert into attempts (pupil_id, question_set_id, score, week)
  values (p_pupil_id, p_question_set_id, p_score, p_week)
  returning id into v_attempt_id;

  insert into awards (pupil_id, class_id, points, week, source)
  values (p_pupil_id, p_class_id, p_points, p_week, 'question_set:' || p_question_set_id);

  return v_attempt_id;
end;
$$ language plpgsql;
