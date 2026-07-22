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

const COMING_SOON = [
  { title: 'Sporting', note: 'Sport-specific achievements and progress.' },
  { title: 'Business & Enterprise', note: 'Enterprise projects and business skills.' },
  { title: 'Attendance Tracker', note: 'Day-by-day attendance record.' },
  { title: 'Strengths Profile', note: "Based on Clifton Strengths." },
  { title: 'Educational Enhancements', note: 'DofE, outdoor learning, enrichment activities, guest speakers, work experience, community projects, creative & performing arts.' },
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

export async function renderPupilDetail(container, pupilId, opts = {}) {
  const { canUploadAvatar, canRecordTrackers } = opts;
  const detail = await api.getPupilDashboard(pupilId);
  const { pupil, academicProgress, psd } = detail;
  const latestAcademic = latestBySkill(academicProgress);
  const latestPsd = latestBySkill(psd);

  container.innerHTML = `
    <div class="pupil-header card" style="--row-colour:${pupil.colour_hex}">
      <div class="pupil-header-main">
        ${pupil.profile_id ? avatarHtml(pupil.profile_id, pupil.name, 88) : `<span class="avatar avatar-fallback" style="--avatar-size:88px">${escapeHtml(pupil.name[0] || '?')}</span>`}
        <div>
          <h1 class="screen-title" style="margin-bottom:0.3rem">${escapeHtml(pupil.name)}</h1>
          <span class="class-badge" style="--row-colour:${pupil.colour_hex}"><span class="class-dot"></span>${escapeHtml(pupil.class_name)}</span>
          <span class="pupil-points">${pupil.season_points} season pts</span>
        </div>
      </div>
      ${canUploadAvatar ? `
        <div class="avatar-upload">
          <label class="btn" for="avatar-file">Change photo</label>
          <input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
        </div>` : ''}
    </div>

    <div class="grid-2">
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
                  const entry = latestAcademic[`${area}:${skill}`];
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
        ${canRecordTrackers ? academicFormHtml() : ''}
      </div>

      <div class="card">
        <h3>PSD Tracker</h3>
        <div class="tracker-skill-grid">
          ${Object.entries(PSD_LABELS)
            .map(([cat, label]) => {
              const entry = latestPsd[cat];
              return `<div class="tracker-skill">
                <span class="tracker-skill-label">${escapeHtml(label)}</span>
                ${entry ? scoreDots(entry.score) : `<span class="muted">No entry yet</span>`}
              </div>`;
            })
            .join('')}
        </div>
        ${canRecordTrackers ? psdFormHtml() : ''}
      </div>
    </div>

    <h3 class="coming-soon-title">More on the way</h3>
    <div class="coming-soon-grid">
      ${COMING_SOON.map((c) => `
        <div class="card coming-soon-card">
          <h4>${escapeHtml(c.title)}</h4>
          <p class="muted">${escapeHtml(c.note)}</p>
          <span class="pill">Coming soon</span>
        </div>`).join('')}
    </div>
  `;

  wireAvatarFallbacks(container);

  if (canUploadAvatar) {
    container.querySelector('#avatar-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await api.uploadMyAvatar(file);
        toast('Photo updated');
        renderPupilDetail(container, pupilId, opts);
      } catch (err) {
        toast(err.message);
      }
    });
  }

  if (canRecordTrackers) {
    wireAcademicForm(container, pupilId, opts);
    wirePsdForm(container, pupilId, opts);
  }
}

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
      renderPupilDetail(container, pupilId, opts);
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
      renderPupilDetail(container, pupilId, opts);
    } catch (err) {
      toast(err.message);
    }
  });
}
