import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';

const TABS = ['pupils', 'questions', 'award', 'classes'];
let activeTab = 'pupils';

export async function renderAdmin(container) {
  container.innerHTML = `
    <h1 class="screen-title">Teacher Admin</h1>
    <div class="tabs">
      ${TABS.map((t) => `<button class="tab-btn ${t === activeTab ? 'active' : ''}" data-tab="${t}">${labelFor(t)}</button>`).join('')}
    </div>
    <div id="admin-tab-body"></div>
  `;

  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderAdmin(container);
    });
  });

  const body = container.querySelector('#admin-tab-body');
  if (activeTab === 'pupils') await renderPupilsTab(body);
  else if (activeTab === 'questions') await renderQuestionsTab(body);
  else if (activeTab === 'award') await renderAwardTab(body);
  else await renderClassesTab(body);
}

function labelFor(t) {
  return { pupils: 'Pupils', questions: 'Question Sets', award: 'Award Points', classes: 'Classes' }[t];
}

// ---------- pupils ----------

async function renderPupilsTab(body) {
  const [pupils, classes] = await Promise.all([api.getPupils(), api.getClasses()]);

  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>Add pupil</h3>
        <div class="field">
          <label for="new-pupil-name">Name</label>
          <input id="new-pupil-name" type="text" placeholder="Pupil name" />
        </div>
        <div class="field">
          <label for="new-pupil-class">Class</label>
          <select id="new-pupil-class">
            ${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <button id="add-pupil-btn" class="btn btn-primary">Add Pupil</button>
      </div>
      <div class="card">
        <h3>Roster (${pupils.length})</h3>
        <table>
          <thead><tr><th>Name</th><th>Class</th><th>Season</th><th></th></tr></thead>
          <tbody>
            ${pupils
              .map(
                (p) => `
              <tr>
                <td>${escapeHtml(p.name)}</td>
                <td>
                  <select data-pupil-class="${p.id}">
                    ${classes.map((c) => `<option value="${c.id}" ${c.id === p.class_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </td>
                <td>${p.season_points}</td>
                <td><button class="btn" data-delete-pupil="${p.id}">Remove</button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  body.querySelector('#add-pupil-btn').addEventListener('click', async () => {
    const name = body.querySelector('#new-pupil-name').value.trim();
    const class_id = body.querySelector('#new-pupil-class').value;
    if (!name) return toast('Enter a name first');
    await api.createPupil({ name, class_id });
    toast(`${name} added`);
    renderPupilsTab(body);
  });

  body.querySelectorAll('[data-pupil-class]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      await api.updatePupil(sel.dataset.pupilClass, { class_id: sel.value });
      toast('Pupil moved');
    });
  });

  body.querySelectorAll('[data-delete-pupil]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this pupil? Their history is kept but they will drop off the leaderboard.')) return;
      await api.deletePupil(btn.dataset.deletePupil);
      renderPupilsTab(body);
    });
  });
}

// ---------- question sets ----------

async function renderQuestionsTab(body) {
  const sets = await api.getQuestionSets();

  body.innerHTML = `
    <div class="card">
      <h3>New question set</h3>
      ${questionFormHtml()}
    </div>
    <div class="card">
      <h3>Existing sets (${sets.length})</h3>
      <table>
        <thead><tr><th>Term</th><th>Subject</th><th>Questions</th><th></th></tr></thead>
        <tbody>
          ${sets
            .map(
              (qs) => `
            <tr>
              <td>${escapeHtml(qs.term)}</td>
              <td>${escapeHtml(qs.subject)}</td>
              <td>${qs.question_count}</td>
              <td><button class="btn" data-delete-set="${qs.id}">Delete</button></td>
            </tr>`
            )
            .join('') || `<tr><td colspan="4" class="muted">No question sets yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  wireQuestionForm(body);

  body.querySelectorAll('[data-delete-set]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this question set?')) return;
      await api.deleteQuestionSet(btn.dataset.deleteSet);
      renderQuestionsTab(body);
    });
  });
}

function questionFormHtml() {
  const blocks = [0, 1, 2]
    .map(
      (i) => `
    <div class="card" style="background:var(--bg-raised)">
      <div class="field">
        <label>Question ${i + 1}</label>
        <input type="text" data-q-text="${i}" placeholder="Question text" />
      </div>
      <div class="row-flex">
        <div class="field">
          <label>Correct answer</label>
          <input type="text" data-q-answer="${i}" placeholder="Exact answer" />
        </div>
        <div class="field">
          <label>Options (optional, comma-separated incl. the answer)</label>
          <input type="text" data-q-options="${i}" placeholder="e.g. Paris, London, Rome, Berlin" />
        </div>
      </div>
    </div>`
    )
    .join('');

  return `
    <div class="row-flex">
      <div class="field"><label>Term</label><input id="qs-term" type="text" placeholder="e.g. Autumn 1" /></div>
      <div class="field"><label>Subject</label><input id="qs-subject" type="text" placeholder="e.g. Maths" /></div>
    </div>
    ${blocks}
    <button id="save-set-btn" class="btn btn-primary">Save Question Set</button>
  `;
}

function wireQuestionForm(body) {
  body.querySelector('#save-set-btn').addEventListener('click', async () => {
    const term = body.querySelector('#qs-term').value.trim();
    const subject = body.querySelector('#qs-subject').value.trim();
    const questions = [0, 1, 2].map((i) => {
      const question_text = body.querySelector(`[data-q-text="${i}"]`).value.trim();
      const answer_text = body.querySelector(`[data-q-answer="${i}"]`).value.trim();
      const optionsRaw = body.querySelector(`[data-q-options="${i}"]`).value.trim();
      const options = optionsRaw ? optionsRaw.split(',').map((s) => s.trim()).filter(Boolean) : null;
      return { question_text, answer_text, options };
    });
    if (!term || !subject || questions.some((q) => !q.question_text || !q.answer_text)) {
      return toast('Fill in term, subject, and all 3 questions + answers');
    }
    try {
      await api.createQuestionSet({ term, subject, questions });
      toast('Question set saved');
      renderQuestionsTab(body);
    } catch (e) {
      toast(e.message);
    }
  });
}

// ---------- manual award ----------

async function renderAwardTab(body) {
  const pupils = await api.getPupils();
  body.innerHTML = `
    <div class="card">
      <h3>Manual award</h3>
      <p class="muted">For bonus points, corrections, or off-app achievements.</p>
      <div class="field">
        <label>Pupil</label>
        <select id="award-pupil">${pupils.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${escapeHtml(p.class_name)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Points (can be negative)</label>
        <input id="award-points" type="number" value="1" />
      </div>
      <div class="field">
        <label>Note (optional)</label>
        <input id="award-note" type="text" placeholder="e.g. Great effort in assembly" />
      </div>
      <button id="award-btn" class="btn btn-primary">Award Points</button>
    </div>
  `;

  body.querySelector('#award-btn').addEventListener('click', async () => {
    const pupil_id = Number(body.querySelector('#award-pupil').value);
    const points = Number(body.querySelector('#award-points').value);
    const note = body.querySelector('#award-note').value.trim();
    if (!Number.isFinite(points)) return toast('Enter a valid number of points');
    await api.awardManual({ pupil_id, points, note });
    toast('Award recorded');
  });
}

// ---------- classes overview ----------

async function renderClassesTab(body) {
  const classes = await api.getClasses();
  body.innerHTML = `
    <div class="card">
      <h3>Classes (fixed roster of five)</h3>
      <table>
        <thead><tr><th>Class</th><th>Namesake</th><th>Sport</th><th>1 point =</th><th>Colour</th></tr></thead>
        <tbody>
          ${classes
            .map(
              (c) => `
            <tr>
              <td><span class="class-badge" style="--row-colour:${c.colourHex}"><span class="class-dot"></span>${escapeHtml(c.name)}</span></td>
              <td>${escapeHtml(c.namesake)}</td>
              <td>${escapeHtml(c.sportTheme)}</td>
              <td>${escapeHtml(c.unitLabel)}</td>
              <td>${c.colourHex}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
