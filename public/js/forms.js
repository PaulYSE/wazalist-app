/* forms.js — the Contribute and Account tab renderers. */
import { state } from './state.js';
import { doLogout } from './core.js';
import { renderImport } from './import-ui.js';
import { exportToExcel } from './export.js';
import { escapeHtml } from './ui.js';
import { openNewWazaModal } from './contribute-modals.js';

export async function renderContribute() {
  const container = document.getElementById('contributeContent');
  const loggedIn = !state.isGuest && !!state.token;

  // Sign-in prompt for guests / logged-out users
  const authPrompt = loggedIn ? '' :
    '<div class="dsec2" style="text-align:center;padding:24px 0">'
    + '<div style="font-size:28px;margin-bottom:8px">🔒</div>'
    + '<div style="font-weight:600;margin-bottom:6px">Sign in to contribute</div>'
    + '<div style="font-size:13px;color:var(--text3);margin-bottom:16px">You need an account to submit Waza or suggest edits.</div>'
    + '<button class="btn" id="contribSignInBtn">Sign in / Register</button>'
    + '</div>';

  // Actions (only shown when logged in)
  const actionsHTML = loggedIn ?
    '<div class="dsec2"><h3>Actions</h3>'
    + '<div style="display:flex;flex-wrap:wrap;gap:10px">'
    + '<button class="btn" id="contribNewWazaBtn">+ Submit New Waza</button>'
    + (state.isAdmin ? '<a class="btn" href="/admin" target="_blank" style="text-decoration:none">⚙ Admin Panel</a>' : '')
    + '</div></div>'
    : '';

  // Contributions history
  let historyHTML = '<div class="dsec2"><h3>Your contributions</h3>';
  if (!loggedIn) {
    historyHTML += '<div style="color:var(--text3);font-size:13px;padding:8px 0">Sign in to see your contribution history.</div></div>';
  } else {
    historyHTML += '<div id="contribHistoryList"><div style="color:var(--text3);font-size:13px">Loading…</div></div></div>';
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
    if (!contribs.length) { histList.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">You haven\'t submitted any contributions yet.</div>'; return; }
    const statusLabel = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
    histList.innerHTML = contribs.map(c => {
      const payload = JSON.parse(c.payload || '{}');
      const isNew = c.type === 'new_waza';
      const name = isNew ? (payload.name_jp || 'New Waza') : (c.waza_name_jp || 'Waza #' + c.waza_id);
      const fields = Object.keys(payload).filter(k => !isNew || payload[k]);
      const summary = isNew
        ? 'New waza: ' + (fields.slice(0, 4).join(', ')) + (fields.length > 4 ? ' +' + (fields.length - 4) + ' more' : '')
        : 'Edited: ' + (fields.slice(0, 4).join(', ')) + (fields.length > 4 ? ' +' + (fields.length - 4) + ' more' : '');
      return '<div class="contrib-item">'
        + '<div class="ci-header">'
        + '<span class="contrib-type ' + (isNew ? 'ct-new' : 'ct-edit') + '">' + (isNew ? 'New Waza' : 'Edit') + '</span>'
        + '<span style="font-size:13px;font-weight:500">' + escapeHtml(name) + '</span>'
        + '<span class="contrib-status cs-' + c.status + '">' + statusLabel[c.status] + '</span>'
        + '</div>'
        + '<div class="ci-meta" style="font-size:12px;color:var(--text3)">' + summary + '</div>'
        + (c.admin_note ? '<div class="ci-note">' + escapeHtml(c.admin_note) + '</div>' : '')
        + '</div>';
    }).join('');
  } catch (e) { histList.innerHTML = '<div style="color:var(--red);font-size:13px">Failed to load contributions.</div>'; }
}

// ── Account ───────────────────────────────────────────────────
export async function renderAccount() {
  const container = document.getElementById('accountContent');
  const loggedIn = !state.isGuest && !!state.token;

  // Account info section
  const accountInfoHTML = loggedIn
    ? `<div class="dsec2">
            <h3>Account Information</h3>
            <div style="display:grid;gap:10px;font-size:13px">
              <div style="display:flex;gap:8px">
                <span style="color:var(--text3);min-width:100px">Username:</span>
                <span style="font-weight:500">${escapeHtml(state.currentUsername)}</span>
              </div>
              <div style="display:flex;gap:8px">
                <span style="color:var(--text3);min-width:100px">Account type:</span>
                <span>${state.isAdmin ? '<span style="color:var(--accent)">Admin</span>' : 'User'}</span>
              </div>
            </div>
          </div>`
    : `<div class="dsec2" style="text-align:center;padding:24px 0">
            <div style="font-size:28px;margin-bottom:8px">👤</div>
            <div style="font-weight:600;margin-bottom:6px">Guest Mode</div>
            <div style="font-size:13px;color:var(--text3);margin-bottom:16px">You're using guest mode. Your data is stored locally in your browser.</div>
          </div>`;

  // Actions section (logout/sign out)
  const actionsHTML = loggedIn
    ? `<div class="dsec2" style="margin-top:20px">
            <button class="btn" id="logoutBtn" style="background:var(--bg3);border:1px solid var(--border);color:var(--text2)">
              Sign Out
            </button>
          </div>`
    : `<div class="dsec2" style="margin-top:20px">
            <button class="btn" id="signInBtn" style="background:var(--accent);border:1px solid var(--accent);color:white">
              Sign In / Register
            </button>
          </div>`;

  // Progress stats - state.prog is an object keyed by waza_id
  const progEntries = Object.values(state.prog);
  const totalMarked = progEntries.filter(p => p.markings && p.markings.some(m => m)).length;
  const totalLiked = progEntries.filter(p => p.like === 1).length;
  const totalDisliked = progEntries.filter(p => p.like === -1).length;

  const statsHTML = `<div class="dsec2">
        <h3>Your Progress</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:12px">
          <div style="padding:12px;background:var(--bg2);border-radius:var(--r);text-align:center">
            <div style="font-size:24px;font-weight:700;color:var(--accent)">${totalMarked}</div>
            <div style="font-size:12px;color:var(--text3)">Waza marked</div>
          </div>
          <div style="padding:12px;background:var(--bg2);border-radius:var(--r);text-align:center">
            <div style="font-size:24px;font-weight:700;color:var(--green)">${totalLiked}</div>
            <div style="font-size:12px;color:var(--text3)">Liked</div>
          </div>
          <div style="padding:12px;background:var(--bg2);border-radius:var(--r);text-align:center">
            <div style="font-size:24px;font-weight:700;color:var(--red)">${totalDisliked}</div>
            <div style="font-size:12px;color:var(--text3)">Disliked</div>
          </div>
        </div>
      </div>`;

  // ── Export to Excel ───────────────────────────────────────────
  const exportHTML = `<div class="dsec2" style="margin-top:20px">
        <h3>Export to Excel</h3>
        <p style="font-size:13px;color:var(--text2);margin:8px 0 12px">
          Download an <b>.xlsx</b> of every waza you've marked. Each entry is a clickable link to its video,
          shown as <code>name_en(name_jp)</code>, with the cell coloured by its marking.
        </p>
        <button class="cbtn cbtn-primary" id="exportXlsxBtn">⬇️ Export to Excel</button>
        <span id="exportXlsxStatus" style="font-size:13px;color:var(--text3);margin-left:10px"></span>
      </div>`;

  // ── Import (moved here from the old Import List tab) ───────────
  const importHTML = `<div class="dsec2" style="margin-top:20px">
        <h3>Import</h3>
        <div id="dashImport" style="margin-top:8px"></div>
      </div>`;

  // Danger zone
  const dangerZoneHTML = `<div class="dsec2" style="border:1px solid var(--red);border-radius:var(--rl);padding:16px;margin-top:20px">
        <h3 style="color:var(--red)">⚠️ Danger Zone</h3>
        <p style="font-size:13px;color:var(--text2);margin:12px 0">
          This will permanently delete all your progress data, including markings, likes, and custom labels. 
          ${loggedIn ? 'This action cannot be undone.' : 'Your local browser data will be cleared.'}
        </p>
        <button class="btn" id="resetAccountBtn" style="background:var(--bg3);border:1px solid var(--red);color:var(--red)">
          🗑️ Reset All Progress
        </button>
      </div>`;

  // Delete account (logged-in users only) — bottom-most option
  const deleteAccountHTML = loggedIn
    ? `<div class="dsec2" style="border:1px solid var(--red);border-radius:var(--rl);padding:16px;margin-top:20px">
            <h3 style="color:var(--red)">Delete Account</h3>
            <p style="font-size:13px;color:var(--text2);margin:12px 0">
              Permanently delete your account and everything tied to it — your login, all marked waza,
              likes and dislikes, custom labels, contribution history, and active sessions.
              This cannot be undone.
            </p>
            <button class="btn" id="deleteAccountBtn" style="background:var(--red);border:1px solid var(--red);color:white">
              Delete My Account
            </button>
          </div>`
    : '';

  container.innerHTML = accountInfoHTML + statsHTML + exportHTML + importHTML + dangerZoneHTML + actionsHTML + deleteAccountHTML;

  // Populate the moved import UI (renders into the #dashImport above)
  renderImport();

  // Bind export button
  container.querySelector('#exportXlsxBtn')?.addEventListener('click', () => exportToExcel());

  // Bind reset button
  const resetBtn = container.querySelector('#resetAccountBtn');
  resetBtn?.addEventListener('click', async () => {
    const confirmMsg = loggedIn
      ? `⚠️ WARNING: This will permanently delete ALL your progress data:\n\n` +
      `• ${totalMarked} marked Waza\n` +
      `• ${totalLiked} likes and ${totalDisliked} dislikes\n` +
      `• All custom marking labels\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Type "RESET" to confirm:`
      : `⚠️ WARNING: This will clear all your local progress data:\n\n` +
      `• ${totalMarked} marked Waza\n` +
      `• ${totalLiked} likes and ${totalDisliked} dislikes\n` +
      `• All custom marking labels\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Type "RESET" to confirm:`;

    const confirmation = prompt(confirmMsg);

    if (confirmation !== 'RESET') {
      if (confirmation !== null) {
        alert('Reset cancelled. Please type "RESET" exactly to confirm.');
      }
      return;
    }

    // Proceed with reset
    resetBtn.disabled = true;
    resetBtn.textContent = '⏳ Resetting...';

    try {
      if (loggedIn) {
        // For logged-in users, reset on server
        // Delete all progress entries for this user
        const wazaIds = state.wazaData.map(w => w.id);
        for (const wid of wazaIds) {
          await api('/api/progress', 'POST', {
            waza_id: wid,
            markings: '[]',
            like: null
          });
        }

        // Reset custom labels to empty
        await api('/api/labels', 'POST', { labels: ['', '', '', '', '', ''] });
      }

      // Clear local cache
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_LABELS);
      localStorage.removeItem(LS_SORT);
      localStorage.removeItem(LS_VIEW);
      state.prog = {};
      state.markingLabels = ['', '', '', '', '', ''];

      alert('✅ All progress data has been reset successfully.');

      // Reload to refresh everything
      location.reload();

    } catch (e) {
      alert('❌ Failed to reset progress. Please try again.');
      resetBtn.disabled = false;
      resetBtn.textContent = '🗑️ Reset All Progress';
    }
  });

  // Bind logout button
  container.querySelector('#logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
      doLogout();
    }
  });

  // Bind sign in button
  container.querySelector('#signInBtn')?.addEventListener('click', doLogout);

  // Bind delete-account button
  const deleteBtn = container.querySelector('#deleteAccountBtn');
  deleteBtn?.addEventListener('click', async () => {
    const sure = confirm(
      '⚠️ This permanently deletes your account and ALL associated data:\n\n' +
      '• Your login\n' +
      `• ${totalMarked} marked Waza\n` +
      `• ${totalLiked} likes and ${totalDisliked} dislikes\n` +
      '• Custom labels and contribution history\n\n' +
      'This CANNOT be undone. Continue?'
    );
    if (!sure) return;

    const password = prompt('Enter your password to confirm account deletion:');
    if (!password) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = '⏳ Deleting…';

    try {
      const res = await api('/api/account', 'DELETE', { password });
      if (res.error) {
        alert('❌ ' + res.error);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete My Account';
        return;
      }
      // Wipe local state and drop to a logged-out screen.
      localStorage.removeItem('wl_state.token');
      localStorage.removeItem('wl_username');
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_LABELS);
      localStorage.removeItem(LS_SORT);
      localStorage.removeItem(LS_VIEW);
      alert('Your account has been deleted.');
      location.reload();
    } catch (e) {
      alert('❌ Failed to delete account. Please try again.');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete My Account';
    }
  });
}

// ── Export to Excel ───────────────────────────────────────────
// One ARGB fill per marking index (matches the ● ▲ ■ ♥ ★ ◆ order).
