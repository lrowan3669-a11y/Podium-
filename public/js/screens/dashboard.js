import { api } from '../api.js';
import { escapeHtml } from '../util.js';
import { avatarHtml, wireAvatarFallbacks } from '../avatarWidget.js';
import { renderPupilHub } from '../pupilDetailView.js';

export async function renderDashboard(container) {
  const data = await api.getMyDashboard();

  if (data.role === 'pupil') {
    if (!data.pupil) {
      container.innerHTML = `<div class="empty-state">Your account isn't linked to a pupil record yet — check with an admin.</div>`;
      return;
    }
    return renderPupilHub(container, data.pupil.id, { canUploadAvatar: true, canRecordTrackers: false });
  }

  if (data.role === 'teacher') return renderStaffFamilyList(container, 'My Pupils', data.pupils, 'No pupils in your linked classes yet.');
  if (data.role === 'parent') return renderStaffFamilyList(container, 'My Children', data.children, "You're not linked to any pupils yet — check with an admin.");
  return renderAdminDashboard(container, data);
}

function renderStaffFamilyList(container, title, pupils, emptyMessage) {
  container.innerHTML = `
    <h1 class="screen-title">${escapeHtml(title)}</h1>
    <div class="pupil-card-grid">
      ${
        pupils.length
          ? pupils
              .map(
                (p) => `
        <a class="card pupil-card" style="--row-colour:${p.colour_hex}" href="#/pupil/${p.id}">
          ${p.profile_id ? avatarHtml(p.profile_id, p.name, 64) : `<span class="avatar avatar-fallback" style="--avatar-size:64px">${escapeHtml((p.name || '?')[0])}</span>`}
          <div>
            <div class="row-name">${escapeHtml(p.name)}</div>
            <span class="class-badge" style="--row-colour:${p.colour_hex}"><span class="class-dot"></span>${escapeHtml(p.class_name)}</span>
          </div>
          <div class="pupil-card-points">${p.season_points}<small>pts</small></div>
        </a>`
              )
              .join('')
          : `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`
      }
    </div>
  `;
  wireAvatarFallbacks(container);
}

async function renderAdminDashboard(container, data) {
  container.innerHTML = `
    <h1 class="screen-title">Admin Overview</h1>
    <div class="stat-grid">
      <div class="card stat-card">
        <span class="stat-value">${data.pendingApprovals}</span>
        <span class="stat-label">Pending Approvals</span>
      </div>
      <div class="card stat-card">
        <span class="stat-value">${data.totalPupils}</span>
        <span class="stat-label">Active Pupils</span>
      </div>
      <div class="card stat-card">
        <span class="stat-value">${data.totalStaff}</span>
        <span class="stat-label">Staff Accounts</span>
      </div>
    </div>
    ${data.pendingApprovals > 0 ? `<a href="#/approvals" class="btn btn-primary btn-huge">Review Pending Approvals</a>` : ''}
  `;
}
