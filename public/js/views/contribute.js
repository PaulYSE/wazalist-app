/**
 * @file contribute.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Contribution view. Allows logged-in users to submit new waza suggestions and view their contribution history with status tracking.
 */

import { state } from '../state/state.js';
import { api } from '../services/api.js';
import { doLogout } from '../services/auth.js';
import { escapeHtml } from '../lib/escape.js';
import { openNewWazaModal } from '../modals/waza-new.js';

/**
 * @brief Renders the contribute view with sign-in prompt, action buttons, and contribution history.
 *
 * @return {Promise<void>}
 */
export async function renderContribute() {
  const container = document.getElementById('contributeContent');
  const loggedIn = !state.isGuest && !!state.token;

  // Sign-in prompt for guests / logged-out users
  const authPrompt = loggedIn
    ? ''
    : '<div class="dsec2" style="text-align:center;padding:24px 0">' +
      '<div style="font-size:28px;margin-bottom:8px">🔒</div>' +
      '<div style="font-weight:600;margin-bottom:6px">Sign in to contribute</div>' +
      '<div style="font-size:13px;color:var(--text3);margin-bottom:16px">You need an account to submit Waza or suggest edits.</div>' +
      '<button class="btn" id="contribSignInBtn">Sign in / Register</button>' +
      '</div>';

  // Actions (only shown when logged in)
  const actionsHTML = loggedIn
    ? '<div class="dsec2"><h3>Actions</h3>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px">' +
      '<button class="btn" id="contribNewWazaBtn">+ Submit New Waza</button>' +
      '</div></div>'
    : '';

  // Contributions history
  let historyHTML = '<div class="dsec2"><h3>Your contributions</h3>';
  if (!loggedIn) {
    historyHTML +=
      '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sign in to see your contribution history.</div></div>';
  } else {
    historyHTML +=
      '<div id="contribHistoryList"><div style="color:var(--text3);font-size:13px">Loading…</div></div></div>';
  }

  container.innerHTML = authPrompt + actionsHTML + historyHTML;

  if (!loggedIn) {
    container.querySelector('#contribSignInBtn')?.addEventListener('click', doLogout); // doLogout triggers reload → auth screen
    return;
  }

  container.querySelector('#contribNewWazaBtn')?.addEventListener('click', openNewWazaModal);

  // Load history async
  const histList = container.querySelector('#contribHistoryList');
  try {
    const contribs = await api('/api/contributions/mine');
    if (!contribs.length) {
      histList.innerHTML =
        '<div style="color:var(--text3);font-size:13px;padding:8px 0">You haven\'t submitted any contributions yet.</div>';
      return;
    }
    const statusLabel = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
    histList.innerHTML = contribs
      .map((c) => {
        const payload = JSON.parse(c.payload || '{}');
        const isNew = c.type === 'new_waza';
        const name = isNew ? payload.name_jp || 'New Waza' : c.waza_name_jp || 'Waza #' + c.waza_id;
        const fields = Object.keys(payload).filter((k) => !isNew || payload[k]);
        const summary = isNew
          ? 'New waza: ' +
            fields.slice(0, 4).join(', ') +
            (fields.length > 4 ? ' +' + (fields.length - 4) + ' more' : '')
          : 'Edited: ' +
            fields.slice(0, 4).join(', ') +
            (fields.length > 4 ? ' +' + (fields.length - 4) + ' more' : '');
        return (
          '<div class="contrib-item">' +
          '<div class="ci-header">' +
          '<span class="contrib-type ' +
          (isNew ? 'ct-new' : 'ct-edit') +
          '">' +
          (isNew ? 'New Waza' : 'Edit') +
          '</span>' +
          '<span style="font-size:13px;font-weight:500">' +
          escapeHtml(name) +
          '</span>' +
          '<span class="contrib-status cs-' +
          c.status +
          '">' +
          statusLabel[c.status] +
          '</span>' +
          '</div>' +
          '<div class="ci-meta" style="font-size:12px;color:var(--text3)">' +
          summary +
          '</div>' +
          (c.admin_note ? '<div class="ci-note">' + escapeHtml(c.admin_note) + '</div>' : '') +
          '</div>'
        );
      })
      .join('');
  } catch (e) {
    console.error('Failed to load contributions:', e);
    histList.innerHTML =
      '<div style="color:var(--red);font-size:13px">Failed to load contributions.</div>';
  }
}
