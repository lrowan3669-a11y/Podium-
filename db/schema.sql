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

-- No demo classes are seeded — classes are created entirely in-app (Teacher
-- Admin → Classes → "Create a Class"), by whichever school actually
-- deploys this. See the Phase 4 section below for the columns that made
-- that possible (photo_path, created_by, nullable sport-identity columns).

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


-- ============================================================================
-- Phase 2: accounts, roles, approvals, and the first two tracked domains
-- (Academic Progress, PSD tracker). Safe to re-run alongside everything
-- above.
-- ============================================================================

-- One row per signed-up person (pupil, teacher, parent, or admin), keyed to
-- Supabase's own auth.users so password storage/verification is entirely
-- Supabase Auth's job — this table only ever holds role/approval/profile
-- data, never a credential.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('pupil', 'teacher', 'parent', 'admin')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  pupil_id bigint references pupils(id), -- set once an admin links/creates the matching pupil roster row
  avatar_path text, -- object path inside the private 'avatars' storage bucket
  signup_hint jsonb, -- free-text context captured at signup (e.g. "I teach Hamilton", "my child is Alex Smith") to help an admin approve/link correctly — never itself a grant of access
  created_at timestamptz not null default now()
);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_approval on profiles(approval_status);

create table if not exists parent_pupil_links (
  id bigint generated always as identity primary key,
  parent_profile_id uuid not null references profiles(id) on delete cascade,
  pupil_id bigint not null references pupils(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, pupil_id)
);

create table if not exists teacher_class_links (
  id bigint generated always as identity primary key,
  teacher_profile_id uuid not null references profiles(id) on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_profile_id, class_id)
);

-- Our own app-level sessions (not Supabase's JWT/refresh-token lifecycle) —
-- gives us a simple, revocable httpOnly-cookie session with a lifetime we
-- control. Only a hash of the token is stored, same principle as a password.
create table if not exists sessions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_sessions_token_hash on sessions(token_hash);
create index if not exists idx_sessions_profile on sessions(profile_id);

-- Academic Progress: subject_area/skill pairs match the brief —
-- english: reading | writing | speaking | listening
-- maths: adding | subtracting | multiplication | division
-- other: science | history | geography | creative_arts
create table if not exists academic_progress (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id) on delete cascade,
  subject_area text not null check (subject_area in ('english', 'maths', 'other')),
  skill text not null,
  score int not null check (score between 1 and 5),
  note text,
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);
create index if not exists idx_academic_progress_pupil on academic_progress(pupil_id);

-- PSD (Personal & Social Development) tracker categories, per the brief:
-- attendance_and_learning | respect_to_others | positive_pathway |
-- making_friends | arriving_on_time | activities_outside_school
create table if not exists psd_entries (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id) on delete cascade,
  category text not null check (category in (
    'attendance_and_learning', 'respect_to_others', 'positive_pathway',
    'making_friends', 'arriving_on_time', 'activities_outside_school'
  )),
  score int not null check (score between 1 and 5),
  note text,
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);
create index if not exists idx_psd_entries_pupil on psd_entries(pupil_id);

-- Row Level Security: enabled everywhere, with zero policies anywhere. The
-- browser never talks to Supabase directly — every request goes through our
-- Express server, which authenticates the caller itself and always connects
-- to Supabase with the service_role key (which bypasses RLS by design). So
-- "RLS enabled, no policies" simply means: if anything ever *did* reach
-- Supabase directly with a lesser key, it would see nothing. Authorization
-- logic lives in one place — the Express route handlers — not duplicated
-- across RLS policies and application code.
alter table classes enable row level security;
alter table pupils enable row level security;
alter table question_sets enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
alter table awards enable row level security;
alter table meta enable row level security;
alter table profiles enable row level security;
alter table parent_pupil_links enable row level security;
alter table teacher_class_links enable row level security;
alter table sessions enable row level security;
alter table academic_progress enable row level security;
alter table psd_entries enable row level security;

-- Private avatar storage bucket (server.js also ensures this exists on
-- startup, so this statement is a belt-and-braces backstop, not required).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;


-- ============================================================================
-- Phase 3: one-time school setup (name + logo)
-- ============================================================================

-- Single-row table (id is always true) — this deployment is one school.
-- The name/logo show throughout the app, including the pre-login gate
-- screen, so this table is read through a public API route rather than
-- being locked down like everything else here.
create table if not exists school_settings (
  id boolean primary key default true,
  constraint school_settings_singleton check (id),
  name text not null default 'Podium',
  logo_path text,
  updated_at timestamptz not null default now()
);
insert into school_settings (id) values (true) on conflict (id) do nothing;

alter table school_settings enable row level security;

-- Public bucket — unlike pupil avatars, the school logo has to be visible
-- before anyone signs in (gate screen, login screen), so there's no
-- access check to gate it behind. Nothing sensitive lives here.
insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', true)
on conflict (id) do nothing;


-- ============================================================================
-- Phase 4: staff-created classes, pupil directory/claiming, parent invite
-- links, attendance, qualifications, feedback, and messaging.
-- Safe to re-run alongside everything above.
-- ============================================================================

-- Classes used to be a fixed, pre-seeded roster of five F1/boxing/darts-
-- themed "crews". They're now created ad hoc by staff (name + photo), so
-- the old sport-identity columns are no longer guaranteed — made nullable
-- rather than dropped, so the five original seeded rows (and their
-- existing award/leaderboard history) keep working untouched.
alter table classes alter column namesake drop not null;
alter table classes alter column sport_theme drop not null;
alter table classes alter column unit_label drop not null;
alter table classes alter column award_flourish drop not null;
alter table classes add column if not exists photo_path text;
alter table classes add column if not exists created_by uuid references profiles(id);

-- A pupil with no class yet sits in the cross-school directory, visible to
-- every teacher, until a teacher claims them into one of their own classes
-- (see routes/directory.js) — at which point normal class-scoped visibility
-- (lib/authorization.js) takes over and only that class's teacher(s) + admin
-- can see them.
alter table pupils alter column class_id drop not null;
comment on column pupils.class_id is 'null = unclaimed, listed in the staff directory until a teacher claims this pupil into one of their classes';

-- A pupil's own "about me" — self-authored, shown on their profile.
alter table pupils add column if not exists likes jsonb;
alter table pupils add column if not exists dislikes jsonb;
alter table pupils add column if not exists favourite_subjects jsonb;

-- Morning/afternoon attendance mark, one row per pupil per session per day.
create table if not exists attendance_entries (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id) on delete cascade,
  entry_date date not null,
  session text not null check (session in ('am', 'pm')),
  status text not null check (status in ('present', 'late', 'authorised_absent', 'unauthorised_absent')),
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now(),
  unique (pupil_id, entry_date, session)
);
create index if not exists idx_attendance_pupil on attendance_entries(pupil_id);

-- Qualifications a pupil is working towards, with a staff-recorded percent
-- complete. One row per qualification per pupil, updated in place.
create table if not exists qualifications (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id) on delete cascade,
  title text not null,
  percent int not null check (percent between 0 and 100),
  recorded_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
create index if not exists idx_qualifications_pupil on qualifications(pupil_id);

-- Free-text feedback a teacher leaves on a pupil's work/profile — visible to
-- the pupil themselves, their linked parent(s), the pupil's class teacher(s),
-- and admin (same visibility rule as every other pupil-scoped tracker).
create table if not exists feedback_entries (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_pupil on feedback_entries(pupil_id);

-- Direct messages between two accounts. Allowed pairs (teacher<->pupil,
-- parent<->teacher) are enforced in routes/messages.js, not here — this
-- table just stores whatever the route already validated.
create table if not exists messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_messages_sender on messages(sender_id, created_at);
create index if not exists idx_messages_recipient on messages(recipient_id, created_at);

-- One-time shareable links a teacher/admin generates for a specific pupil,
-- so a parent can be sent the link (by whatever channel the school already
-- uses — email, text, WhatsApp) and land on a signup form that's already
-- locked to that child. Only a hash of the token is stored, same principle
-- as sessions.token_hash.
create table if not exists pupil_invites (
  id bigint generated always as identity primary key,
  pupil_id bigint not null references pupils(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references profiles(id)
);
create index if not exists idx_pupil_invites_token_hash on pupil_invites(token_hash);

alter table attendance_entries enable row level security;
alter table qualifications enable row level security;
alter table feedback_entries enable row level security;
alter table messages enable row level security;
alter table pupil_invites enable row level security;

-- Public bucket for class photos — shown throughout the app (standings,
-- class badges) to every signed-in account regardless of role, same
-- reasoning as school-assets.
insert into storage.buckets (id, name, public)
values ('class-assets', 'class-assets', true)
on conflict (id) do nothing;


-- ============================================================================
-- Phase 5: "about me" for every account, not just pupils — staff and
-- parents get the same self-authored personality fields on My Profile.
-- Safe to re-run alongside everything above.
-- ============================================================================

-- Every account gets these, self-edited from My Profile (#/profile).
alter table profiles add column if not exists likes jsonb;
alter table profiles add column if not exists dislikes jsonb;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists fun_fact text;
alter table profiles add column if not exists favourites jsonb;

-- Pupils already had likes/dislikes/favourite_subjects — bio and fun_fact
-- bring them in line with what every other account now has.
alter table pupils add column if not exists bio text;
alter table pupils add column if not exists fun_fact text;
