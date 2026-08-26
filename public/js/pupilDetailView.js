import { api } from './api.js';
import { escapeHtml, toast } from './util.js';
import { avatarHtml, wireAvatarFallbacks } from './avatarWidget.js';

const ACADEMIC_LABELS = {
  english: { label: 'English', skills: { reading: 'Reading', writing: 'Writing', speaking: 'Speaking', listening: 'Listening' } },
  maths: { label: 'Maths', skills: { adding: 'Adding', subtracting: 'Subtracting', multiplication: 'Multiplication', division: 'Division' } },
  other: { label: 'Other Subjects', skills: { science: 'Science', history: 'History', geography: 'Geography', creative_arts: 'Creative Arts' } },
};

const PSD_LABELS = {
  attendance_and_learning: 'Attendance & Learning',
  respect_to_others: 'Respect to Others',
  positive_pathway: 'Creating Own Positive Pathway',
  making_friends: 'Making Friends',
  arriving_on_time: 'Arriving on Time',
  activities_outside_school: 'Activities Outside School',
};

// Built domains link straight to their own drill-down; the rest are
// "coming soon" placeholders that still navigate somewhere rather than
// being dead clicks.
const TILES = [
  { key: 'academic', title: 'Academic Progress', built: true },
  { key: 'psd', title: 'PSD Tracker', built: true },
  { key: 'attendance', title: 'Attendance Tracker', built: true },
  { key: 'qualifications', title: 'Qualifications', built: true },
  { key: 'feedback', title: 'Feedback', built: true },
  { key: 'sporting', title: 'Sporting', note: 'Sport-specific achievements and progress.' },
  { key: 'enterprise', title: 'Business & Enterprise', note: 'Enterprise projects and business skills.' },
  { key: 'strengths', title: 'Strengths Profile', note: 'Based on Clifton Strengths.' },
  { key: 'enhancements', title: 'Educational Enhancements', note: 'DofE, outdoor learning, enrichment activities, guest speakers, work experience, community projects, creative & performing arts.' },
];

function scoreDots(score) {
  return `<span class="score-dots" aria-label="${score} out of 5">
    ${[1, 2, 3, 4, 5].map((i) => `<span class="score-dot ${i <= score ? 'filled' : ''}"></span>`).join('')}
  </span>`;
}

function latestBySkill(entries) {
  const latest = {};
  for (const e of entries) {
    const key = e.subject_area ? `${e.subject_area}:${e.skill}` : e.category;
    if (!latest[key] || new Date(e.recorded_at) > new Date(latest[key].recorded_at)) latest[key] = e;
  }
  return latest;
}

function pupilHeaderHtml(pupil, opts, extra) {
  const rowColour = pupil.colour_hex || '#2a2a33';
  return `
    <div class="pupil-header card" style="--row-colour:${rowColour}">
      <div class="pupil-header-main">
        ${pupil.profile_id ? avatarHtml(pupil.profile_id, pupil.name, 88) : `<span class="avatar avatar-fallback" style="--avatar-size:88px">${escapeHtml(pupil.name[0] || '?')}</span>`}
        <div>
          <h1 class="screen-title" style="margin-bottom:0.3rem">${escapeHtml(pupil.name)}</h1>
          <span class="class-badge" style="--row-colour:${rowColour}">
            ${pupil.class_photo_url ? `<img src="${pupil.class_photo_url}" alt="" class="class-thumb" />` : `<span class="class-dot"></span>`}
            ${pupil.class_name ? escapeHtml(pupil.class_name) : 'Unclaimed — not yet in a class'}
          </span>
          ${extra || ''}
        </div>
      </div>
      ${opts.canUploadAvatar ? `
        <div class="avatar-upload">
          <label class="btn" for="avatar-file">Change photo</label>
          <input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
        </div>` : ''}
      ${opts.canInviteParent ? `
        <div class="invite-parent">
          <button id="invite-parent-btn" class="btn">Invite a parent</button>
          <div id="invite-parent-link" class="invite-link-box hidden">
            <input type="text" readonly />
            <button type="button" class="btn" id="invite-parent-copy">Copy</button>
          </div>
        </div>` : ''}
    </div>`;
}

function wireInviteButton(container, pupilId, opts) {
  if (!opts.canInviteParent) return;
  const btn = container.querySelector('#invite-parent-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      const { token } = await api.createInvite(pupilId);
      const url = `${location.origin}/#/invite/${token}`;
      const box = container.querySelector('#invite-parent-link');
      const input = box.querySelector('input');
      input.value = url;
      box.classList.remove('hidden');
      input.select();
      toast('Invite link ready — copy it and send it to the parent yourself (email, text, WhatsApp).');
    } catch (err) {
      toast(err.message);
    }
  });
  const copyBtn = container.querySelector('#invite-parent-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const input = container.querySelector('#invite-parent-link input');
      try {
        await navigator.clipboard.writeText(input.value);
        toast('Copied');
      } catch (err) {
        input.select();
        toast('Select and copy the link manually');
      }
    });
  }
}

function wireHeaderAvatar(container, pupilId, opts, rerender) {
  wireAvatarFallbacks(container);
  if (!opts.canUploadAvatar) return;
  const input = container.querySelector('#avatar-file');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api.uploadMyAvatar(file);
      toast('Photo updated');
      rerender();
    } catch (err) {
      toast(err.message);
    }
  });
}

// ---------- hub: "Your Podium" + tile grid ----------

function progressRingHtml(percent, caption) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  return `
    <div class="progress-ring">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="${r}" class="progress-ring-track" />
        <circle cx="50" cy="50" r="${r}" class="progress-ring-fill"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
      </svg>
      <div class="progress-ring-label">
        <span class="progress-ring-value">${percent === null ? '—' : clamped + '%'}</span>
        <span class="progress-ring-caption">${escapeHtml(caption)}</span>
      </div>
    </div>`;
}

export async function renderPupilHub(container, pupilId, opts = {}) {
  const [detail, individualStandings, classStandings] = await Promise.all([
    api.getPupilDashboard(pupilId),
    api.getIndividualStandings().catch(() => []),
    api.getClassStandings().catch(() => []),
  ]);
  const { pupil, academicProgress, psd, attendanceCount, qualificationsCount, feedbackCount } = detail;

  const myRank = individualStandings.find((r) => String(r.id) === String(pupil.id));
  const myClassRank = classStandings.find((r) => String(r.id) === String(pupil.class_id));

  const podiumStatHtml = (label, value) => `
    <div class="podium-stat">
      <span class="podium-stat-value">${value}</span>
      <span class="podium-stat-label">${escapeHtml(label)}</span>
    </div>`;

  // "Overall progress" ring: average of every tracker's latest score
  // (academic + PSD, 1-5 each) as a percentage — a real, if rough, signal
  // rather than an invented number.
  const allLatest = [...Object.values(latestBySkill(academicProgress)), ...Object.values(latestBySkill(psd))];
  const ringPercent = allLatest.length
    ? Math.round((allLatest.reduce((sum, e) => sum + e.score, 0) / (allLatest.length * 5)) * 100)
    : null;

  const extra = `
    <div class="podium-stats">
      ${progressRingHtml(ringPercent, 'Overall Progress')}
      ${podiumStatHtml('Season Points', pupil.season_points)}
      ${podiumStatHtml('Individual Rank', myRank ? `#${myRank.rank}` : '—')}
      ${podiumStatHtml(pupil.class_name ? `${pupil.class_name} Rank` : 'Class Rank', myClassRank ? `#${myClassRank.rank}` : '—')}
    </div>`;

  const counts = {
    academicCount: academicProgress.length,
    psdCount: psd.length,
    attendanceCount,
    qualificationsCount,
    feedbackCount,
  };

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts, extra)}
    ${aboutMeHtml(pupil, opts)}
    <h3 class="coming-soon-title">Podium Trackers</h3>
    <div class="tile-grid">
      ${TILES.map((t) => tileHtml(pupilId, t, counts)).join('')}
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderPupilHub(container, pupilId, opts));
  wireInviteButton(container, pupilId, opts);
  wireAboutMe(container, pupilId, pupil, opts, () => renderPupilHub(container, pupilId, opts));
}

// ---------- about me (likes / dislikes / favourite subjects) ----------

function aboutMeHtml(pupil, opts) {
  const hasAny = pupil.likes.length || pupil.dislikes.length || pupil.favourite_subjects.length;
  if (!opts.canEditAbout && !hasAny) return '';

  const pillList = (items) => (items.length ? items.map((s) => `<span class="pill">${escapeHtml(s)}</span>`).join('') : `<span class="muted">Nothing added yet</span>`);

  return `
    <div class="card about-me">
      <div class="about-me-view">
        <div class="about-me-row"><h4>Things I like</h4><div class="pill-list">${pillList(pupil.likes)}</div></div>
        <div class="about-me-row"><h4>Things I don't like</h4><div class="pill-list">${pillList(pupil.dislikes)}</div></div>
        <div class="about-me-row"><h4>Favourite subjects</h4><div class="pill-list">${pillList(pupil.favourite_subjects)}</div></div>
        ${opts.canEditAbout ? `<button id="about-me-edit-btn" class="btn">Edit</button>` : ''}
      </div>
      ${opts.canEditAbout ? aboutMeFormHtml(pupil) : ''}
    </div>`;
}

function aboutMeFormHtml(pupil) {
  return `
    <form id="about-me-form" class="tracker-form hidden">
      <div class="field">
        <label for="about-likes">Things I like (up to 5, comma-separated)</label>
        <input id="about-likes" type="text" value="${escapeHtml(pupil.likes.join(', '))}" />
      </div>
      <div class="field">
        <label for="about-dislikes">Things I don't like (up to 5, comma-separated)</label>
        <input id="about-dislikes" type="text" value="${escapeHtml(pupil.dislikes.join(', '))}" />
      </div>
      <div class="field">
        <label for="about-subjects">Favourite subjects (up to 5, comma-separated)</label>
        <input id="about-subjects" type="text" value="${escapeHtml(pupil.favourite_subjects.join(', '))}" />
      </div>
      <button type="submit" class="btn btn-primary">Save</button>
    </form>`;
}

function wireAboutMe(container, pupilId, pupil, opts, rerender) {
  if (!opts.canEditAbout) return;
  const editBtn = container.querySelector('#about-me-edit-btn');
  const form = container.querySelector('#about-me-form');
  const view = container.querySelector('.about-me-view');
  if (!editBtn || !form) return;

  editBtn.addEventListener('click', () => {
    view.classList.add('hidden');
    form.classList.remove('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const splitList = (id) => form.querySelector(id).value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    try {
      await api.updateAboutMe(pupilId, {
        likes: splitList('#about-likes'),
        dislikes: splitList('#about-dislikes'),
        favourite_subjects: splitList('#about-subjects'),
      });
      toast('Saved');
      rerender();
    } catch (err) {
      toast(err.message);
    }
  });
}

const TILE_COUNT_KEYS = {
  academic: 'academicCount',
  psd: 'psdCount',
  attendance: 'attendanceCount',
  qualifications: 'qualificationsCount',
  feedback: 'feedbackCount',
};

function tileHtml(pupilId, tile, counts) {
  let preview = `<span class="pill">Coming soon</span>`;
  const countKey = TILE_COUNT_KEYS[tile.key];
  if (countKey) {
    const n = counts[countKey];
    preview = n ? `<span class="tile-count">${n} ${tile.key === 'feedback' ? (n === 1 ? 'note' : 'notes') : 'entries'}</span>` : `<span class="muted">No entries yet</span>`;
  }
  return `
    <a class="card tile-card ${tile.built ? 'tile-built' : 'tile-soon'}" href="#/pupil/${pupilId}/${tile.key}">
      <h4>${escapeHtml(tile.title)}</h4>
      ${tile.note ? `<p class="muted tile-note">${escapeHtml(tile.note)}</p>` : ''}
      ${preview}
    </a>`;
}

// ---------- academic progress detail ----------

export async function renderAcademicDetail(container, pupilId, opts = {}) {
  const detail = await api.getPupilDashboard(pupilId);
  const { pupil, academicProgress } = detail;
  const latest = latestBySkill(academicProgress);

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts)}
    <a href="#/pupil/${pupilId}" class="back-link">&larr; Back to dashboard</a>
    <div class="card">
      <h3>Academic Progress</h3>
      ${Object.entries(ACADEMIC_LABELS)
        .map(
          ([area, def]) => `
        <div class="tracker-subject">
          <h4>${escapeHtml(def.label)}</h4>
          <div class="tracker-skill-grid">
            ${Object.entries(def.skills)
              .map(([skill, skillLabel]) => {
                const entry = latest[`${area}:${skill}`];
                return `<div class="tracker-skill">
                  <span class="tracker-skill-label">${escapeHtml(skillLabel)}</span>
                  ${entry ? scoreDots(entry.score) : `<span class="muted">No entry yet</span>`}
                </div>`;
              })
              .join('')}
          </div>
        </div>`
        )
        .join('')}
      ${opts.canRecordTrackers ? academicFormHtml() : ''}
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderAcademicDetail(container, pupilId, opts));
  if (opts.canRecordTrackers) wireAcademicForm(container, pupilId, opts);
}

// ---------- PSD tracker detail ----------

export async function renderPsdDetail(container, pupilId, opts = {}) {
  const detail = await api.getPupilDashboard(pupilId);
  const { pupil, psd } = detail;
  const latest = latestBySkill(psd);

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts)}
    <a href="#/pupil/${pupilId}" class="back-link">&larr; Back to dashboard</a>
    <div class="card">
      <h3>PSD Tracker</h3>
      <div class="tracker-skill-grid">
        ${Object.entries(PSD_LABELS)
          .map(([cat, label]) => {
            const entry = latest[cat];
            return `<div class="tracker-skill">
              <span class="tracker-skill-label">${escapeHtml(label)}</span>
              ${entry ? scoreDots(entry.score) : `<span class="muted">No entry yet</span>`}
            </div>`;
          })
          .join('')}
      </div>
      ${opts.canRecordTrackers ? psdFormHtml() : ''}
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderPsdDetail(container, pupilId, opts));
  if (opts.canRecordTrackers) wirePsdForm(container, pupilId, opts);
}

// ---------- attendance detail ----------

const ATTENDANCE_STATUS_LABELS = {
  present: 'Present',
  late: 'Late',
  authorised_absent: 'Authorised absence',
  unauthorised_absent: 'Unauthorised absence',
};

export async function renderAttendanceDetail(container, pupilId, opts = {}) {
  const [detail, entries] = await Promise.all([api.getPupilDashboard(pupilId), api.getAttendance(pupilId)]);
  const { pupil } = detail;

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts)}
    <a href="#/pupil/${pupilId}" class="back-link">&larr; Back to dashboard</a>
    <div class="card">
      <h3>Attendance</h3>
      ${
        entries.length
          ? `<div class="table-scroll"><table>
              <thead><tr><th>Date</th><th>AM</th><th>PM</th></tr></thead>
              <tbody>
                ${groupAttendanceByDate(entries)
                  .map(
                    (row) => `<tr>
                      <td>${escapeHtml(row.date)}</td>
                      <td>${row.am ? escapeHtml(ATTENDANCE_STATUS_LABELS[row.am]) : '<span class="muted">—</span>'}</td>
                      <td>${row.pm ? escapeHtml(ATTENDANCE_STATUS_LABELS[row.pm]) : '<span class="muted">—</span>'}</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table></div>`
          : `<p class="muted">No entries yet</p>`
      }
      ${opts.canRecordTrackers ? attendanceFormHtml() : ''}
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderAttendanceDetail(container, pupilId, opts));
  if (opts.canRecordTrackers) wireAttendanceForm(container, pupilId, opts);
}

function groupAttendanceByDate(entries) {
  const byDate = {};
  for (const e of entries) {
    byDate[e.entry_date] = byDate[e.entry_date] || { date: e.entry_date };
    byDate[e.entry_date][e.session] = e.status;
  }
  return Object.values(byDate).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function attendanceFormHtml() {
  const today = new Date().toISOString().slice(0, 10);
  const statusOptions = Object.entries(ATTENDANCE_STATUS_LABELS)
    .map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`)
    .join('');
  return `
    <form id="attendance-form" class="tracker-form">
      <div class="row-flex">
        <div class="field">
          <label for="att-date">Date</label>
          <input id="att-date" type="date" value="${today}" />
        </div>
        <div class="field">
          <label for="att-am">Morning</label>
          <select id="att-am"><option value="">— not recorded —</option>${statusOptions}</select>
        </div>
        <div class="field">
          <label for="att-pm">Afternoon</label>
          <select id="att-pm"><option value="">— not recorded —</option>${statusOptions}</select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Save Attendance</button>
    </form>
  `;
}

function wireAttendanceForm(container, pupilId, opts) {
  const form = container.querySelector('#attendance-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entry_date = form.querySelector('#att-date').value;
    const am = form.querySelector('#att-am').value;
    const pm = form.querySelector('#att-pm').value;
    if (!entry_date || (!am && !pm)) return toast('Pick a date and at least one session');
    try {
      if (am) await api.recordAttendance(pupilId, { entry_date, session: 'am', status: am });
      if (pm) await api.recordAttendance(pupilId, { entry_date, session: 'pm', status: pm });
      toast('Attendance saved');
      renderAttendanceDetail(container, pupilId, opts);
    } catch (err) {
      toast(err.message);
    }
  });
}

// ---------- qualifications detail ----------

export async function renderQualificationsDetail(container, pupilId, opts = {}) {
  const [detail, quals] = await Promise.all([api.getPupilDashboard(pupilId), api.getQualifications(pupilId)]);
  const { pupil } = detail;

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts)}
    <a href="#/pupil/${pupilId}" class="back-link">&larr; Back to dashboard</a>
    <div class="card">
      <h3>Qualifications</h3>
      ${
        quals.length
          ? quals
              .map(
                (q) => `
            <div class="qual-row">
              <div class="qual-row-head">
                <span class="tracker-skill-label">${escapeHtml(q.title)}</span>
                <span class="podium-stat-value" style="font-size:1rem">${q.percent}%</span>
              </div>
              <div class="qual-bar"><div class="qual-bar-fill" style="width:${q.percent}%"></div></div>
              ${
                opts.canRecordTrackers
                  ? `<form class="qual-update-form" data-qual-id="${q.id}">
                      <input type="number" min="0" max="100" value="${q.percent}" />
                      <button type="submit" class="btn">Update</button>
                    </form>`
                  : ''
              }
            </div>`
              )
              .join('')
          : `<p class="muted">No entries yet</p>`
      }
      ${opts.canRecordTrackers ? qualificationFormHtml() : ''}
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderQualificationsDetail(container, pupilId, opts));
  if (opts.canRecordTrackers) wireQualificationForms(container, pupilId, opts);
}

function qualificationFormHtml() {
  return `
    <form id="qualification-form" class="tracker-form">
      <div class="row-flex">
        <div class="field">
          <label for="qual-title">Qualification</label>
          <input id="qual-title" type="text" placeholder="e.g. Functional Skills Maths L1" />
        </div>
        <div class="field">
          <label for="qual-percent">Percent complete</label>
          <input id="qual-percent" type="number" min="0" max="100" value="0" />
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Add Qualification</button>
    </form>
  `;
}

function wireQualificationForms(container, pupilId, opts) {
  const addForm = container.querySelector('#qualification-form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = addForm.querySelector('#qual-title').value.trim();
      const percent = Number(addForm.querySelector('#qual-percent').value);
      if (!title) return toast('Enter a qualification name');
      try {
        await api.addQualification(pupilId, { title, percent });
        toast('Qualification added');
        renderQualificationsDetail(container, pupilId, opts);
      } catch (err) {
        toast(err.message);
      }
    });
  }
  container.querySelectorAll('.qual-update-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const percent = Number(form.querySelector('input').value);
      try {
        await api.updateQualification(pupilId, form.dataset.qualId, { percent });
        toast('Updated');
        renderQualificationsDetail(container, pupilId, opts);
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

// ---------- feedback detail ----------

export async function renderFeedbackDetail(container, pupilId, opts = {}) {
  const [detail, entries] = await Promise.all([api.getPupilDashboard(pupilId), api.getFeedback(pupilId)]);
  const { pupil } = detail;

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts)}
    <a href="#/pupil/${pupilId}" class="back-link">&larr; Back to dashboard</a>
    ${opts.canRecordTrackers ? `<div class="card">${feedbackFormHtml()}</div>` : ''}
    <div class="feedback-list">
      ${
        entries.length
          ? entries
              .map(
                (f) => `
            <div class="paper-card feedback-note">
              <p class="feedback-note-body">${escapeHtml(f.body)}</p>
              <div class="feedback-note-meta">— ${escapeHtml(f.author_name)}, ${new Date(f.created_at).toLocaleDateString()}</div>
            </div>`
              )
              .join('')
          : `<p class="muted">No feedback yet</p>`
      }
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderFeedbackDetail(container, pupilId, opts));
  if (opts.canRecordTrackers) wireFeedbackForm(container, pupilId, opts);
}

function feedbackFormHtml() {
  return `
    <form id="feedback-form" class="tracker-form">
      <div class="field">
        <label for="fb-body">Leave feedback for this pupil</label>
        <textarea id="fb-body" rows="3" placeholder="e.g. Great improvement in your Maths work this week — keep it up."></textarea>
      </div>
      <button type="submit" class="btn btn-primary">Post Feedback</button>
    </form>
  `;
}

function wireFeedbackForm(container, pupilId, opts) {
  const form = container.querySelector('#feedback-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.querySelector('#fb-body').value.trim();
    if (!body) return toast('Write something first');
    try {
      await api.addFeedback(pupilId, { body });
      toast('Feedback posted');
      renderFeedbackDetail(container, pupilId, opts);
    } catch (err) {
      toast(err.message);
    }
  });
}

// ---------- coming-soon detail ----------

export async function renderComingSoonDetail(container, pupilId, tileKey, opts = {}) {
  const tile = TILES.find((t) => t.key === tileKey);
  const detail = await api.getPupilDashboard(pupilId);
  const { pupil } = detail;

  container.innerHTML = `
    ${pupilHeaderHtml(pupil, opts)}
    <a href="#/pupil/${pupilId}" class="back-link">&larr; Back to dashboard</a>
    <div class="card center" style="padding:3rem 2rem">
      <h3>${escapeHtml(tile ? tile.title : 'Coming soon')}</h3>
      <p class="muted">${escapeHtml(tile ? tile.note : "This tracker isn't built yet.")}</p>
      <span class="pill">Coming soon</span>
    </div>
  `;

  wireHeaderAvatar(container, pupilId, opts, () => renderComingSoonDetail(container, pupilId, tileKey, opts));
}

export function isKnownTile(key) {
  return TILES.some((t) => t.key === key);
}

// ---------- forms ----------

function academicFormHtml() {
  return `
    <form id="academic-form" class="tracker-form">
      <div class="row-flex">
        <div class="field">
          <label for="ac-subject">Subject</label>
          <select id="ac-subject">
            <option value="english">English</option>
            <option value="maths">Maths</option>
            <option value="other">Other Subjects</option>
          </select>
        </div>
        <div class="field">
          <label for="ac-skill">Skill</label>
          <select id="ac-skill"></select>
        </div>
        <div class="field">
          <label for="ac-score">Score (1-5)</label>
          <input id="ac-score" type="number" min="1" max="5" value="3" />
        </div>
      </div>
      <div class="field">
        <label for="ac-note">Note (optional)</label>
        <input id="ac-note" type="text" placeholder="e.g. Confidently sounding out new words" />
      </div>
      <button type="submit" class="btn btn-primary">Add Entry</button>
    </form>
  `;
}

function psdFormHtml() {
  return `
    <form id="psd-form" class="tracker-form">
      <div class="row-flex">
        <div class="field">
          <label for="psd-category">Category</label>
          <select id="psd-category">
            <option value="attendance_and_learning">Attendance & Learning</option>
            <option value="respect_to_others">Respect to Others</option>
            <option value="positive_pathway">Creating Own Positive Pathway</option>
            <option value="making_friends">Making Friends</option>
            <option value="arriving_on_time">Arriving on Time</option>
            <option value="activities_outside_school">Activities Outside School</option>
          </select>
        </div>
        <div class="field">
          <label for="psd-score">Score (1-5)</label>
          <input id="psd-score" type="number" min="1" max="5" value="3" />
        </div>
      </div>
      <div class="field">
        <label for="psd-note">Note (optional)</label>
        <input id="psd-note" type="text" />
      </div>
      <button type="submit" class="btn btn-primary">Add Entry</button>
    </form>
  `;
}

const ACADEMIC_SKILLS = {
  english: ['reading', 'writing', 'speaking', 'listening'],
  maths: ['adding', 'subtracting', 'multiplication', 'division'],
  other: ['science', 'history', 'geography', 'creative_arts'],
};

function wireAcademicForm(container, pupilId, opts) {
  const form = container.querySelector('#academic-form');
  if (!form) return;
  const subjectSelect = form.querySelector('#ac-subject');
  const skillSelect = form.querySelector('#ac-skill');
  function syncSkills() {
    skillSelect.innerHTML = ACADEMIC_SKILLS[subjectSelect.value]
      .map((s) => `<option value="${s}">${s.replace('_', ' ')}</option>`)
      .join('');
  }
  subjectSelect.addEventListener('change', syncSkills);
  syncSkills();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.recordAcademicProgress(pupilId, {
        subject_area: subjectSelect.value,
        skill: skillSelect.value,
        score: Number(form.querySelector('#ac-score').value),
        note: form.querySelector('#ac-note').value.trim(),
      });
      toast('Progress recorded');
      renderAcademicDetail(container, pupilId, opts);
    } catch (err) {
      toast(err.message);
    }
  });
}

function wirePsdForm(container, pupilId, opts) {
  const form = container.querySelector('#psd-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.recordPsd(pupilId, {
        category: form.querySelector('#psd-category').value,
        score: Number(form.querySelector('#psd-score').value),
        note: form.querySelector('#psd-note').value.trim(),
      });
      toast('PSD entry recorded');
      renderPsdDetail(container, pupilId, opts);
    } catch (err) {
      toast(err.message);
    }
  });
}
