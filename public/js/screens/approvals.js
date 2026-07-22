import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';

export async function renderApprovals(container) {
  const [pending, classes] = await Promise.all([api.getPendingApprovals(), api.getClasses()]);

  container.innerHTML = `
    <h1 class="screen-title">Pending Approvals</h1>
    <p class="screen-sub">Every new account waits here until you approve it and link it to the right pupil/class.</p>
    <div class="approval-list">
      ${
        pending.length
          ? pending.map((p) => approvalCardHtml(p, classes)).join('')
          : `<div class="empty-state">No pending accounts right now.</div>`
      }
    </div>
  `;

  pending.forEach((p) => wireApprovalCard(container, p));
}

function approvalCardHtml(p, classes) {
  const hint = p.signup_hint || {};
  let hintHtml = '';
  let actionHtml = '';

  if (p.role === 'pupil') {
    hintHtml = `<p class="muted">Says they're in: ${escapeHtml(hint.class_name || 'unknown class')}</p>`;
    actionHtml = `
      <div class="field">
        <label>Link to existing pupil, or create new</label>
        <select data-existing-pupil-select="${p.id}">
          <option value="">— Create a new pupil record —</option>
        </select>
      </div>
      <div class="row-flex" data-new-pupil-fields="${p.id}">
        <div class="field">
          <label>New pupil name</label>
          <input type="text" data-new-pupil-name="${p.id}" value="${escapeHtml(p.full_name)}" />
        </div>
        <div class="field">
          <label>Class</label>
          <select data-new-pupil-class="${p.id}">
            ${classes.map((c) => `<option value="${c.id}" ${c.id === hint.class_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>`;
  } else if (p.role === 'teacher') {
    const suggested = hint.class_ids || [];
    hintHtml = `<p class="muted">Says they teach: ${suggested.length ? suggested.map((id) => escapeHtml(id)).join(', ') : 'not specified'}</p>`;
    actionHtml = `
      <div class="field">
        <label>Classes to link</label>
        <div class="pill-list">
          ${classes
            .map(
              (c) => `<label class="checkbox-pill">
                <input type="checkbox" data-teacher-class="${p.id}" value="${c.id}" ${suggested.includes(c.id) ? 'checked' : ''} />
                ${escapeHtml(c.name)}
              </label>`
            )
            .join('')}
        </div>
      </div>`;
  } else if (p.role === 'parent') {
    hintHtml = `<p class="muted">Says their child is: ${escapeHtml(hint.child_name || 'not specified')}</p>`;
    actionHtml = `
      <div class="field">
        <label>Link to pupil(s) — search by name isn't built yet, use the pupil ID</label>
        <input type="text" data-parent-pupil-ids="${p.id}" placeholder="Pupil ID(s), comma-separated" />
      </div>`;
  }

  return `
    <div class="card approval-card" data-approval-card="${p.id}">
      <div class="approval-head">
        <div>
          <div class="row-name">${escapeHtml(p.full_name)}</div>
          <span class="pill">${escapeHtml(p.role)}</span>
        </div>
        <span class="muted">${escapeHtml(p.email)}</span>
      </div>
      ${hintHtml}
      ${actionHtml}
      <div class="row-flex mt-2">
        <button class="btn btn-primary" data-approve-btn="${p.id}">Approve</button>
        <button class="btn" data-reject-btn="${p.id}">Reject</button>
      </div>
    </div>
  `;
}

function wireApprovalCard(container, p) {
  const card = container.querySelector(`[data-approval-card="${p.id}"]`);
  if (!card) return;

  if (p.role === 'pupil') {
    const existingSelect = card.querySelector(`[data-existing-pupil-select="${p.id}"]`);
    const newFields = card.querySelector(`[data-new-pupil-fields="${p.id}"]`);
    existingSelect.addEventListener('change', () => {
      newFields.classList.toggle('hidden', !!existingSelect.value);
    });
  }

  card.querySelector(`[data-approve-btn="${p.id}"]`).addEventListener('click', async () => {
    let body = {};
    if (p.role === 'pupil') {
      const existing = card.querySelector(`[data-existing-pupil-select="${p.id}"]`).value;
      if (existing) {
        body = { pupil_id: existing };
      } else {
        body = {
          new_pupil_name: card.querySelector(`[data-new-pupil-name="${p.id}"]`).value.trim(),
          class_id: card.querySelector(`[data-new-pupil-class="${p.id}"]`).value,
        };
      }
    } else if (p.role === 'teacher') {
      body = { class_ids: Array.from(card.querySelectorAll(`[data-teacher-class="${p.id}"]:checked`)).map((el) => el.value) };
    } else if (p.role === 'parent') {
      const raw = card.querySelector(`[data-parent-pupil-ids="${p.id}"]`).value.trim();
      body = { pupil_ids: raw.split(',').map((s) => s.trim()).filter(Boolean) };
    }
    try {
      await api.approveProfile(p.id, body);
      toast(`${p.full_name} approved`);
      card.remove();
    } catch (err) {
      toast(err.message);
    }
  });

  card.querySelector(`[data-reject-btn="${p.id}"]`).addEventListener('click', async () => {
    if (!confirm(`Reject ${p.full_name}'s account request?`)) return;
    try {
      await api.rejectProfile(p.id);
      toast(`${p.full_name} rejected`);
      card.remove();
    } catch (err) {
      toast(err.message);
    }
  });
}
