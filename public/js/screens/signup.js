import { api } from '../api.js';
import { escapeHtml } from '../util.js';

export async function renderSignup(container) {
  const classes = await api.getClasses();

  container.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1 class="screen-title">Create Account</h1>
        <p class="screen-sub">A school admin reviews and approves every new account before it can sign in.</p>
        <div id="signup-error" class="auth-error hidden"></div>
        <div id="signup-success" class="auth-success hidden"></div>
        <form id="signup-form">
          <div class="field">
            <label for="su-role">I am a…</label>
            <select id="su-role">
              <option value="pupil">Pupil</option>
              <option value="teacher">Teacher / Staff</option>
              <option value="parent">Parent / Carer</option>
            </select>
          </div>
          <div class="field">
            <label for="su-name">Full name</label>
            <input id="su-name" type="text" required autocomplete="name" />
          </div>
          <div class="field">
            <label for="su-email">Email</label>
            <input id="su-email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label for="su-password">Password</label>
            <input id="su-password" type="password" required minlength="6" autocomplete="new-password" />
            <span class="field-hint">At least 6 characters.</span>
          </div>

          <div id="su-hint-pupil" class="field">
            <label for="su-class-pupil">Which class are you in?</label>
            <select id="su-class-pupil">
              ${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div id="su-hint-teacher" class="field hidden">
            <label>Which class(es) do you teach?</label>
            <div class="pill-list">
              ${classes
                .map(
                  (c) => `<label class="checkbox-pill">
                    <input type="checkbox" name="su-class-teacher" value="${c.id}" />
                    ${escapeHtml(c.name)}
                  </label>`
                )
                .join('')}
            </div>
          </div>

          <div id="su-hint-parent" class="field hidden">
            <label for="su-child-name">Your child's full name</label>
            <input id="su-child-name" type="text" placeholder="So an admin can link your account to the right pupil" />
          </div>

          <button type="submit" class="btn btn-primary btn-huge" style="width:100%">Create Account</button>
        </form>
        <p class="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>
      </div>
    </div>
  `;

  const roleSelect = container.querySelector('#su-role');
  const hintBlocks = {
    pupil: container.querySelector('#su-hint-pupil'),
    teacher: container.querySelector('#su-hint-teacher'),
    parent: container.querySelector('#su-hint-parent'),
  };
  function syncHintVisibility() {
    const role = roleSelect.value;
    Object.entries(hintBlocks).forEach(([r, el]) => el.classList.toggle('hidden', r !== role));
  }
  roleSelect.addEventListener('change', syncHintVisibility);
  syncHintVisibility();

  const form = container.querySelector('#signup-form');
  const errorBox = container.querySelector('#signup-error');
  const successBox = container.querySelector('#signup-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    successBox.classList.add('hidden');

    const role = roleSelect.value;
    const full_name = container.querySelector('#su-name').value.trim();
    const email = container.querySelector('#su-email').value.trim();
    const password = container.querySelector('#su-password').value;

    let hint = null;
    if (role === 'pupil') {
      const classId = container.querySelector('#su-class-pupil').value;
      const className = classes.find((c) => c.id === classId)?.name;
      hint = { class_id: classId, class_name: className };
    } else if (role === 'teacher') {
      const classIds = Array.from(container.querySelectorAll('input[name="su-class-teacher"]:checked')).map((el) => el.value);
      hint = { class_ids: classIds };
    } else if (role === 'parent') {
      hint = { child_name: container.querySelector('#su-child-name').value.trim() };
    }

    try {
      const result = await api.signup({ email, password, full_name, role, hint });
      form.classList.add('hidden');
      successBox.textContent = result.message;
      successBox.classList.remove('hidden');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}
