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
        <div class="table-scroll">
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
  const [sets, aiStatus] = await Promise.all([api.getQuestionSets(), api.getAiStatus().catch(() => ({ configured: false }))]);

  // Draft state for the "New question set" card — a plain array of
  // {question_text, answer_text, options}, edited in place and re-rendered
  // locally (not a full tab refetch) on Add/Generate/Remove.
  let draft = [{ question_text: '', answer_text: '', options: null }, { question_text: '', answer_text: '', options: null }, { question_text: '', answer_text: '', options: null }];
  let draftTerm = '';
  let draftSubject = '';

  body.innerHTML = `
    <div class="card" id="new-set-card"></div>
    <div class="card">
      <h3>Existing sets (${sets.length})</h3>
      <div class="table-scroll">
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
    </div>
  `;

  const newSetCard = body.querySelector('#new-set-card');

  function paintNewSetCard() {
    newSetCard.innerHTML = `
      <h3>New question set</h3>
      ${aiWizardHtml(aiStatus.configured)}
      <div class="row-flex">
        <div class="field"><label>Term</label><input id="qs-term" type="text" placeholder="e.g. Autumn 1" value="${escapeHtml(draftTerm)}" /></div>
        <div class="field"><label>Subject</label><input id="qs-subject" type="text" placeholder="e.g. Maths" value="${escapeHtml(draftSubject)}" /></div>
      </div>
      ${draft
        .map(
          (q, i) => `
        <div class="card" style="background:var(--bg-raised)">
          <div class="field">
            <label>Question ${i + 1}</label>
            <input type="text" data-q-text="${i}" placeholder="Question text" value="${escapeHtml(q.question_text)}" />
          </div>
          <div class="row-flex">
            <div class="field">
              <label>Correct answer</label>
              <input type="text" data-q-answer="${i}" placeholder="Exact answer" value="${escapeHtml(q.answer_text)}" />
            </div>
            <div class="field">
              <label>Options (optional, comma-separated incl. the answer)</label>
              <input type="text" data-q-options="${i}" placeholder="e.g. Paris, London, Rome, Berlin" value="${escapeHtml((q.options || []).join(', '))}" />
            </div>
          </div>
          ${draft.length > 3 ? `<button type="button" class="btn" data-remove-block="${i}">Remove</button>` : ''}
        </div>`
        )
        .join('')}
      <div class="row-flex" style="margin-top:0.5rem">
        <button type="button" id="add-block-btn" class="btn">+ Add question</button>
        <button type="button" id="save-set-btn" class="btn btn-primary">Save Question Set</button>
      </div>
    `;
    wireNewSetCard();
  }

  function syncDraftFromInputs() {
    draftTerm = newSetCard.querySelector('#qs-term').value;
    draftSubject = newSetCard.querySelector('#qs-subject').value;
    draft = draft.map((_, i) => ({
      question_text: newSetCard.querySelector(`[data-q-text="${i}"]`).value,
      answer_text: newSetCard.querySelector(`[data-q-answer="${i}"]`).value,
      options: (() => {
        const raw = newSetCard.querySelector(`[data-q-options="${i}"]`).value.trim();
        return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : null;
      })(),
    }));
  }

  function wireNewSetCard() {
    newSetCard.querySelector('#add-block-btn').addEventListener('click', () => {
      syncDraftFromInputs();
      draft.push({ question_text: '', answer_text: '', options: null });
      paintNewSetCard();
    });

    newSetCard.querySelectorAll('[data-remove-block]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftFromInputs();
        draft.splice(Number(btn.dataset.removeBlock), 1);
        paintNewSetCard();
      });
    });

    const genBtn = newSetCard.querySelector('#ai-generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', async () => {
        const subject = newSetCard.querySelector('#ai-subject').value.trim();
        if (!subject) return toast('Enter a subject for the AI to write questions about');
        const topic = newSetCard.querySelector('#ai-topic').value.trim();
        const level = newSetCard.querySelector('#ai-level').value.trim();
        const senFriendly = newSetCard.querySelector('#ai-sen').checked;
        const count = Number(newSetCard.querySelector('#ai-count').value) || 3;
        genBtn.disabled = true;
        genBtn.textContent = 'Generating…';
        try {
          const { questions } = await api.generateQuestions({ subject, topic, level, senFriendly, count });
          draftSubject = subject;
          draft = questions;
          paintNewSetCard();
          toast('Draft questions ready — check them over before saving');
        } catch (e) {
          toast(e.message);
          genBtn.disabled = false;
          genBtn.textContent = 'Generate Questions';
        }
      });
    }

    newSetCard.querySelector('#save-set-btn').addEventListener('click', async () => {
      syncDraftFromInputs();
      const term = draftTerm.trim();
      const subject = draftSubject.trim();
      const questions = draft.map((q) => ({ question_text: q.question_text.trim(), answer_text: q.answer_text.trim(), options: q.options }));
      if (!term || !subject || questions.length < 3 || questions.some((q) => !q.question_text || !q.answer_text)) {
        return toast('Fill in term, subject, and at least 3 questions + answers');
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

  paintNewSetCard();

  body.querySelectorAll('[data-delete-set]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this question set?')) return;
      await api.deleteQuestionSet(btn.dataset.deleteSet);
      renderQuestionsTab(body);
    });
  });
}

function aiWizardHtml(configured) {
  if (!configured) {
    return `
      <div class="card" style="background:var(--bg-raised)">
        <h4 style="margin-top:0">Generate with AI</h4>
        <p class="muted">Not set up yet — add <code>ANTHROPIC_API_KEY</code> to this deployment's environment variables to turn this on. Until then, write question sets by hand below.</p>
      </div>`;
  }
  return `
    <div class="card" style="background:var(--bg-raised)">
      <h4 style="margin-top:0">Generate with AI</h4>
      <p class="muted">Useful for SEN pupils — describe the level and it'll write in plain, unambiguous language.</p>
      <div class="row-flex">
        <div class="field"><label>Subject</label><input id="ai-subject" type="text" placeholder="e.g. Maths" /></div>
        <div class="field"><label>Topic (optional)</label><input id="ai-topic" type="text" placeholder="e.g. Adding to 20" /></div>
      </div>
      <div class="row-flex">
        <div class="field"><label>Pupil level (optional)</label><input id="ai-level" type="text" placeholder="e.g. Year 7, working below age-related expectations" /></div>
        <div class="field"><label>How many questions</label>
          <select id="ai-count">
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </div>
      </div>
      <label class="checkbox-pill" style="margin-bottom:1rem">
        <input type="checkbox" id="ai-sen" /> SEN-friendly (simpler language, shorter sentences)
      </label>
      <button type="button" id="ai-generate-btn" class="btn btn-primary">Generate Questions</button>
    </div>`;
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

// ---------- classes ----------

async function renderClassesTab(body) {
  const classes = await api.getClasses();
  body.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>Create a class</h3>
        <div class="field">
          <label for="new-class-name">Name</label>
          <input id="new-class-name" type="text" placeholder="e.g. Year 10 Falcons" />
        </div>
        <div class="field">
          <label for="new-class-photo">Class photo (optional)</label>
          <input id="new-class-photo" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <button id="add-class-btn" class="btn btn-primary">Create Class</button>
      </div>
      <div class="card">
        <h3>Classes (${classes.length})</h3>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Class</th><th>Colour</th><th></th></tr></thead>
            <tbody>
              ${classes
                .map(
                  (c) => `
                <tr>
                  <td>
                    <span class="class-badge" style="--row-colour:${c.colourHex}">
                      ${c.photoUrl ? `<img src="${c.photoUrl}" alt="" class="class-thumb" />` : '<span class="class-dot"></span>'}
                      ${escapeHtml(c.name)}
                    </span>
                  </td>
                  <td>${c.colourHex}</td>
                  <td><button class="btn" data-delete-class="${c.id}">Delete</button></td>
                </tr>`
                )
                .join('') || `<tr><td colspan="3" class="muted">No classes yet — create the first one.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  body.querySelector('#add-class-btn').addEventListener('click', async () => {
    const name = body.querySelector('#new-class-name').value.trim();
    if (!name) return toast('Enter a class name first');
    const photoFile = body.querySelector('#new-class-photo').files[0];
    try {
      const created = await api.createClass({ name });
      if (photoFile) await api.uploadClassPhoto(created.id, photoFile);
      toast(`${name} created`);
      renderClassesTab(body);
    } catch (e) {
      toast(e.message);
    }
  });

  body.querySelectorAll('[data-delete-class]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this class? Only possible while it has no pupils in it.')) return;
      try {
        await api.deleteClass(btn.dataset.deleteClass);
        toast('Class deleted');
        renderClassesTab(body);
      } catch (e) {
        toast(e.message);
      }
    });
  });
}
