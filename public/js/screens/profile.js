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

  const [dashboard, aboutMe] = await Promise.all([
    api.getMyDashboard().catch(() => null),
    api.getMyAboutMe().catch(() => ({ likes: [], dislikes: [], favourites: [], bio: null, fun_fact: null })),
  ]);

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
    ${aboutMeHtml(aboutMe)}
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

  wireAboutMe(container, () => renderProfile(container));
}

function aboutMeHtml(aboutMe) {
  const pillList = (items) => (items.length ? items.map((s) => `<span class="pill">${escapeHtml(s)}</span>`).join('') : `<span class="muted">Nothing added yet</span>`);
  return `
    <div class="card about-me">
      <div class="about-me-view">
        ${aboutMe.bio ? `<div class="about-me-row"><h4>About me</h4><p class="about-me-bio">${escapeHtml(aboutMe.bio)}</p></div>` : ''}
        <div class="about-me-row"><h4>Things I like</h4><div class="pill-list">${pillList(aboutMe.likes)}</div></div>
        <div class="about-me-row"><h4>Things I don't like</h4><div class="pill-list">${pillList(aboutMe.dislikes)}</div></div>
        <div class="about-me-row"><h4>Favourites</h4><div class="pill-list">${pillList(aboutMe.favourites)}</div></div>
        ${aboutMe.fun_fact ? `<div class="about-me-row"><h4>Little known fact</h4><p class="about-me-bio">${escapeHtml(aboutMe.fun_fact)}</p></div>` : ''}
        <button id="about-me-edit-btn" class="btn">Edit</button>
      </div>
      <form id="about-me-form" class="tracker-form hidden">
        <div class="field">
          <label for="about-bio">About me</label>
          <textarea id="about-bio" rows="3" placeholder="A few sentences about you">${escapeHtml(aboutMe.bio || '')}</textarea>
        </div>
        <div class="field">
          <label for="about-likes">Things I like (up to 5, comma-separated)</label>
          <input id="about-likes" type="text" value="${escapeHtml(aboutMe.likes.join(', '))}" />
        </div>
        <div class="field">
          <label for="about-dislikes">Things I don't like (up to 5, comma-separated)</label>
          <input id="about-dislikes" type="text" value="${escapeHtml(aboutMe.dislikes.join(', '))}" />
        </div>
        <div class="field">
          <label for="about-favourites">Favourites (up to 5, comma-separated — sport, hobby, whatever)</label>
          <input id="about-favourites" type="text" placeholder="e.g. Football, Baking, The Beatles" value="${escapeHtml(aboutMe.favourites.join(', '))}" />
        </div>
        <div class="field">
          <label for="about-fun-fact">Little known fact</label>
          <input id="about-fun-fact" type="text" placeholder="e.g. I once met the Prime Minister" value="${escapeHtml(aboutMe.fun_fact || '')}" />
        </div>
        <button type="submit" class="btn btn-primary">Save</button>
      </form>
    </div>`;
}

function wireAboutMe(container, rerender) {
  const editBtn = container.querySelector('#about-me-edit-btn');
  const form = container.querySelector('#about-me-form');
  const view = container.querySelector('.about-me-view');
  if (!editBtn || !form) return;

  editBtn.addEventListener('click', () => {
    view.classList.add('hidden');
    form.classList.remove('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const splitList = (id) => form.querySelector(id).value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    try {
      await api.updateMyAboutMe({
        likes: splitList('#about-likes'),
        dislikes: splitList('#about-dislikes'),
        favourites: splitList('#about-favourites'),
        bio: form.querySelector('#about-bio').value,
        fun_fact: form.querySelector('#about-fun-fact').value,
      });
      toast('Saved');
      rerender();
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
