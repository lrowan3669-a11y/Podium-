import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';

export async function renderWeekly(container) {
  const data = await api.getWeeklyStandings();
  container.innerHTML = renderWeeklyHtml(data);

  const advanceBtn = container.querySelector('#advance-week-btn');
  if (advanceBtn) {
    advanceBtn.addEventListener('click', async () => {
      if (!confirm(`Advance to Week ${data.week + 1}? This locks in Week ${data.week}'s winners and starts a fresh weekly count.`)) return;
      advanceBtn.disabled = true;
      try {
        await api.advanceWeek();
        toast(`Week advanced — welcome to Week ${data.week + 1}`);
        await renderWeekly(container);
      } catch (e) {
        toast(e.message);
        advanceBtn.disabled = false;
      }
    });
  }
}

function renderWeeklyHtml(data) {
  const { week, champion, classChampion, pupilRows, classRows } = data;
  return `
    <h1 class="screen-title">Weekly Winners — Week ${week}</h1>
    <p class="screen-sub">Highest points banked this week. Tie-break: fewest attempts used.</p>

    <div class="champion-grid">
      <div class="paper-card champion-card" style="--row-colour:${champion ? champion.colour_hex : ''}">
        <p class="champion-label">Weekly Champion</p>
        ${
          champion
            ? `<p class="champion-name">${escapeHtml(champion.name)}</p>
               <span class="class-badge" style="--row-colour:${champion.colour_hex}"><span class="class-dot"></span>${escapeHtml(champion.class_name)}</span>
               <p class="champion-points">${champion.points} pts</p>`
            : `<p class="champion-empty">No points banked yet this week.</p>`
        }
      </div>
      <div class="paper-card champion-card" style="--row-colour:${classChampion ? classChampion.colour_hex : ''}">
        <p class="champion-label">Weekly Class Champion</p>
        ${
          classChampion
            ? `<p class="champion-name">${escapeHtml(classChampion.name)}</p>
               <p class="champion-flourish">${escapeHtml(classChampion.namesake)}</p>
               <p class="champion-points">${classChampion.average.toFixed(1)} avg/pupil</p>`
            : `<p class="champion-empty">No points banked yet this week.</p>`
        }
      </div>
    </div>

    <div class="grid-2 mt-2">
      <div>
        <h3>Pupils this week</h3>
        <div class="board">
          ${
            pupilRows.filter((p) => p.points > 0).length
              ? pupilRows
                  .filter((p) => p.points > 0)
                  .map(
                    (p, i) => `
              <div class="row rank-${i + 1}" style="--row-colour:${p.colour_hex}">
                <div class="row-rank">${i + 1}</div>
                <div class="row-main">
                  <div class="row-name">${escapeHtml(p.name)}</div>
                  <div class="row-meta">${escapeHtml(p.class_name)} · ${p.attempts} attempt${p.attempts === 1 ? '' : 's'}</div>
                </div>
                <div class="row-points">${p.points}<small>pts</small></div>
              </div>`
                  )
                  .join('')
              : `<div class="empty-state">Nobody's banked points this week yet.</div>`
          }
        </div>
      </div>
      <div>
        <h3>Classes this week</h3>
        <div class="board">
          ${classRows
            .map(
              (c, i) => `
            <div class="row rank-${i + 1}" style="--row-colour:${c.colour_hex}">
              <div class="row-rank">${i + 1}</div>
              <div class="row-main">
                <div class="row-name">${escapeHtml(c.name)}</div>
                <div class="row-meta">${c.total_points} total pts</div>
              </div>
              <div class="row-points">${c.average.toFixed(1)}<small>avg</small></div>
            </div>`
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="center mt-2">
      <button id="advance-week-btn" class="btn btn-primary">Advance to Week ${week + 1} →</button>
    </div>
  `;
}
