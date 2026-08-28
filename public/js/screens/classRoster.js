import { api } from '../api.js';
import { escapeHtml } from '../util.js';
import { currentProfile } from '../session.js';
import { avatarHtml, wireAvatarFallbacks } from '../avatarWidget.js';

// Admin's route into a class: name/photo, its teacher(s) (clickable through
// to their profile), and its pupils (clickable through to theirs). A
// teacher landing here (their own class, via the same Classes tab) sees
// the same view minus the link on their own name.
export async function renderClassRoster(container, params) {
  const [classId] = params;
  if (!classId) {
    container.innerHTML = `<div class="empty-state">No class specified.</div>`;
    return;
  }

  const profile = currentProfile();
  const isAdmin = profile && profile.role === 'admin';

  let data;
  try {
    data = await api.getClassRoster(classId);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    return;
  }
  const { class: cls, teachers, pupils } = data;

  container.innerHTML = `
    <a href="#/admin" class="back-link">&larr; Back to Teacher Admin</a>
    <div class="card pupil-header" style="--row-colour:${cls.colourHex}">
      <div class="pupil-header-main">
        ${cls.photoUrl ? `<img src="${cls.photoUrl}" alt="" class="avatar" style="--avatar-size:88px;object-fit:cover" />` : `<span class="avatar avatar-fallback" style="--avatar-size:88px">${escapeHtml(cls.name[0] || '?')}</span>`}
        <div>
          <h1 class="screen-title" style="margin-bottom:0.3rem">${escapeHtml(cls.name)}</h1>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Teacher${teachers.length === 1 ? '' : 's'}</h3>
      ${
        teachers.length
          ? `<div class="pupil-card-grid">${teachers
              .map(
                (t) => `
            ${isAdmin ? `<a href="#/staff/${t.id}" class="card pupil-card">` : `<div class="card pupil-card">`}
              ${avatarHtml(t.id, t.full_name, 48)}
              <div class="row-name">${escapeHtml(t.full_name)}</div>
            ${isAdmin ? '</a>' : '</div>'}`
              )
              .join('')}</div>`
          : `<p class="muted">No teacher linked to this class yet.</p>`
      }
    </div>

    <div class="card">
      <h3>Pupils (${pupils.length})</h3>
      ${
        pupils.length
          ? `<div class="pupil-card-grid">${pupils
              .map(
                (p) => `
            <a href="#/pupil/${p.id}" class="card pupil-card" style="--row-colour:${cls.colourHex}">
              ${avatarHtml(p.id, p.name, 48)}
              <div class="row-name">${escapeHtml(p.name)}</div>
              <span class="pupil-card-points">${p.season_points}<small>pts</small></span>
            </a>`
              )
              .join('')}</div>`
          : `<p class="muted">No pupils in this class yet — claim some from the Directory.</p>`
      }
    </div>
  `;

  wireAvatarFallbacks(container);
}
