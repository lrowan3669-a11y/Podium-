import {
  renderPupilHub,
  renderAcademicDetail,
  renderPsdDetail,
  renderAttendanceDetail,
  renderQualificationsDetail,
  renderFeedbackDetail,
  renderComingSoonDetail,
  isKnownTile,
} from '../pupilDetailView.js';
import { currentProfile } from '../session.js';

export async function renderPupilPage(container, params) {
  const [pupilId, section] = params;
  if (!pupilId) {
    container.innerHTML = `<div class="empty-state">No pupil specified.</div>`;
    return;
  }
  const profile = currentProfile();
  const isStaff = profile && (profile.role === 'teacher' || profile.role === 'admin');
  const isSelf = profile && profile.role === 'pupil' && String(profile.pupil_id) === String(pupilId);
  const opts = {
    canUploadAvatar: (profile && profile.role === 'admin') || isSelf,
    canRecordTrackers: isStaff,
    canInviteParent: isStaff,
  };

  if (!section) return renderPupilHub(container, pupilId, opts);
  if (section === 'academic') return renderAcademicDetail(container, pupilId, opts);
  if (section === 'psd') return renderPsdDetail(container, pupilId, opts);
  if (section === 'attendance') return renderAttendanceDetail(container, pupilId, opts);
  if (section === 'qualifications') return renderQualificationsDetail(container, pupilId, opts);
  if (section === 'feedback') return renderFeedbackDetail(container, pupilId, opts);
  if (isKnownTile(section)) return renderComingSoonDetail(container, pupilId, section, opts);

  container.innerHTML = `<div class="empty-state">Unknown section.</div>`;
}
