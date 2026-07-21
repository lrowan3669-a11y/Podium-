import { api } from '../api.js';
import { escapeHtml } from '../util.js';
import { playCue } from '../sound.js';

export async function renderPlay(container) {
  const [pupils, questionSets] = await Promise.all([api.getPupils(), api.getQuestionSets()]);

  if (!pupils.length || !questionSets.length) {
    container.innerHTML = `
      <h1 class="screen-title">Question Mode</h1>
      <div class="empty-state">
        ${!pupils.length ? 'Add some pupils' : 'Create a question set'} in Teacher Admin before starting a round.
      </div>`;
    return;
  }

  renderSetup(container, pupils, questionSets);
}

function renderSetup(container, pupils, questionSets) {
  container.innerHTML = `
    <div class="question-wrap">
      <h1 class="screen-title">Question Mode</h1>
      <p class="screen-sub">Teacher-driven: pick who's up, pick the topic, go.</p>
      <div class="card">
        <div class="field">
          <label for="pupil-select">Pupil</label>
          <select id="pupil-select">
            ${pupils.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${escapeHtml(p.class_name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="set-select">Question set</label>
          <select id="set-select">
            ${questionSets
              .map((qs) => `<option value="${qs.id}">${escapeHtml(qs.term)} — ${escapeHtml(qs.subject)} (${qs.question_count} qs)</option>`)
              .join('')}
          </select>
        </div>
        <button id="start-btn" class="btn btn-primary btn-huge">Start 3 Questions</button>
      </div>
    </div>
  `;

  container.querySelector('#start-btn').addEventListener('click', async () => {
    const pupilId = Number(container.querySelector('#pupil-select').value);
    const setId = Number(container.querySelector('#set-select').value);
    const pupil = pupils.find((p) => p.id === pupilId);
    const questionSet = await api.getQuestionSetToPlay(setId);
    if (questionSet.questions.length < 1) return;
    runRound(container, pupil, questionSet);
  });
}

function runRound(container, pupil, questionSet) {
  const answers = new Array(questionSet.questions.length).fill('');
  let index = 0;

  function renderQuestion() {
    const q = questionSet.questions[index];
    container.innerHTML = `
      <div class="question-wrap">
        <h1 class="screen-title">${escapeHtml(pupil.name)}</h1>
        <p class="screen-sub">${escapeHtml(questionSet.term)} · ${escapeHtml(questionSet.subject)} — Question ${index + 1} of ${questionSet.questions.length}</p>
        <div class="question-progress">
          ${questionSet.questions.map((_, i) => `<span class="${i < index ? 'done' : ''}"></span>`).join('')}
        </div>
        <div class="question-card">
          <p class="question-text">${escapeHtml(q.question_text)}</p>
          ${
            q.options && q.options.length
              ? `<div class="option-grid">
                  ${q.options.map((opt) => `<button class="option-btn" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
                 </div>`
              : `<div class="freetext-row">
                  <input type="text" id="freetext-input" placeholder="Type the answer…" autofocus />
                  <button id="freetext-submit" class="btn btn-primary">Submit</button>
                 </div>`
          }
        </div>
      </div>
    `;

    if (q.options && q.options.length) {
      container.querySelectorAll('.option-btn').forEach((btn) => {
        btn.addEventListener('click', () => submitAnswer(btn.dataset.value));
      });
    } else {
      const input = container.querySelector('#freetext-input');
      const submit = () => submitAnswer(input.value);
      container.querySelector('#freetext-submit').addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }
  }

  function submitAnswer(value) {
    answers[index] = value;
    index += 1;
    if (index < questionSet.questions.length) {
      renderQuestion();
    } else {
      finish();
    }
  }

  async function finish() {
    container.innerHTML = `<div class="empty-state">Marking…</div>`;
    try {
      const result = await api.submitAttempt({
        pupil_id: pupil.id,
        question_set_id: questionSet.id,
        answers,
      });
      playCue(result.class.id);
      showResult(result);
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Could not submit: ${escapeHtml(e.message)}</div>`;
    }
  }

  function showResult(result) {
    container.innerHTML = `
      <div class="question-wrap">
        <div class="result-banner" style="--row-colour:${result.class.colourHex}">
          <p class="result-flourish">${escapeHtml(result.flourish)}</p>
          <p class="result-score">${result.score} / ${result.total} correct</p>
        </div>
        <div class="center mt-2">
          <button id="again-btn" class="btn btn-primary btn-huge">Next Pupil</button>
        </div>
      </div>
    `;
    container.querySelector('#again-btn').addEventListener('click', async () => {
      const [pupils, questionSets] = await Promise.all([api.getPupils(), api.getQuestionSets()]);
      renderSetup(container, pupils, questionSets);
    });
  }

  renderQuestion();
}
