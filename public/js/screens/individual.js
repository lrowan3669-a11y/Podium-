import { api } from '../api.js';
import { escapeHtml } from '../util.js';

function individualRows(pupils) {
  if (!pupils.length) return `<div class="empty-state">No pupils yet — add some in Teacher Admin.</div>`;
  return pupils
    .map(
      (p) => `
    <div class="row rank-${p.rank}" style="--row-colour:${p.colour_hex}">
      <div class="row-rank">${p.rank}</div>
      <div class="row-main">
        <div class="row-name">${escapeHtml(p.name)}</div>
        <span class="class-badge" style="--row-colour:${p.colour_hex}">
          <span class="class-dot"></span>${escapeHtml(p.class_name)}
        </span>
      </div>
      <div class="row-points">${p.points}<small>pts</small></div>
    </div>`
    )
    .join('');
}

function classRows(classes) {
  if (!classes.length) return `<div class="empty-state">No classes yet.</div>`;
  return classes
    .map(
      (c) => `
    <div class="row rank-${c.rank}" style="--row-colour:${c.colour_hex}">
      <div class="row-rank">${c.rank}</div>
      <div class="row-main">
        <div class="row-name">${escapeHtml(c.name)}</div>
        <div class="row-meta">${escapeHtml(c.namesake)} · ${c.pupil_count} pupil${c.pupil_count === 1 ? '' : 's'} · 1pt = ${escapeHtml(c.unit_label)}</div>
      </div>
      <div class="row-points">${c.average.toFixed(1)}<small>avg/pupil</small></div>
    </div>`
    )
    .join('');
}

const TABS = {
  individual: {
    title: 'Individual Standings',
    sub: 'Season-long championship — never resets.',
  },
  classes: {
    title: "Constructors' Board",
    sub: 'Class score = average points per pupil, so a small class can still fight for the title.',
  },
};

export async function renderIndividual(container, params) {
  let tab = params && params[0] === 'classes' ? 'classes' : 'individual';

  async function paint() {
    const copy = TABS[tab];
    container.innerHTML = `
      <h1 class="screen-title">${copy.title}</h1>
      <p class="screen-sub">${copy.sub}</p>
      <div class="tabs" id="standings-tabs">
        <button type="button" class="tab-btn ${tab === 'individual' ? 'active' : ''}" data-tab="individual">Individual</button>
        <button type="button" class="tab-btn ${tab === 'classes' ? 'active' : ''}" data-tab="classes">Constructors'</button>
      </div>
      <div class="board" id="standings-board"><div class="empty-state">Loading…</div></div>
    `;
    container.querySelectorAll('#standings-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === tab) return;
        tab = btn.dataset.tab;
        paint();
      });
    });

    const boardEl = container.querySelector('#standings-board');
    if (tab === 'individual') {
      const pupils = await api.getIndividualStandings();
      boardEl.innerHTML = individualRows(pupils);
    } else {
      const classes = await api.getClassStandings();
      boardEl.innerHTML = classRows(classes);
    }
  }

  await paint();
}

export const renderClasses = (container) => renderIndividual(container, ['classes']);
