import { api } from './api.js';
import { unlockAudio } from './sound.js';
import { podiumMark } from './logo.js';
import { renderIndividual } from './screens/individual.js';
import { renderClasses } from './screens/classes.js';
import { renderWeekly } from './screens/weekly.js';
import { renderPlay } from './screens/play.js';
import { renderAdmin } from './screens/admin.js';
import { renderTv } from './screens/tv.js';

document.getElementById('gate-mark').innerHTML = podiumMark(72);
document.getElementById('header-mark').innerHTML = podiumMark(30);

const ROUTES = {
  individual: renderIndividual,
  classes: renderClasses,
  weekly: renderWeekly,
  play: renderPlay,
  admin: renderAdmin,
  tv: renderTv,
};

const screenEl = document.getElementById('screen');
let currentCleanup = null;

async function router() {
  const hash = (location.hash || '#/individual').replace('#/', '');
  const [route] = hash.split('/');
  const renderFn = ROUTES[route] || renderIndividual;

  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === route);
  });

  document.body.classList.toggle('tv-body', route === 'tv');

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { /* ignore */ }
    currentCleanup = null;
  }

  screenEl.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    currentCleanup = await renderFn(screenEl);
  } catch (err) {
    console.error(err);
    screenEl.innerHTML = `<div class="empty-state">Something went wrong: ${err.message}</div>`;
  }
}

window.addEventListener('hashchange', router);

async function refreshWeekPill() {
  try {
    const { week } = await api.getWeek();
    document.getElementById('week-pill').textContent = `Week ${week}`;
  } catch (e) { /* offline — leave as-is */ }
}

document.getElementById('gate-enter').addEventListener('click', () => {
  unlockAudio();
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  router();
  refreshWeekPill();
  setInterval(refreshWeekPill, 60_000);
});
