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
        <div class="row-name">${c.photo_url ? `<img src="${c.photo_url}" alt="" class="class-thumb" />` : ''}${escapeHtml(c.name)}</div>
        <div class="row-meta">${c.namesake ? escapeHtml(c.namesake) + ' · ' : ''}${c.pupil_count} pupil${c.pupil_count === 1 ? '' : 's'}${c.unit_label ? ` · 1pt = ${escapeHtml(c.unit_label)}` : ''}</div>
      </div>
      <div class="row-points">${c.average.toFixed(1)}<small>avg/pupil</small></div>
    </div>`
    )
    .join('');
}

// Reuses the season-long standings data already fetched for the board below
// — "of the year" isn't a separate tally, it's just this season's #1, given
// a celebratory frame instead of just being row one of a table.
function yearChampionHtml(label, leader, pointsText) {
  if (!leader || (leader.points !== undefined ? leader.points <= 0 : leader.total_points <= 0)) return '';
  return `
    <div class="paper-card champion-card year-champion" style="--row-colour:${leader.colour_hex}">
      <p class="champion-label">${escapeHtml(label)}</p>
      <p class="champion-name">${escapeHtml(leader.name)}</p>
      <p class="champion-points">${pointsText(leader)}</p>
    </div>`;
}

const TABS = {
  individual: {
    title: 'Student Leaderboard',
    sub: 'Season-long — never resets. This season\'s #1 is Student of the Year.',
  },
  classes: {
    title: 'Class Leaderboard',
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
        <button type="button" class="tab-btn ${tab === 'individual' ? 'active' : ''}" data-tab="individual">Students</button>
        <button type="button" class="tab-btn ${tab === 'classes' ? 'active' : ''}" data-tab="classes">Classes</button>
      </div>
      <div id="standings-champion"></div>
      <div class="board" id="standings-board"><div class="empty-state">Loading…</div></div>
    `;
    container.querySelectorAll('#standings-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === tab) return;
        tab = btn.dataset.tab;
        paint();
      });
    });

    const championEl = container.querySelector('#standings-champion');
    const boardEl = container.querySelector('#standings-board');
    if (tab === 'individual') {
      const pupils = await api.getIndividualStandings();
      championEl.innerHTML = yearChampionHtml('Student of the Year', pupils[0], (p) => `${p.points} pts`);
      boardEl.innerHTML = individualRows(pupils);
    } else {
      const classes = await api.getClassStandings();
      championEl.innerHTML = yearChampionHtml('Class of the Year', classes[0], (c) => `${c.average.toFixed(1)} avg/pupil`);
      boardEl.innerHTML = classRows(classes);
    }
  }

  await paint();
}

export const renderClasses = (container) => renderIndividual(container, ['classes']);
