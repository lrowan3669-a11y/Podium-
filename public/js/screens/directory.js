import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';

export async function renderDirectory(container) {
  const [pupils, classes] = await Promise.all([api.getDirectory(), api.getClasses()]);

  container.innerHTML = `
    <h1 class="screen-title">Directory</h1>
    <p class="screen-sub">Pupils who haven't been claimed into a class yet — visible to every member of staff.</p>
    ${
      !classes.length
        ? `<div class="empty-state">No classes exist yet — create one in Teacher Admin before claiming pupils.</div>`
        : !pupils.length
          ? `<div class="empty-state">Nobody's waiting to be claimed right now.</div>`
          : `<div class="card"><table>
              <thead><tr><th>Name</th><th>Claim into</th><th></th></tr></thead>
              <tbody>
                ${pupils
                  .map(
                    (p) => `
                  <tr>
                    <td>${escapeHtml(p.name)}</td>
                    <td>
                      <select data-claim-class="${p.id}">
                        ${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                      </select>
                    </td>
                    <td><button class="btn btn-primary" data-claim-btn="${p.id}">Claim</button></td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table></div>`
    }
  `;

  container.querySelectorAll('[data-claim-btn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pupilId = btn.dataset.claimBtn;
      const classId = container.querySelector(`[data-claim-class="${pupilId}"]`).value;
      try {
        await api.claimPupil(pupilId, classId);
        toast('Pupil claimed');
        renderDirectory(container);
      } catch (e) {
        toast(e.message);
      }
    });
  });
}
