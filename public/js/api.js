const BASE = '/api';

async function request(path, options) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getClasses: () => request('/classes'),

  getPupils: () => request('/pupils'),
  createPupil: (data) => request('/pupils', { method: 'POST', body: JSON.stringify(data) }),
  updatePupil: (id, data) => request(`/pupils/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePupil: (id) => request(`/pupils/${id}`, { method: 'DELETE' }),

  getQuestionSets: () => request('/question-sets'),
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
};
