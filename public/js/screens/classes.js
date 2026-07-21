import { api } from '../api.js';
import { escapeHtml } from '../util.js';

export async function renderClasses(container) {
  const classes = await api.getClassStandings();

  container.innerHTML = `
    <h1 class="screen-title">Constructors' Board</h1>
    <p class="screen-sub">Class score = average points per pupil, so a small class can still fight for the title.</p>
    <div class="board">
      ${classes
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
        .join('')}
    </div>
  `;
}
