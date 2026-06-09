/**
 * @file account.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Account management view. Handles import/export UI, username/password changes, progress reset, and account deletion with accordion sections.
 */

import { state } from '../state/state.js';
import { LS_KEY, LS_LABELS, LS_SORT, LS_VIEW } from '../state/localStorage.js';
import { api } from '../services/api.js';
import { escapeHtml } from '../lib/escape.js';
import { exportToExcel } from '../features/export-to-excel.js';
import { renderImport } from '../features/import/import-ui.js';

// Open one accordion section, closing any others. Exported so other modules
// (e.g. onboarding's "import from Excel" redirect) can jump to a section.
// Safe to call before or after renderAccount has run: it updates the state
// object always, and the DOM only if the section elements are present.

/**
 * @brief Opens a specific accordion section and closes all others.
 *
 * @param {string} key - Section key ('import', 'export', or 'manage').
 * @return {void}
 */
export function openAccountSection(key) {
  Object.keys(accOpen).forEach((k) => {
    accOpen[k] = k === key;
  });
  document.querySelectorAll('.acc-toggle').forEach((el) => {
    const open = el.dataset.acc === key;
    el.classList.toggle('collapsed', !open);
    el.nextElementSibling.classList.toggle('open', open); // animate via class, not display
  });
}

// Accordion open/closed state — module-level so it persists across re-renders
// Accordion state — only ONE section open at a time. Manage is the default.
const accOpen = { import: false, export: false, manage: true };

// Collapsible accordion section, reusing the .dsec-toggle / .dsec-body mechanism.

/**
 * @brief Generates HTML for a collapsible accordion section.
 *
 * @param {string} key - Section identifier.
 * @param {string} label - Section title.
 * @param {string} innerHTML - Inner HTML content.
 * @return {string} Accordion section HTML.
 */
function accSection(key, label, innerHTML) {
  const open = accOpen[key];
  return (
    '<div class="dsec2">' +
    '<div class="dsec-toggle acc-toggle' +
    (open ? '' : ' collapsed') +
    '" data-acc="' +
    key +
    '">' +
    '<h3 style="margin-bottom:0;border-bottom:none;padding-bottom:0">' +
    label +
    '</h3><span class="toggle-arrow">▾</span></div>' +
    '<div class="acc-body' +
    (open ? ' open' : '') +
    '"><div class="acc-body-inner"><div class="acc-body-box">' +
    innerHTML +
    '</div></div></div></div>'
  );
}

// ── Account ───────────────────────────────────────────────────

/**
 * @brief Renders the full account management view.
 *
 * Displays accordion sections for Import, Export, and Manage Account.
 * Handles all event bindings for username/password changes, progress reset, and account deletion.
 *
 * @return {Promise<void>}
 */
export async function renderAccount() {
  const container = document.getElementById('accountContent');
  const loggedIn = !state.isGuest && !!state.token;

  // Progress counts (used in the simplified Your Progress line + confirm dialogs)
  const progEntries = Object.values(state.prog);
  const totalMarked = progEntries.filter((p) => p.markings && p.markings.some((m) => m)).length;
  const totalLiked = progEntries.filter((p) => p.like === 1).length;
  const totalDisliked = progEntries.filter((p) => p.like === -1).length;

  // ── Import Wazalist ───────────────────────────────────────────
  // renderImport() populates #dashImport with both the Excel and Text panels.
  const importBody = '<div id="dashImport" style="margin-top:8px"></div>';

  // ── Export Wazalist ───────────────────────────────────────────
  const exportBody = `
    <h4 style="font-size:13px;font-weight:600;margin:4px 0 8px">Export to Excel</h4>
    <p style="font-size:13px;color:var(--text2);margin:0 0 12px">
      Download an <b>.xlsx</b> of every waza you've marked. Each entry is a clickable link to its video,
      shown as <code>name_en(name_jp)</code>, with the cell coloured by its marking.
    </p>
    <button class="cbtn cbtn-primary" id="exportXlsxBtn">⬇️ Export to Excel</button>
    <span id="exportXlsxStatus" style="font-size:13px;color:var(--text3);margin-left:10px"></span>`;

  // ── Manage Account ────────────────────────────────────────────
  // Account Information
  const accountInfoBlock = loggedIn
    ? `<div style="margin-bottom:18px">
        <h4 style="font-size:13px;font-weight:600;margin:4px 0 8px">Account Information</h4>
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
    : `<div style="text-align:center;padding:16px 0;margin-bottom:18px">
        <div style="font-size:28px;margin-bottom:8px">👤</div>
        <div style="font-weight:600;margin-bottom:6px">Guest Mode</div>
        <div style="font-size:13px;color:var(--text3)">You're using guest mode. Your data is stored locally in your browser.</div>
      </div>`;

  // Change Username (logged-in only) — form is built now; backend route is pending,
  // so the handler shows a "coming soon" note until /api/account/username exists.
  const changeUsernameBlock = loggedIn
    ? `<div class="acc-form">
        <h4>Change Username</h4>
        <div class="cfield"><label>New username</label><input id="acc-new-username" type="text" placeholder="New username" autocomplete="off"></div>
        <button class="cbtn cbtn-primary" id="changeUsernameBtn">Update username</button>
        <div id="changeUsernameMsg" class="acc-form-msg"></div>
      </div>`
    : '';

  // Change Password (logged-in only) — same: form now, backend pending.
  const changePasswordBlock = loggedIn
    ? `<div class="acc-form">
        <h4>Change Password</h4>
        <div class="cfield"><label>Current password</label><input id="acc-cur-pw" type="password" autocomplete="current-password"></div>
        <div class="cfield"><label>New password</label><input id="acc-new-pw" type="password" autocomplete="new-password"></div>
        <button class="cbtn cbtn-primary" id="changePasswordBtn">Update password</button>
        <div id="changePasswordMsg" class="acc-form-msg"></div>
      </div>`
    : '';

  // Your Progress (simplified) + Reset All Progress
  const resetBlock = `
    <div style="margin-bottom:18px;border-top:1px solid var(--border);padding-top:16px">
      <h4 style="font-size:13px;font-weight:600;margin:0 0 8px">Your Progress</h4>
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
        Marked: <b style="color:var(--accent)">${totalMarked}</b> &nbsp;·&nbsp;
        Liked: <b style="color:var(--green)">${totalLiked}</b> &nbsp;·&nbsp;
        Disliked: <b style="color:var(--red)">${totalDisliked}</b>
      </div>
      <p style="font-size:12px;color:var(--text3);margin:0 0 10px">
        Permanently deletes all your markings, likes, and custom labels.
        ${loggedIn ? 'This cannot be undone.' : 'Your local browser data will be cleared.'}
      </p>
      <button class="btn" id="resetAccountBtn" style="background:var(--bg3);border:1px solid var(--red);color:var(--red)">
        🗑️ Reset All Progress
      </button>
    </div>`;

  // Delete Account (logged-in only) — bottom-most
  const deleteBlock = loggedIn
    ? `<div style="border:1px solid var(--red);border-radius:var(--rl);padding:16px">
        <h4 style="color:var(--red);font-size:13px;font-weight:600;margin:0 0 8px">Delete Account</h4>
        <p style="font-size:12px;color:var(--text2);margin:0 0 12px">
          Permanently delete your account and everything tied to it — your login, all marked waza,
          likes and dislikes, custom labels, contribution history, and active sessions. This cannot be undone.
        </p>
        <button class="btn" id="deleteAccountBtn" style="background:var(--red);border:1px solid var(--red);color:white">
          Delete My Account
        </button>
      </div>`
    : '';

  const manageBody =
    accountInfoBlock + changeUsernameBlock + changePasswordBlock + resetBlock + deleteBlock;

  // ── Assemble accordions ───────────────────────────────────────
  container.innerHTML =
    accSection('import', 'Import Wazalist', importBody) +
    accSection('export', 'Export Wazalist', exportBody) +
    accSection('manage', 'Manage Account', manageBody);

  // Populate the import UI (renders into #dashImport, even if the section is collapsed)
  renderImport();

  // ── Accordion toggles ─────────────────────────────────────────
  container.querySelectorAll('.acc-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.acc;
      if (accOpen[key]) {
        accOpen[key] = false;
        el.classList.toggle('collapsed', true);
        el.nextElementSibling.classList.remove('open');
      } else {
        openAccountSection(key);
      }
    });
  });

  // ── Export ────────────────────────────────────────────────────
  container.querySelector('#exportXlsxBtn')?.addEventListener('click', () => exportToExcel());

  container.querySelector('#changeUsernameBtn')?.addEventListener('click', async () => {
    const msg = container.querySelector('#changeUsernameMsg');
    const newUsername = container.querySelector('#acc-new-username').value.trim();
    const password = prompt('Enter your current password to confirm the username change:');
    if (!password) return;
    msg.className = 'acc-form-msg';
    msg.style.color = 'var(--text3)';
    msg.textContent = 'Updating…';
    const res = await api('/api/account/username', 'POST', { username: newUsername, password });
    if (res.error) {
      msg.className = 'acc-form-msg err';
      msg.textContent = res.error;
      return;
    }
    // Update local identity to match the server.
    state.currentUsername = res.username;
    localStorage.setItem('wl_username', res.username);
    const badge = document.getElementById('usernameBadge');
    if (badge) badge.textContent = '@' + res.username;
    msg.className = 'acc-form-msg ok';
    msg.textContent = 'Username updated.';
    container.querySelector('#acc-new-username').value = '';
    renderAccount(); // refresh the Account Information block
  });

  container.querySelector('#changePasswordBtn')?.addEventListener('click', async () => {
    const msg = container.querySelector('#changePasswordMsg');
    const current = container.querySelector('#acc-cur-pw').value;
    const next = container.querySelector('#acc-new-pw').value;
    if (!current || !next) {
      msg.className = 'acc-form-msg err';
      msg.textContent = 'Both fields are required.';
      return;
    }
    msg.className = 'acc-form-msg';
    msg.style.color = 'var(--text3)';
    msg.textContent = 'Updating…';
    const res = await api('/api/account/password', 'POST', { current, next });
    if (res.error) {
      msg.className = 'acc-form-msg err';
      msg.textContent = res.error;
      return;
    }
    // Password changed → backend killed all sessions. We're logged out now.
    msg.className = 'acc-form-msg ok';
    msg.textContent = 'Password changed. Signing you out…';
    setTimeout(() => {
      localStorage.removeItem('wl_token');
      localStorage.removeItem('wl_username');
      location.reload();
    }, 1200);
  });

  // ── Reset All Progress ────────────────────────────────────────
  const resetBtn = container.querySelector('#resetAccountBtn');
  resetBtn?.addEventListener('click', async () => {
    const confirmMsg =
      `⚠️ WARNING: This will ${loggedIn ? 'permanently delete' : 'clear'} ALL your progress data:\n\n` +
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

    resetBtn.disabled = true;
    resetBtn.textContent = '⏳ Resetting...';

    try {
      if (loggedIn) {
        await api('/api/progress', 'DELETE');
        await api('/api/labels', 'POST', { labels: ['', '', '', '', '', ''] });
      }
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_LABELS);
      localStorage.removeItem(LS_SORT);
      localStorage.removeItem(LS_VIEW);
      state.prog = {};
      state.markingLabels = ['', '', '', '', '', ''];
      alert('✅ All progress data has been reset successfully.');
      location.reload();
    } catch (e) {
      console.error('Reset progress failed:', e);
      alert('❌ Failed to reset progress. Please try again.');
      resetBtn.disabled = false;
      resetBtn.textContent = '🗑️ Reset All Progress';
    }
  });

  // ── Delete Account ────────────────────────────────────────────
  const deleteBtn = container.querySelector('#deleteAccountBtn');
  deleteBtn?.addEventListener('click', async () => {
    const sure = confirm(
      '⚠️ This permanently deletes your account and ALL associated data:\n\n' +
        '• Your login\n' +
        `• ${totalMarked} marked Waza\n` +
        `• ${totalLiked} likes and ${totalDisliked} dislikes\n` +
        '• Custom labels and contribution history\n\n' +
        'This CANNOT be undone. Continue?',
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
      localStorage.removeItem('wl_token');
      localStorage.removeItem('wl_username');
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_LABELS);
      localStorage.removeItem(LS_SORT);
      localStorage.removeItem(LS_VIEW);
      alert('Your account has been deleted.');
      location.reload();
    } catch (e) {
      console.error('Delete account failed:', e);
      alert('❌ Failed to delete account. Please try again.');
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete My Account';
    }
  });
}
