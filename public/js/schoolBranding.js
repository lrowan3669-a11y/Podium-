import { api } from './api.js';
import { escapeHtml } from './util.js';
import { crownMark } from './logo.js';

let cached = null;

function applyBranding() {
  if (!cached) return;
  const { name, logoUrl } = cached;
  document.title = name && name !== 'Podium' ? `${name} — Podium` : 'Podium';

  const gateMark = document.getElementById('gate-mark');
  const headerMark = document.getElementById('header-mark');
  if (logoUrl) {
    const alt = escapeHtml(name || 'School logo');
    if (gateMark) gateMark.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="${alt}" class="school-logo-img school-logo-gate" />`;
    if (headerMark) headerMark.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="${alt}" class="school-logo-img school-logo-header" />`;
  } else {
    if (gateMark) gateMark.innerHTML = crownMark(72);
    if (headerMark) headerMark.innerHTML = crownMark(30);
  }
}

// Placeholder mark shows immediately (no fetch to wait on); once the real
// school branding loads, it swaps in if a logo's been uploaded.
export function showPlaceholderBranding() {
  const gateMark = document.getElementById('gate-mark');
  const headerMark = document.getElementById('header-mark');
  if (gateMark) gateMark.innerHTML = crownMark(72);
  if (headerMark) headerMark.innerHTML = crownMark(30);
}

export async function refreshSchoolBranding() {
  try {
    cached = await api.getSchool();
  } catch (e) {
    cached = { name: 'Podium', logoUrl: null };
  }
  applyBranding();
  return cached;
}

export function currentSchool() {
  return cached;
}
