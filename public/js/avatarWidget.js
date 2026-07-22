import { api } from './api.js';
import { escapeHtml } from './util.js';

export function avatarHtml(profileId, name, size = 96) {
  const initials = (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `
    <span class="avatar" style="--avatar-size:${size}px" data-fallback="${escapeHtml(initials)}">
      <img class="avatar-img" src="${api.avatarUrl(profileId)}" alt="" />
    </span>`;
}

// Call once after inserting avatarHtml() into the DOM — swaps in initials
// if the profile has no photo (or the request 403s/404s) instead of a
// broken-image icon.
export function wireAvatarFallbacks(container) {
  container.querySelectorAll('.avatar-img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const span = img.closest('.avatar');
        span.innerHTML = '';
        span.textContent = span.dataset.fallback || '?';
        span.classList.add('avatar-fallback');
      },
      { once: true }
    );
  });
}
