/**
 * @file group-edit.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Edit Group modal. Handles social link management, form validation, API submission for updating groups, and invite key management.
 */

import { api } from '../services/api.js';
import { renderSocialList, readSocialList } from '../components/render-group-helpers.js';
import { getGroupInviteKey, createGroupInviteKey } from '../services/groups-api.js';

// ── Edit Group ────────────────────────────────────────────────

// Callbacks set when modals are opened
let _onEdit = null;
let _editGroupId = null;

/**
 * @brief Opens the Edit Group modal pre-filled with current group data.
 *
 * Populates the form with existing group data, renders the social links list,
 * and fetches the current invite key for admin users.
 *
 * @param {Object} group - Current group data (id, name, join_policy, social).
 * @param {Function} onSuccess - Callback invoked after successful update.
 * @return {void}
 */
export function openEditGroup(group, onSuccess) {
  _onEdit = onSuccess;
  _editGroupId = group.id;

  let social = [];
  try {
    social = JSON.parse(group.social || '[]');
  } catch {
    /* empty */
  }
  // Clone so edits don't mutate the cached object
  const socialLinks = social.map((s) => ({ ...s }));

  document.getElementById('eg-name').value = group.name || '';
  document.getElementById('eg-policy').value = group.join_policy || 'open';
  document.getElementById('eg-err').textContent = '';
  renderSocialList(document.getElementById('eg-social-list'), socialLinks);
  document.getElementById('editGroupBg').style.display = 'flex';

  const addBtn = document.getElementById('eg-add-social');
  const fresh = addBtn.cloneNode(true);
  addBtn.replaceWith(fresh);
  fresh.addEventListener('click', () => {
    if (socialLinks.length >= 10) return;
    socialLinks.push({ platform: '', url: '' });
    renderSocialList(document.getElementById('eg-social-list'), socialLinks);
  });

  // Show invite key
  _showInviteKeySection(_editGroupId);
}

/**
 * @brief Fetches and displays the invite key for admins in the edit modal.
 *
 * Retrieves the current invite key using getGroupInviteKey and renders it
 * with Copy and Regenerate buttons. Regenerate calls createGroupInviteKey.
 *
 * @param {number} groupId - The ID of the group.
 * @return {Promise<void>}
 */
async function _showInviteKeySection(groupId) {
  const existing = document.getElementById('eg-invite-key-section');
  if (existing) existing.remove();

  const section = document.createElement('div');
  section.id = 'eg-invite-key-section';
  section.style.cssText = 'margin-top:12px';
  section.innerHTML =
    '<div class="cfield">' +
    '<label>Invite key</label>' +
    '<div id="eg-current-key" style="font-family:monospace;font-size:12px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text2);margin-bottom:8px;user-select:all;overflow:hidden;text-overflow:ellipsis;">Loading…</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" id="eg-copy-key" style="font-size:12px">Copy key</button>' +
    '<button class="btn" id="eg-regen-key" style="font-size:12px;color:var(--amber);border-color:var(--amber)">🔑 Regenerate</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-top:6px">Regenerating invalidates the old key immediately.</div>' +
    '</div>';

  document.getElementById('eg-social-list').parentElement.appendChild(section);

  const keyDisplay = section.querySelector('#eg-current-key');
  const copyBtn = section.querySelector('#eg-copy-key');
  const regenBtn = section.querySelector('#eg-regen-key');

  // Fetch current key
  const key = await getGroupInviteKey(groupId);
  keyDisplay.textContent = key || 'Could not load key.';

  copyBtn.addEventListener('click', async () => {
    const key = keyDisplay.textContent;
    if (!key || key === 'Could not load key.' || key === 'Loading…') return;
    await navigator.clipboard.writeText(key);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy key';
    }, 1800);
  });

  regenBtn.addEventListener('click', async () => {
    if (!confirm('Regenerate the invite key? The old key will stop working immediately.')) return;
    regenBtn.disabled = true;
    regenBtn.textContent = 'Regenerating…';
    const newKey = await createGroupInviteKey(groupId);
    keyDisplay.textContent = newKey || 'Error: Could not regenerate key.';
    regenBtn.disabled = false;
    regenBtn.textContent = '🔑 Regenerate';
  });
}

/**
 * @brief Initialises all Edit Group modal event listeners. Call once at boot.
 *
 * Sets up close handlers for the modal backdrop, close button, and cancel button.
 * Also wires the submit handler for group updates.
 *
 * @return {void}
 */
export function initEditGroup() {
  const closeFn = () => {
    document.getElementById('editGroupBg').style.display = 'none';
    const keySection = document.getElementById('eg-invite-key-section');
    if (keySection) keySection.remove();
  };
  document.getElementById('editGroupClose').addEventListener('click', closeFn);
  document.getElementById('editGroupCancel').addEventListener('click', closeFn);
  document.getElementById('editGroupBg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editGroupBg')) closeFn();
  });

  document.getElementById('eg-submit').addEventListener('click', async () => {
    const name = document.getElementById('eg-name').value.trim();
    const join_policy = document.getElementById('eg-policy').value;
    const social = readSocialList(document.getElementById('eg-social-list'));
    const errEl = document.getElementById('eg-err');

    errEl.textContent = '';
    if (!name) {
      errEl.textContent = 'Group name is required.';
      return;
    }

    const btn = document.getElementById('eg-submit');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const res = await api('/api/groups/' + _editGroupId, 'PUT', { name, join_policy, social });
      if (res.error) {
        errEl.textContent = res.error;
        btn.disabled = false;
        btn.textContent = 'Save changes';
        return;
      }
      closeFn();
      btn.disabled = false;
      btn.textContent = 'Save changes';
      if (_onEdit) await _onEdit();
    } catch (e) {
      console.error('Edit group failed:', e);
      errEl.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Save changes';
    }
  });
}