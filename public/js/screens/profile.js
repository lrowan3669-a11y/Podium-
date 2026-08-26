import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';
import { currentProfile } from '../session.js';
import { avatarHtml, wireAvatarFallbacks } from '../avatarWidget.js';
import { renderPupilHub } from '../pupilDetailView.js';

// Every account's own profile page. A pupil's profile *is* their existing
// Podium hub (stats, trackers, about-me) — no point duplicating that here.
// Staff/parent/admin get a simpler photo + details view, since none of
// them have pupil-shaped stats to show.
export async function renderProfile(container) {
  const profile = currentProfile();
  if (!profile) return;

  if (profile.role === 'pupil') {
    if (!profile.pupil_id) {
      container.innerHTML = `<div class="empty-state">Your account isn't linked to a pupil record yet — check with an admin.</div>`;
      return;
    }
    return renderPupilHub(container, profile.pupil_id, { canUploadAvatar: true, canEditAbout: true, canInviteParent: false });
  }

  const dashboard = await api.getMyDashboard().catch(() => null);

  container.innerHTML = `
    <h1 class="screen-title">My Profile</h1>
    <div class="card pupil-header" style="--row-colour:${roleColour(profile.role)}">
      <div class="pupil-header-main">
        ${avatarHtml(profile.id, profile.full_name, 88)}
        <div>
          <h2 style="margin:0 0 0.3rem">${escapeHtml(profile.full_name)}</h2>
          <span class="pill">${escapeHtml(roleLabel(profile.role))}</span>
        </div>
      </div>
      <div class="avatar-upload">
        <label class="btn" for="profile-avatar-file">Change photo</label>
        <input id="profile-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
      </div>
    </div>
    ${roleDetailHtml(profile, dashboard)}
  `;

  wireAvatarFallbacks(container);
  const input = container.querySelector('#profile-avatar-file');
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api.uploadMyAvatar(file);
      toast('Photo updated');
      renderProfile(container);
    } catch (err) {
      toast(err.message);
    }
  });
}

function roleLabel(role) {
  return { teacher: 'Staff', parent: 'Parent', admin: 'Admin' }[role] || role;
}

function roleColour(role) {
  return { teacher: 'var(--gold)', parent: 'var(--ui-teal)', admin: 'var(--ui-purple)' }[role] || 'var(--line)';
}

function roleDetailHtml(profile, dashboard) {
  if (profile.role === 'teacher' && dashboard) {
    return `
      <div class="card">
        <h3>Your classes</h3>
        ${
          dashboard.pupils && dashboard.pupils.length
            ? `<div class="pill-list">${[...new Set(dashboard.pupils.map((p) => p.class_name))].map((n) => `<span class="pill">${escapeHtml(n)}</span>`).join('')}</div>`
            : `<p class="muted">Not linked to a class yet — create or join one in Teacher Admin.</p>`
        }
      </div>`;
  }
  if (profile.role === 'parent' && dashboard) {
    return `
      <div class="card">
        <h3>Your children</h3>
        ${
          dashboard.children && dashboard.children.length
            ? `<div class="pupil-card-grid">${dashboard.children
                .map(
                  (c) => `
              <a href="#/pupil/${c.id}" class="card pupil-card" style="--row-colour:${c.colour_hex || 'var(--line)'}">
                ${avatarHtml(c.profile_id || c.id, c.name, 48)}
                <div>
                  <div class="row-name">${escapeHtml(c.name)}</div>
                  ${c.class_name ? `<span class="class-badge" style="--row-colour:${c.colour_hex}"><span class="class-dot"></span>${escapeHtml(c.class_name)}</span>` : ''}
                </div>
              </a>`
                )
                .join('')}</div>`
            : `<p class="muted">Not linked to a child yet — check with an admin.</p>`
        }
      </div>`;
  }
  if (profile.role === 'admin') {
    return `
      <div class="card">
        <h3>School-wide</h3>
        <p class="muted">You have access to every pupil, class, and account in Podium.</p>
      </div>`;
  }
  return '';
}
