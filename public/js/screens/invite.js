import { api } from '../api.js';
import { refreshApp, router } from '../main.js';
import { escapeHtml } from '../util.js';

// The "almost hidden" parent landing page — reached only via a one-time
// link a teacher/admin generated and sent themselves (email, text,
// WhatsApp). Nothing links here from the normal gate/login/signup flow.
export async function renderInvite(container, params) {
  const [token] = params;
  if (!token) {
    container.innerHTML = `<div class="empty-state">Missing invite link.</div>`;
    return;
  }

  let invite;
  try {
    invite = await api.getInvite(token);
  } catch (err) {
    container.innerHTML = `
      <div class="auth-wrap">
        <div class="card auth-card">
          <h1 class="screen-title">Invite Link</h1>
          <div class="auth-error">${escapeHtml(err.message)}</div>
          <p class="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1 class="screen-title">You're invited</h1>
        <p class="screen-sub">Create your Podium account as ${escapeHtml(invite.pupilName)}'s parent.</p>
        <div id="invite-error" class="auth-error hidden"></div>
        <form id="invite-form">
          <div class="field">
            <label for="inv-name">Your full name</label>
            <input id="inv-name" type="text" required autocomplete="name" />
          </div>
          <div class="field">
            <label for="inv-email">Email</label>
            <input id="inv-email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label for="inv-password">Password</label>
            <input id="inv-password" type="password" required minlength="6" autocomplete="new-password" />
            <span class="field-hint">At least 6 characters.</span>
          </div>
          <button type="submit" class="btn btn-primary btn-huge" style="width:100%">Create Account</button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#invite-form');
  const errorBox = container.querySelector('#invite-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    const full_name = container.querySelector('#inv-name').value.trim();
    const email = container.querySelector('#inv-email').value.trim();
    const password = container.querySelector('#inv-password').value;
    try {
      await api.claimInvite(token, { full_name, email, password });
      await refreshApp();
      location.hash = '#/dashboard';
      router();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}
