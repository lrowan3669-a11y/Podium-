import { renderPupilDetail } from '../pupilDetailView.js';
import { currentProfile } from '../session.js';

export async function renderPupilPage(container, params) {
  const pupilId = params[0];
  if (!pupilId) {
    container.innerHTML = `<div class="empty-state">No pupil specified.</div>`;
    return;
  }
  const profile = currentProfile();
  const isStaff = profile && (profile.role === 'teacher' || profile.role === 'admin');
  await renderPupilDetail(container, pupilId, {
    canUploadAvatar: profile && profile.role === 'admin',
    canRecordTrackers: isStaff,
  });
}
