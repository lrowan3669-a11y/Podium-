# Podium

A classroom reward app for an Alternative Provision cohort. Two season-long
F1-style championships run in parallel — individual pupils and classes —
built teacher-driven for a classroom TV, per `PODIUM_BRIEF.md`.

## Quick start

```bash
npm install
npm start
```

Then open `http://localhost:3000`. The SQLite database is created
automatically at `db/podium.db` on first run, with the five classes
pre-seeded.

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
db/schema.sql         SQLite schema
db/db.js               DB init + seeds the five classes
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

SQLite tables: `classes`, `pupils`, `question_sets`, `questions`,
`attempts`, `awards`, `meta`. Season and weekly totals are both derived
from `awards` (weekly points/awards are filtered by `week = current
week`); nothing is denormalised onto `pupils`, so there's no sync to get
wrong. `meta.current_week` is the rolling week marker — the teacher
advances it from the Weekly screen, which is exactly what resets "of the
week" awards (season totals are untouched, since they sum every week).

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

## Deployment

### Vercel

`vercel.json` routes all requests through `server.js` as a single
serverless function (`@vercel/node`), so `vercel deploy` works out of the
box for trying the app out.

**Persistence caveat:** Vercel serverless functions have an ephemeral,
non-shared filesystem — a SQLite file written there does **not**
reliably survive between invocations or deployments, which conflicts
with the brief's "must survive across sessions" requirement. Two ways to
get real persistence:

- **Recommended for a real classroom rollout:** run this as a normal
  always-on Node process instead (`npm start`) — a small always-on
  device plugged into the classroom TV, or a persistent host like
  Render/Railway/a school server. `better-sqlite3` then works exactly as
  built, no changes needed.
- **To stay on Vercel serverless:** swap the persistence layer for a
  hosted database (e.g. Vercel Postgres or Turso/libSQL) — `db/db.js` is
  the only file that would need to change, since every route goes
  through `db.prepare(...)`.

Set `PODIUM_DB_PATH` (defaults to `db/podium.db`) if you need the SQLite
file to live somewhere else, e.g. `/tmp/podium.db` when experimenting on
Vercel.

## Validation

```bash
npm test   # node --check on server.js and db/db.js
```

All frontend ES modules under `public/js/` were checked with
`node --input-type=module --check` during development.
