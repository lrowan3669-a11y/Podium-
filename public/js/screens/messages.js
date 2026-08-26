import { api } from '../api.js';
import { escapeHtml, toast } from '../util.js';
import { avatarHtml, wireAvatarFallbacks } from '../avatarWidget.js';

export async function renderMessages(container, params) {
  const [openId] = params;
  const inbox = await api.getInbox();

  container.innerHTML = `
    <h1 class="screen-title">Messages</h1>
    <div class="messages-layout">
      <div class="card message-contact-list" id="message-contacts">
        ${
          inbox.length
            ? inbox
                .map(
                  (row) => `
              <a href="#/messages/${row.contact.id}" class="message-contact ${String(row.contact.id) === String(openId) ? 'active' : ''}" data-contact-id="${row.contact.id}">
                ${avatarHtml(row.contact.id, row.contact.full_name, 36)}
                <div class="message-contact-body">
                  <div class="message-contact-name">${escapeHtml(row.contact.full_name)} <span class="muted">· ${escapeHtml(row.contact.role)}</span></div>
                  <div class="message-contact-preview">${row.lastMessage ? escapeHtml(row.lastMessage.body).slice(0, 60) : 'Say hello'}</div>
                </div>
                ${row.unreadCount ? `<span class="message-unread-badge">${row.unreadCount}</span>` : ''}
              </a>`
                )
                .join('')
            : `<div class="empty-state">Nobody to message yet.</div>`
        }
      </div>
      <div class="card message-thread" id="message-thread">
        ${openId ? '' : `<div class="empty-state">Pick someone to message.</div>`}
      </div>
    </div>
  `;

  wireAvatarFallbacks(container.querySelector('#message-contacts'));

  if (openId) await renderThread(container, openId);
}

async function renderThread(container, otherId) {
  const threadEl = container.querySelector('#message-thread');
  const { contact, messages } = await api.getThread(otherId);

  threadEl.innerHTML = `
    <div class="message-thread-header">${escapeHtml(contact.full_name)} <span class="muted">· ${escapeHtml(contact.role)}</span></div>
    <div class="message-thread-body" id="message-thread-body">
      ${
        messages.length
          ? messages.map((m) => messageBubbleHtml(m, otherId)).join('')
          : `<div class="empty-state">No messages yet — say hello.</div>`
      }
    </div>
    <form id="message-send-form" class="message-send-form">
      <input id="message-send-input" type="text" placeholder="Type a message…" autocomplete="off" />
      <button type="submit" class="btn btn-primary">Send</button>
    </form>
  `;

  const bodyEl = threadEl.querySelector('#message-thread-body');
  bodyEl.scrollTop = bodyEl.scrollHeight;

  threadEl.querySelector('#message-send-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = threadEl.querySelector('#message-send-input');
    const body = input.value.trim();
    if (!body) return;
    try {
      await api.sendMessage(otherId, body);
      input.value = '';
      await renderThread(container, otherId);
    } catch (err) {
      toast(err.message);
    }
  });
}

function messageBubbleHtml(m, otherId) {
  const fromMe = String(m.sender_id) !== String(otherId);
  return `
    <div class="message-bubble-row ${fromMe ? 'from-me' : 'from-them'}">
      <div class="message-bubble">${escapeHtml(m.body)}</div>
    </div>`;
}
