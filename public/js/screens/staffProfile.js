import { api } from '../api.js';
import { escapeHtml } from '../util.js';
import { avatarHtml, wireAvatarFallbacks } from '../avatarWidget.js';

// Admin-only read view of another account's profile — reached by clicking
// a teacher's name from a class roster. Not an edit surface: about-me is
// self-authored, this is just "who is this person".
export async function renderStaffProfile(container, params) {
  const [profileId] = params;
  if (!profileId) {
    container.innerHTML = `<div class="empty-state">No account specified.</div>`;
    return;
  }

  let p;
  try {
    p = await api.getStaffProfile(profileId);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    return;
  }

  const pillList = (items) => (items.length ? items.map((s) => `<span class="pill">${escapeHtml(s)}</span>`).join('') : `<span class="muted">Nothing added yet</span>`);
  const roleLabel = { teacher: 'Staff', parent: 'Parent', admin: 'Admin', pupil: 'Pupil' }[p.role] || p.role;

  container.innerHTML = `
    <a href="#/admin" class="back-link">&larr; Back to Teacher Admin</a>
    <div class="card pupil-header">
      <div class="pupil-header-main">
        ${avatarHtml(p.id, p.full_name, 88)}
        <div>
          <h1 class="screen-title" style="margin-bottom:0.3rem">${escapeHtml(p.full_name)}</h1>
          <span class="pill">${escapeHtml(roleLabel)}</span>
        </div>
      </div>
    </div>

    ${
      p.classes && p.classes.length
        ? `<div class="card"><h3>Classes</h3><div class="pill-list">${p.classes.map((c) => `<a href="#/class/${c.id}" class="pill">${escapeHtml(c.name)}</a>`).join('')}</div></div>`
        : ''
    }
    ${
      p.children && p.children.length
        ? `<div class="card"><h3>Children</h3><div class="pill-list">${p.children.map((c) => `<a href="#/pupil/${c.id}" class="pill">${escapeHtml(c.name)}</a>`).join('')}</div></div>`
        : ''
    }

    <div class="card about-me">
      ${p.bio ? `<div class="about-me-row"><h4>About</h4><p class="about-me-bio">${escapeHtml(p.bio)}</p></div>` : ''}
      <div class="about-me-row"><h4>Things they like</h4><div class="pill-list">${pillList(p.likes)}</div></div>
      <div class="about-me-row"><h4>Things they don't like</h4><div class="pill-list">${pillList(p.dislikes)}</div></div>
      <div class="about-me-row"><h4>Favourites</h4><div class="pill-list">${pillList(p.favourites)}</div></div>
      ${p.fun_fact ? `<div class="about-me-row"><h4>Little known fact</h4><p class="about-me-bio">${escapeHtml(p.fun_fact)}</p></div>` : ''}
    </div>
  `;

  wireAvatarFallbacks(container);
}
