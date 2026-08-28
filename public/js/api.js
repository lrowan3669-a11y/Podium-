const BASE = '/api';

async function request(path, options) {
  const res = await fetch(BASE + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.pending = !!body.pending;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function upload(path, file, fieldName = 'avatar') {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(BASE + path, { method: 'POST', credentials: 'same-origin', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ---- auth ----
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // ---- avatar ----
  uploadMyAvatar: (file) => upload('/avatar/me', file),
  avatarUrl: (profileId) => `${BASE}/avatar/${profileId}`,

  // ---- school setup ----
  getSchool: () => request('/school'),
  updateSchoolName: (name) => request('/school', { method: 'PUT', body: JSON.stringify({ name }) }),
  uploadSchoolLogo: (file) => upload('/school/logo', file, 'logo'),

  // ---- dashboard ----
  getMyDashboard: () => request('/dashboard/me'),
  getPupilDashboard: (pupilId) => request(`/dashboard/pupil/${pupilId}`),
  updateAboutMe: (pupilId, data) => request(`/dashboard/pupil/${pupilId}/about`, { method: 'PUT', body: JSON.stringify(data) }),

  // ---- my profile (every role's own "about me") ----
  getMyAboutMe: () => request('/profile/me'),
  updateMyAboutMe: (data) => request('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
  getStaffProfile: (profileId) => request(`/profile/${profileId}`),

  // ---- trackers ----
  getAcademicProgress: (pupilId) => request(`/trackers/academic/${pupilId}`),
  recordAcademicProgress: (pupilId, data) => request(`/trackers/academic/${pupilId}`, { method: 'POST', body: JSON.stringify(data) }),
  getPsd: (pupilId) => request(`/trackers/psd/${pupilId}`),
  recordPsd: (pupilId, data) => request(`/trackers/psd/${pupilId}`, { method: 'POST', body: JSON.stringify(data) }),
  getAttendance: (pupilId) => request(`/trackers/attendance/${pupilId}`),
  recordAttendance: (pupilId, data) => request(`/trackers/attendance/${pupilId}`, { method: 'POST', body: JSON.stringify(data) }),
  getQualifications: (pupilId) => request(`/trackers/qualifications/${pupilId}`),
  addQualification: (pupilId, data) => request(`/trackers/qualifications/${pupilId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateQualification: (pupilId, qualId, data) => request(`/trackers/qualifications/${pupilId}/${qualId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getFeedback: (pupilId) => request(`/trackers/feedback/${pupilId}`),
  addFeedback: (pupilId, data) => request(`/trackers/feedback/${pupilId}`, { method: 'POST', body: JSON.stringify(data) }),

  // ---- admin ----
  getPendingApprovals: () => request('/admin/pending'),
  getAllProfiles: () => request('/admin/profiles'),
  approveProfile: (profileId, data) => request(`/admin/approve/${profileId}`, { method: 'POST', body: JSON.stringify(data) }),
  rejectProfile: (profileId) => request(`/admin/reject/${profileId}`, { method: 'POST' }),

  // ---- classes / pupils (staff) ----
  getClasses: () => request('/classes'),
  createClass: (data) => request('/classes', { method: 'POST', body: JSON.stringify(data) }),
  uploadClassPhoto: (classId, file) => upload(`/classes/${classId}/photo`, file, 'photo'),
  deleteClass: (classId) => request(`/classes/${classId}`, { method: 'DELETE' }),
  getClassRoster: (classId) => request(`/classes/${classId}/roster`),
  getPupils: () => request('/pupils'),
  createPupil: (data) => request('/pupils', { method: 'POST', body: JSON.stringify(data) }),
  updatePupil: (id, data) => request(`/pupils/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePupil: (id) => request(`/pupils/${id}`, { method: 'DELETE' }),

  // ---- directory (unclaimed pupils) ----
  getDirectory: () => request('/directory'),
  claimPupil: (pupilId, classId) => request(`/directory/claim/${pupilId}`, { method: 'POST', body: JSON.stringify({ class_id: classId }) }),

  // ---- parent invite links ----
  createInvite: (pupilId) => request(`/invites/${pupilId}`, { method: 'POST' }),
  getInvite: (token) => request(`/invite/${token}`),
  claimInvite: (token, data) => request(`/invite/${token}`, { method: 'POST', body: JSON.stringify(data) }),

  getQuestionSets: () => request('/question-sets'),
  getAiStatus: () => request('/question-sets/ai-status'),
  generateQuestions: (data) => request('/question-sets/generate', { method: 'POST', body: JSON.stringify(data) }),
  getQuestionSet: (id) => request(`/question-sets/${id}`),
  getQuestionSetToPlay: (id) => request(`/question-sets/${id}/play`),
  createQuestionSet: (data) => request('/question-sets', { method: 'POST', body: JSON.stringify(data) }),
  updateQuestionSet: (id, data) => request(`/question-sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuestionSet: (id) => request(`/question-sets/${id}`, { method: 'DELETE' }),

  submitAttempt: (data) => request('/attempts', { method: 'POST', body: JSON.stringify(data) }),
  awardManual: (data) => request('/awards', { method: 'POST', body: JSON.stringify(data) }),

  getIndividualStandings: () => request('/standings/individual'),
  getClassStandings: () => request('/standings/classes'),
  getWeeklyStandings: () => request('/standings/weekly'),

  getWeek: () => request('/meta/week'),
  advanceWeek: () => request('/meta/week/advance', { method: 'POST' }),

  // ---- messaging ----
  getMessageContacts: () => request('/messages/contacts'),
  getInbox: () => request('/messages/inbox'),
  getThread: (otherId) => request(`/messages/thread/${otherId}`),
  sendMessage: (otherId, body) => request(`/messages/thread/${otherId}`, { method: 'POST', body: JSON.stringify({ body }) }),
};
