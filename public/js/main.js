import { api } from './api.js';
import { unlockAudio } from './sound.js';
import { escapeHtml } from './util.js';
import { setCurrentProfile, currentProfile } from './session.js';
import { avatarHtml, wireAvatarFallbacks } from './avatarWidget.js';
import { showPlaceholderBranding, refreshSchoolBranding } from './schoolBranding.js';
import { renderIndividual } from './screens/individual.js';
import { renderClasses } from './screens/classes.js';
import { renderWeekly } from './screens/weekly.js';
import { renderPlay } from './screens/play.js';
import { renderAdmin } from './screens/admin.js';
import { renderTv } from './screens/tv.js';
import { renderLogin } from './screens/login.js';
import { renderSignup } from './screens/signup.js';
import { renderPending } from './screens/pending.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderPupilPage } from './screens/pupilPage.js';
import { renderApprovals } from './screens/approvals.js';
import { renderSchoolSetup } from './screens/schoolSetup.js';
import { renderDirectory } from './screens/directory.js';
import { renderInvite } from './screens/invite.js';
import { renderMessages } from './screens/messages.js';

showPlaceholderBranding();
refreshSchoolBranding();

const PUBLIC_ROUTES = { login: renderLogin, signup: renderSignup, invite: renderInvite };
const APP_ROUTES = {
  dashboard: renderDashboard,
  pupil: renderPupilPage,
  individual: renderIndividual,
  classes: renderClasses,
  weekly: renderWeekly,
  play: renderPlay,
  admin: renderAdmin,
  tv: renderTv,
  approvals: renderApprovals,
  school: renderSchoolSetup,
  directory: renderDirectory,
  messages: renderMessages,
};

// route key -> { label, roles } — roles omitted means every approved role sees it
const NAV_ITEMS = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'individual', label: 'Standings' },
  { route: 'weekly', label: 'Weekly' },
  { route: 'messages', label: 'Messages' },
  { route: 'play', label: 'Question Mode', roles: ['teacher', 'admin'] },
  { route: 'tv', label: 'TV Mode', roles: ['teacher', 'admin'] },
  { route: 'admin', label: 'Teacher Admin', roles: ['teacher', 'admin'] },
  { route: 'directory', label: 'Directory', roles: ['teacher', 'admin'] },
  { route: 'approvals', label: 'Approvals', roles: ['admin'] },
  { route: 'school', label: 'School Setup', roles: ['admin'] },
];

// Phone-only bottom tab bar — a short, role-scoped subset of NAV_ITEMS for
// quick thumb access. The full list stays reachable via the topbar's
// hamburger sheet, which remains present at every width.
const BOTTOM_NAV_ITEMS = {
  pupil: [
    { route: 'dashboard', label: 'Hub' },
    { route: 'individual', label: 'Board' },
    { route: 'weekly', label: 'Weekly' },
    { route: 'messages', label: 'Messages' },
  ],
  parent: [
    { route: 'dashboard', label: 'Home' },
    { route: 'individual', label: 'Board' },
    { route: 'messages', label: 'Messages' },
  ],
  teacher: [
    { route: 'admin', label: 'Admin' },
    { route: 'individual', label: 'Board' },
    { route: 'messages', label: 'Messages' },
  ],
  admin: [
    { route: 'admin', label: 'Admin' },
    { route: 'individual', label: 'Board' },
    { route: 'messages', label: 'Messages' },
  ],
};

const screenEl = document.getElementById('screen');
const navEl = document.getElementById('nav-links');
const userBadgeEl = document.getElementById('user-badge');
const navToggleEl = document.getElementById('nav-toggle');
const bottomNavEl = document.getElementById('bottom-nav');
let currentCleanup = null;
let weekPillTimer = null;

function renderNav(profile) {
  navEl.innerHTML = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(profile.role))
    .map((item) => `<a href="#/${item.route}" data-route="${item.route}">${escapeHtml(item.label)}</a>`)
    .join('');

  const bottomItems = BOTTOM_NAV_ITEMS[profile.role] || [];
  bottomNavEl.innerHTML = bottomItems
    .map(
      (item) => `
    <a href="#/${item.route}" data-route="${item.route}" class="bottom-nav-item">
      <span class="bottom-nav-dot" aria-hidden="true"></span>
      ${escapeHtml(item.label)}
    </a>`
    )
    .join('');
  bottomNavEl.classList.remove('hidden');

  userBadgeEl.innerHTML = `
    ${avatarHtml(profile.id, profile.full_name, 32)}
    <span class="user-badge-name">${escapeHtml(profile.full_name)}</span>
    <button id="logout-btn" class="btn user-badge-logout">Sign out</button>
  `;
  userBadgeEl.classList.remove('hidden');
  wireAvatarFallbacks(userBadgeEl);
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.logout().catch(() => {});
    await refreshApp();
    location.hash = '#/login';
    router();
  });

  navToggleEl.classList.remove('hidden');
}

function clearNav() {
  navEl.innerHTML = '';
  userBadgeEl.classList.add('hidden');
  navToggleEl.classList.add('hidden');
  bottomNavEl.innerHTML = '';
  bottomNavEl.classList.add('hidden');
  if (weekPillTimer) {
    clearInterval(weekPillTimer);
    weekPillTimer = null;
  }
}

async function refreshWeekPill() {
  try {
    const { week } = await api.getWeek();
    document.getElementById('week-pill').textContent = `Week ${week}`;
  } catch (e) { /* not signed in yet, or offline — leave as-is */ }
}

// Re-checks who's signed in and rebuilds the nav accordingly, without a
// full page reload — used after login/logout/signup so the (already
// granted) audio-unlock from the gate isn't lost along the way.
export async function refreshApp() {
  try {
    const { profile } = await api.me();
    setCurrentProfile(profile);
    if (profile.approval_status === 'approved') {
      renderNav(profile);
      refreshWeekPill();
      if (!weekPillTimer) weekPillTimer = setInterval(refreshWeekPill, 60_000);
    } else {
      clearNav();
    }
  } catch (e) {
    setCurrentProfile(null);
    clearNav();
  }
}

export async function router() {
  const hash = (location.hash || '#/dashboard').replace('#/', '');
  const [route, ...params] = hash.split('/');

  document.body.classList.toggle('tv-body', route === 'tv');
  navEl.classList.remove('nav-open');
  navToggleEl.setAttribute('aria-expanded', 'false');

  const profile = currentProfile();

  // not signed in: only login/signup are reachable
  if (!profile) {
    const renderFn = PUBLIC_ROUTES[route] || renderLogin;
    if (!PUBLIC_ROUTES[route]) location.hash = '#/login';
    screenEl.innerHTML = '';
    currentCleanup = await safeRender(renderFn, screenEl, params);
    return;
  }

  // signed in but not yet approved
  if (profile.approval_status !== 'approved') {
    currentCleanup = await safeRender(renderPending, screenEl, params);
    return;
  }

  // signed in + approved: bounce away from login/signup back into the app
  if (PUBLIC_ROUTES[route]) {
    location.hash = '#/dashboard';
    return;
  }

  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  document.querySelectorAll('.bottom-nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === route));

  const navItem = NAV_ITEMS.find((i) => i.route === route);
  if (navItem && navItem.roles && !navItem.roles.includes(profile.role)) {
    screenEl.innerHTML = `<div class="empty-state">You don't have access to this screen.</div>`;
    return;
  }

  const renderFn = APP_ROUTES[route] || renderDashboard;
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { /* ignore */ }
    currentCleanup = null;
  }
  currentCleanup = await safeRender(renderFn, screenEl, params);
}

async function safeRender(renderFn, container, params) {
  container.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    return await renderFn(container, params);
  } catch (err) {
    console.error(err);
    if (err.status === 401) {
      setCurrentProfile(null);
      location.hash = '#/login';
      return null;
    }
    container.innerHTML = `<div class="empty-state">Something went wrong: ${escapeHtml(err.message)}</div>`;
    return null;
  }
}

window.addEventListener('hashchange', router);

navToggleEl.addEventListener('click', () => {
  const open = navEl.classList.toggle('nav-open');
  navToggleEl.setAttribute('aria-expanded', String(open));
});

async function boot() {
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  await refreshApp();
  router();
}

document.getElementById('gate-enter').addEventListener('click', () => {
  unlockAudio();
  boot();
});
