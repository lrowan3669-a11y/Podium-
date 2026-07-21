import { api } from '../api.js';
import { escapeHtml } from '../util.js';

export async function renderIndividual(container) {
  const pupils = await api.getIndividualStandings();

  container.innerHTML = `
    <h1 class="screen-title">Individual Standings</h1>
    <p class="screen-sub">Season-long championship — never resets.</p>
    <div class="board">
      ${
        pupils.length
          ? pupils
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
              .join('')
          : `<div class="empty-state">No pupils yet — add some in Teacher Admin.</div>`
      }
    </div>
  `;
}
