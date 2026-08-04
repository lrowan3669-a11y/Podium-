import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';
import { refreshSchoolBranding } from '../schoolBranding.js';

export async function renderSchoolSetup(container) {
  const school = await api.getSchool();

  container.innerHTML = `
    <h1 class="screen-title">School Setup</h1>
    <p class="screen-sub">Your school's name and logo appear throughout the app, including the sign-in screen.</p>

    <div class="card" style="max-width:520px">
      <h3>Logo</h3>
      <div class="school-logo-preview">
        ${school.logoUrl ? `<img src="${escapeHtml(school.logoUrl)}" alt="${escapeHtml(school.name)} logo" />` : `<span class="muted">No logo uploaded yet</span>`}
      </div>
      <label class="btn" for="logo-file">Upload logo</label>
      <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" />

      <h3 class="mt-2">School name</h3>
      <form id="name-form">
        <div class="field">
          <label for="school-name">Name</label>
          <input id="school-name" type="text" value="${escapeHtml(school.name)}" required />
        </div>
        <button type="submit" class="btn btn-primary">Save Name</button>
      </form>
    </div>
  `;

  container.querySelector('#logo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api.uploadSchoolLogo(file);
      toast('Logo updated');
      await refreshSchoolBranding();
      renderSchoolSetup(container);
    } catch (err) {
      toast(err.message);
    }
  });

  container.querySelector('#name-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.updateSchoolName(container.querySelector('#school-name').value.trim());
      toast('School name updated');
      await refreshSchoolBranding();
    } catch (err) {
      toast(err.message);
    }
  });
}
