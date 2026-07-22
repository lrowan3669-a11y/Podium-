# Podium

A classroom reward app for an Alternative Provision cohort. Two season-long
F1-style championships run in parallel — individual pupils and classes —
alongside per-pupil dashboards (academic progress, PSD tracker, and more to
come) with role-based accounts for pupils, staff and parents.

## Quick start

Persistence is a hosted Supabase (Postgres) project — see **Local
development** below for the one-time setup. Once your `.env` is filled in:

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Decisions taken (per the brief's [DECIDE] defaults)

All four were built with the brief's suggested default — change any of
these in one place and the rest of the app follows:

1. **Points per attempt** — 1 point per correct answer (3/3 = 3 points).
   See `score`/`points` in the `/api/attempts` handler in `server.js`.
2. **Who drives it** — Question Mode itself is still teacher-run on the
   classroom TV (`POST /api/attempts` requires a teacher/admin session).
   This decision predates the headteacher's later ask for full pupil/
   parent/staff accounts (see **Accounts, roles & approvals** below) —
   pupils now do have logins for their *own dashboard*, just not for
   running question rounds themselves.
3. **Class score** — average points per pupil (`class score = total class
   points / pupils in class`), so a small class can compete. See
   `classStandingsRows()` in `server.js`.
4. **Fury vs Sweet Science** — kept Fury red-and-gold as specified.

## Project structure

```
server.js            Express app: wiring, existing scoreboard routes
db/schema.sql          Postgres schema for Supabase (run once, see below)
db/db.js                Supabase client — service_role, for data (server-side only)
db/authClient.js         Fresh Supabase client per call — for auth ops specifically
lib/session.js          Our own httpOnly-cookie sessions (not Supabase's JWT lifecycle)
lib/authorization.js    canAccessPupil() / accessibleClassIds() — the one place role-scoping logic lives
lib/storage.js          Ensures the private 'avatars' bucket exists
lib/dbHelpers.js        must({data,error}) — throw on Supabase error, else unwrap
middleware/auth.js      attachProfile / requireAuth / requireApproved / requireRole
routes/auth.js          signup, login, logout, me
routes/admin.js         pending approvals, approve (+ link to pupil/class), reject
routes/dashboard.js     role-scoped "what should I see" + single-pupil detail
routes/trackers.js      Academic Progress + PSD tracker read/write
routes/avatar.js        Upload/serve profile photos — always authorization-checked first
public/                Static frontend (vanilla HTML/CSS/JS, ES modules)
  index.html             App shell: topbar, responsive nav, autoplay gate
  css/style.css           Dark, high-contrast, graffiti-styled, responsive theme
  js/main.js              Auth-aware hash router + nav rendering
  js/api.js                Fetch client for the backend
  js/session.js             In-memory "who am I" store, read by any screen
  js/avatarWidget.js        Reusable avatar <img>-with-initials-fallback component
  js/pupilDetailView.js     Shared pupil dashboard view (self, teacher, parent, admin all use it)
  js/sound.js               Web Audio cues per class theme
  js/logo.js                Placeholder inline-SVG Podium mark
  js/screens/*.js            One module per screen (see below)
```

### Screens

- `#/login`, `#/signup` — account creation and sign-in. Every signup starts `pending` until an admin approves it.
- `#/pending` — holding screen for an approved-but-not-yet-linked or still-pending account.
- `#/dashboard` — role-shaped landing page: a pupil sees their own detail view; a teacher/parent sees a card grid of their pupils/children; an admin sees stats + a link to approvals.
- `#/pupil/:id` — the shared pupil detail view (avatar, Academic Progress, PSD tracker, "coming soon" cards for the rest of the brief's tracked domains) — reachable by the pupil themselves, or anyone with access to that pupil (see **Access model** below).
- `#/approvals` — admin only: the pending-signups queue, with the linking UI (pupil/class picker) that actually grants access.
- `#/individual` — season-long individual leaderboard, rows tinted by class colour.
- `#/classes` — the Constructors' Board (five classes, average per pupil).
- `#/weekly` — Weekly Champion + Weekly Class Champion, plus the week-advance control.
- `#/play` — teacher-driven question mode: pick a pupil, pick a question set, 3 questions, instant feedback, themed award flourish + sound cue.
- `#/admin` — teacher admin: pupils, question sets, manual point awards, class reference.
- `#/tv` — read-only, auto-rotating (individual → classes → weekly) for the classroom TV.

## Accounts, roles & approvals

Every person — pupil, teacher, parent — signs up with an email and
password (handled by Supabase Auth; this app never stores a password
itself). Every new account starts `pending` and simply **cannot sign in**
until an admin approves it from `#/approvals` and links it to a real
record:

- **Pupil** signup → admin either links it to an existing pupil (added
  earlier via Teacher Admin) or creates a new pupil record on the spot.
- **Teacher** signup → admin ticks which class(es) they're linked to.
- **Parent** signup → admin links them to their child/children's pupil
  record(s) (by pupil ID for now — there's no name-search picker yet).

### Access model

Enforced centrally in `lib/authorization.js` and applied by every route
that touches pupil data:

| Role | Can see |
|---|---|
| `admin` | Everyone and everything, plus the approvals queue |
| `teacher` | Only pupils in class(es) they're linked to |
| `parent` | Only their explicitly linked child/children |
| `pupil` | Only their own record |

### The first admin (bootstrap)

There's no self-service way to become an admin — a signup can only ever
request `pupil`/`teacher`/`parent`, and only an *existing* admin can
approve accounts. So the very first admin (the headteacher) is promoted
by hand, once, directly in the database:

1. Have the headteacher sign up normally (role: pick any — it gets
   overwritten in the next step) at `#/signup`.
2. In the Supabase SQL Editor, run:
   ```sql
   update profiles set role = 'admin', approval_status = 'approved'
   where email = 'headteacher@example.org';
   ```
3. They can now sign in and approve everyone else from `#/approvals`.

### Security model

Every table has Row Level Security **enabled with zero policies** (see
the bottom of `db/schema.sql`) — the browser never talks to Supabase
directly at all, only to this Express server, which always connects with
the `service_role` key (which bypasses RLS by design). So "RLS on, no
policies" is a backstop, not the enforcement mechanism: the real
authorization logic lives in one place, `lib/authorization.js` +
`middleware/auth.js`, not duplicated between RLS policies and
application code.

Profile photos follow the same principle: they're stored in a **private**
Supabase Storage bucket (`avatars`, created automatically on first
server start by `lib/storage.js`) and are only ever served through
`GET /api/avatar/:profileId`, which runs the same access check as the
rest of the app before streaming the image bytes back. There is no
public or signed URL a browser could get to directly — a teacher can see
their own pupils' photos, a parent their child's, an admin everyone's,
and that's it.

## Data model

**Scoreboard** (original brief): `classes`, `pupils`, `question_sets`,
`questions`, `attempts`, `awards`, `meta`. Season and weekly totals are
both derived from `awards` (weekly points/awards are filtered by `week =
current week`); nothing is denormalised onto `pupils`, so there's no sync
to get wrong. `meta.current_week` is the rolling week marker — the
teacher advances it from the Weekly screen, which is exactly what resets
"of the week" awards (season totals are untouched, since they sum every
week).

Recording a question-mode attempt needs two inserts (the attempt itself,
then the award it earns) to either both land or neither does, so that's
done via a small Postgres function, `record_attempt(...)`, defined in
`db/schema.sql` and called from `server.js` with `supabase.rpc(...)`.
Every other read/write is plain Supabase query-builder calls
(`.from(table).select()/.insert()/.update()/.delete()`).

**Accounts** (added for the headteacher's dashboard brief):
`profiles` (one row per signed-up person, keyed to Supabase's own
`auth.users`), `parent_pupil_links`, `teacher_class_links`, `sessions`
(our own app-level session tokens, hashed at rest — see **Security
model** above).

**Tracked domains**: `academic_progress` (subject_area/skill/score 1-5 —
English: reading/writing/speaking/listening, Maths:
adding/subtracting/multiplication/division, Other:
science/history/geography/creative_arts) and `psd_entries` (category/score
1-5 — the six PSD categories from the brief). Both are staff-write,
family-read: any teacher/admin with access to the pupil can add an entry,
and the pupil/their parent/any linked teacher can view the history. The
remaining domains from the brief (Sporting, Business & Enterprise,
Attendance Tracker, Strengths Profile/Clifton Strengths, Educational
Enhancements) show as "coming soon" cards on the pupil dashboard —
the same `subject_area/skill/score` shape in `academic_progress` (or a
sibling table following the same pattern) is the natural next step for
each one.

## Logo assets

The brief references three provided image files
(`podium-logo-full.png`, `podium-mark-transparent.png`, `podium-icon.png`)
but they weren't attached to the build brief, so `public/js/logo.js` and
`public/img/favicon.svg` ship a placeholder inline-SVG mark (podium blocks
+ star) in the meantime. Once you have the real files:

1. Drop them into `public/img/`.
2. Swap the `<img>`/inline-SVG usages in `public/index.html` and
   `public/js/logo.js` to point at them.
3. Point `<link rel="icon">` in `public/index.html` at `podium-icon.png`.

Sound cues are synthesized with the Web Audio API (no audio files needed)
per class: engine rev (Hamilton), crowd roar (Charlton), bell (Fury /
Sweet Science), dartboard thud (The Power) — see `public/js/sound.js`.

### Graffiti styling

Three street-art webfonts are self-hosted under `public/fonts/`
(Bungee for headers/nav/buttons, Rubik Wet Paint for the dripping wordmark,
Permanent Marker for tag-style flourishes) rather than pulled from the
Google Fonts CDN, so the app still looks right behind school content
filters that commonly block external font CDNs. Paint-drip underlines,
spray-splatter rank badges, torn-sticker card corners, and corner
paint-cloud textures are all done in pure CSS (`public/css/style.css`) —
no extra image assets required.

## Local development (Supabase)

One-time setup, then `npm install && npm start` works from any machine —
no compiler, no Python, nothing native to build.

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
   (the free tier is plenty for a classroom app). Wait for it to finish
   provisioning.
2. **Run the schema.** In the Supabase dashboard, open your project →
   **SQL Editor** → New query, paste in the entire contents of
   `db/schema.sql`, and run it. This creates all the tables, seeds the
   five classes, and creates the `record_attempt` function. It's safe to
   re-run if you ever need to.
3. **Get your API keys.** Project → **Project Settings** → **API**.
   You need the **Project URL** and the **`service_role`** secret key
   (not the `anon` key — the service role key is what lets this backend
   read/write everything; it's never sent to the browser).
4. **Set up your local env file:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` with the values from step 3.
5. **Install and run:**
   ```bash
   npm install
   npm start
   ```
   Open `http://localhost:3000`.
6. **Sign up, then promote yourself to admin.** Create an account at
   `#/signup`, then follow **The first admin (bootstrap)** above to
   approve it via a one-off SQL statement. Every account after that gets
   approved normally from `#/approvals`.

`.env` is gitignored — never commit it. `db/db.js` throws a clear error
on startup if the two env vars aren't set, rather than failing
mysteriously later. The private `avatars` storage bucket is created
automatically the first time the server starts — no manual dashboard
step needed for that part.

## Deploying to Vercel

`vercel.json` routes all requests through `server.js` as a single
serverless function. Since persistence is now Supabase (a real hosted
Postgres database reachable over HTTPS), there's no serverless
filesystem caveat to work around — this is the straightforward,
correct setup for Vercel.

1. Import the repo into Vercel as a new project.
2. In the Vercel project's **Settings → Environment Variables**, add the
   same two variables from your `.env`: `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. Local dev and the Vercel deployment point at the same
   Supabase project by default, so data created from one shows up in the
   other — that's normal and usually what you want for a single
   classroom's data.

## Validation

```bash
npm test   # node --check across server.js, db/, lib/, middleware/, routes/
```

All frontend ES modules under `public/js/` were checked with
`node --input-type=module --check` during development. The full backend —
scoreboard routes, the `record_attempt` RPC call, and the entire
auth/roles/approval/tracker/avatar flow (signup → pending → admin
approval + linking → login → role-scoped access, including the negative
cases: an unlinked teacher denied a pupil's data, a parent blocked from
writing tracker entries, a rejected account unable to sign in) — was
exercised end-to-end over real HTTP against an in-memory mock of the
Supabase client during development, standing in for a live project this
sandbox can't reach. The dashboard screens were additionally driven
through a real headless browser at desktop, tablet, and phone viewports
to check the responsive layout and the login → dashboard flow visually.
