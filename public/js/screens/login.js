import { api } from '../api.js';
import { refreshApp, router } from '../main.js';
import { renderPending } from './pending.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1 class="screen-title">Sign In</h1>
        <p class="screen-sub">Podium accounts for pupils, staff and parents.</p>
        <div id="login-error" class="auth-error hidden"></div>
        <form id="login-form">
          <div class="field">
            <label for="login-email">Email</label>
            <input id="login-email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label for="login-password">Password</label>
            <input id="login-password" type="password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-huge" style="width:100%">Sign In</button>
        </form>
        <p class="auth-switch">New here? <a href="#/signup">Create an account</a></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const errorBox = container.querySelector('#login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    const email = container.querySelector('#login-email').value.trim();
    const password = container.querySelector('#login-password').value;
    try {
      await api.login({ email, password });
      await refreshApp();
      location.hash = '#/dashboard';
      router();
    } catch (err) {
      if (err.pending) {
        // no session was created for a pending account — render the
        // holding screen directly rather than routing to it
        renderPending(container);
        return;
      }
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}
