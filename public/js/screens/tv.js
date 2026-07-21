import { api } from '../api.js';
import { escapeHtml } from '../util.js';

const CYCLE_MS = 12_000;
const SLIDES = ['individual', 'classes', 'weekly'];

export async function renderTv(container) {
  let slideIndex = 0;
  let stopped = false;

  async function paint() {
    if (stopped) return;
    const slide = SLIDES[slideIndex];
    try {
      if (slide === 'individual') {
        const pupils = await api.getIndividualStandings();
        container.innerHTML = tvFrame(individualHtml(pupils), slideIndex);
      } else if (slide === 'classes') {
        const classes = await api.getClassStandings();
        container.innerHTML = tvFrame(classesHtml(classes), slideIndex);
      } else {
        const data = await api.getWeeklyStandings();
        container.innerHTML = tvFrame(weeklyHtml(data), slideIndex);
      }
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Reconnecting…</div>`;
    }
  }

  await paint();
  const timer = setInterval(() => {
    slideIndex = (slideIndex + 1) % SLIDES.length;
    paint();
  }, CYCLE_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

function tvFrame(inner, activeIndex) {
  return `
    <div class="tv-frame">
      ${inner}
      <div class="tv-dots">
        ${SLIDES.map((_, i) => `<span class="${i === activeIndex ? 'active' : ''}"></span>`).join('')}
      </div>
    </div>
  `;
}

function individualHtml(pupils) {
  return `
    <h1 class="screen-title">Individual Standings</h1>
    <div class="board">
      ${pupils
        .slice(0, 12)
        .map(
          (p) => `
        <div class="row rank-${p.rank}" style="--row-colour:${p.colour_hex}">
          <div class="row-rank">${p.rank}</div>
          <div class="row-main">
            <div class="row-name">${escapeHtml(p.name)}</div>
            <span class="class-badge" style="--row-colour:${p.colour_hex}"><span class="class-dot"></span>${escapeHtml(p.class_name)}</span>
          </div>
          <div class="row-points">${p.points}<small>pts</small></div>
        </div>`
        )
        .join('') || `<div class="empty-state">No pupils yet.</div>`}
    </div>
  `;
}

function classesHtml(classes) {
  return `
    <h1 class="screen-title">Constructors' Board</h1>
    <div class="board">
      ${classes
        .map(
          (c) => `
        <div class="row rank-${c.rank}" style="--row-colour:${c.colour_hex}">
          <div class="row-rank">${c.rank}</div>
          <div class="row-main">
            <div class="row-name">${escapeHtml(c.name)}</div>
            <div class="row-meta">${escapeHtml(c.namesake)}</div>
          </div>
          <div class="row-points">${c.average.toFixed(1)}<small>avg/pupil</small></div>
        </div>`
        )
        .join('')}
    </div>
  `;
}

function weeklyHtml(data) {
  const { week, champion, classChampion } = data;
  return `
    <h1 class="screen-title">Weekly Winners — Week ${week}</h1>
    <div class="champion-grid">
      <div class="champion-card" style="--row-colour:${champion ? champion.colour_hex : ''}">
        <p class="champion-label">Weekly Champion</p>
        ${
          champion
            ? `<p class="champion-name">${escapeHtml(champion.name)}</p>
               <span class="class-badge" style="--row-colour:${champion.colour_hex}"><span class="class-dot"></span>${escapeHtml(champion.class_name)}</span>
               <p class="champion-points">${champion.points} pts</p>`
            : `<p class="champion-empty">No points banked yet this week.</p>`
        }
      </div>
      <div class="champion-card" style="--row-colour:${classChampion ? classChampion.colour_hex : ''}">
        <p class="champion-label">Weekly Class Champion</p>
        ${
          classChampion
            ? `<p class="champion-name">${escapeHtml(classChampion.name)}</p>
               <p class="champion-points">${classChampion.average.toFixed(1)} avg/pupil</p>`
            : `<p class="champion-empty">No points banked yet this week.</p>`
        }
      </div>
    </div>
  `;
}
