import { api } from '../api.js';
import { refreshApp, router } from '../main.js';

export async function renderPending(container) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card center">
        <h1 class="screen-title">Almost there</h1>
        <p class="screen-sub">Your account is waiting for a school admin to approve it. Check back soon.</p>
        <button id="pending-logout" class="btn">Sign out</button>
      </div>
    </div>
  `;
  container.querySelector('#pending-logout').addEventListener('click', async () => {
    await api.logout().catch(() => {});
    await refreshApp();
    location.hash = '#/login';
    router();
  });
}
