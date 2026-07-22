# Podium

A classroom reward app for an Alternative Provision cohort. Two season-long
F1-style championships run in parallel — individual pupils and classes —
built teacher-driven for a classroom TV, per `PODIUM_BRIEF.md`.

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
2. **Who drives it** — teacher-driven on the classroom TV, no pupil logins.
3. **Class score** — average points per pupil (`class score = total class
   points / pupils in class`), so a small class can compete. See
   `classStandingsRows()` in `server.js`.
4. **Fury vs Sweet Science** — kept Fury red-and-gold as specified.

## Project structure

```
server.js            Express app + all /api routes
db/schema.sql         Postgres schema for Supabase (run once, see below)
db/db.js               Supabase client (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
public/                Static frontend (vanilla HTML/CSS/JS, ES modules)
  index.html            App shell + nav + autoplay gate
  css/style.css          Dark, high-contrast, TV-legible theme
  js/main.js             Hash router
  js/api.js               Fetch client for the backend
  js/sound.js              Web Audio cues per class theme
  js/logo.js               Placeholder inline-SVG Podium mark
  js/screens/*.js           One module per screen (see below)
```

### Screens

- `#/individual` — season-long individual leaderboard, rows tinted by class colour.
- `#/classes` — the Constructors' Board (five classes, average per pupil).
- `#/weekly` — Weekly Champion + Weekly Class Champion, plus the week-advance control.
- `#/play` — teacher-driven question mode: pick a pupil, pick a question set, 3 questions, instant feedback, themed award flourish + sound cue.
- `#/admin` — teacher admin: pupils, question sets, manual point awards, class reference.
- `#/tv` — read-only, auto-rotating (individual → classes → weekly) for the classroom TV.

## Data model

Postgres tables (in Supabase): `classes`, `pupils`, `question_sets`,
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

`.env` is gitignored — never commit it. `db/db.js` throws a clear error
on startup if the two env vars aren't set, rather than failing
mysteriously later.

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
npm test   # node --check on server.js and db/db.js
```

All frontend ES modules under `public/js/` were checked with
`node --input-type=module --check` during development. The rewritten
`server.js` routes (aggregation, sorting, the `record_attempt` RPC call)
were exercised end-to-end over real HTTP against an in-memory mock of the
Supabase client during development, standing in for a live project.
