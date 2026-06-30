/**
 * @file group-edit.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Edit Group modal. Handles social link management, form validation, API submission for updating groups, and invite key management.
 */

import { api } from '../services/api.js';
import { renderSocialList, readSocialList } from '../components/render-groups-socials.js';
import { getGroupInviteKey, createGroupInviteKey } from '../services/groups-api.js';

// ── Invite key ───────────────────────────

/**
 * @brief Generates the HTML for the invite key section.
 *
 * @param {string} idPrefix - Prefix for DOM IDs (e.g., 'eg' for edit group).
 * @return {string} HTML string for the invite key section.
 */
function renderGroupInviteKeyHTML(idPrefix) {
  return (
    '<div class="cfield">' +
    '<label>Invite key</label>' +
    '<div id="' +
    idPrefix +
    '-current-key" style="font-family:monospace;font-size:12px;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text2);margin-bottom:8px;user-select:all;overflow:hidden;text-overflow:ellipsis;">Loading…</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" id="' +
    idPrefix +
    '-copy-key" style="font-size:12px">Copy key</button>' +
    '<button class="btn" id="' +
    idPrefix +
    '-copy-link" style="font-size:12px">🔗 Copy link</button>' +
    '<button class="btn" id="' +
    idPrefix +
    '-regen-key" style="font-size:12px;color:var(--amber);border-color:var(--amber)">🔑 Regenerate</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text3);margin-top:6px">Anyone with the link or key can join immediately, regardless of this Group\'s join policy. Regenerating invalidates both right away.</div>' +
    '</div>'
  );
}

/**
 * @brief Wires copy and regenerate event handlers for the invite key section.
 *
 * @param {HTMLElement} section - The section container element.
 * @param {string} idPrefix - Prefix for DOM IDs used in the section.
 * @param {number} groupId - The ID of the group.
 * @return {void}
 */
function wireGroupInviteKeyEvents(section, idPrefix, groupId) {
  const keyDisplay = section.querySelector('#' + idPrefix + '-current-key');
  const copyBtn = section.querySelector('#' + idPrefix + '-copy-key');
  const copyLinkBtn = section.querySelector('#' + idPrefix + '-copy-link');
  const regenBtn = section.querySelector('#' + idPrefix + '-regen-key');

  // Shared guard: the key display still shows a placeholder, not a real key.
  const keyNotReady = () => {
    const key = keyDisplay.textContent;
    return !key || key === 'Could not load key.' || key === 'Loading…';
  };

  // Copy handler
  copyBtn.addEventListener('click', async () => {
    if (keyNotReady()) return;
    await navigator.clipboard.writeText(keyDisplay.textContent);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy key';
    }, 1800);
  });

  // Copy link handler — same key, wrapped in the app's join-by-key URL shape.
  copyLinkBtn.addEventListener('click', async () => {
    if (keyNotReady()) return;
    const link = location.origin + '/?groupJoinKey=' + keyDisplay.textContent;
    await navigator.clipboard.writeText(link);
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyLinkBtn.textContent = '🔗 Copy link';
    }, 1800);
  });

  // Regenerate handler
  regenBtn.addEventListener('click', async () => {
    if (!confirm('Regenerate the invite key? The old key AND any links built from it will stop working immediately.')) return;
    regenBtn.disabled = true;
    regenBtn.textContent = 'Regenerating…';
    const newKey = await createGroupInviteKey(groupId);
    keyDisplay.textContent = newKey || 'Error: Could not regenerate key.';
    regenBtn.disabled = false;
    regenBtn.textContent = '🔑 Regenerate';
  });
}

/**
 * @brief Fetches and displays the invite key section in the edit modal.
 *
 * Orchestrates: removing existing section, rendering HTML, appending to DOM,
 * fetching the current key, and wiring event handlers.
 *
 * @param {number} groupId - The ID of the group.
 * @param {string} idPrefix - Prefix for DOM IDs (defaults to 'eg').
 * @return {Promise<void>}
 */
async function showGroupInviteKeySection(groupId, idPrefix = 'eg') {
  // 1. Remove existing section
  const existing = document.getElementById(idPrefix + '-invite-key-section');
  if (existing) existing.remove();

  // 2. Create and append section
  const section = document.createElement('div');
  section.id = idPrefix + '-invite-key-section';
  section.style.cssText = 'margin-top:12px';
  section.innerHTML = renderGroupInviteKeyHTML(idPrefix);

  // Insert after the social list container
  document.getElementById(idPrefix + '-social-list').parentElement.appendChild(section);

  // 3. Fetch and display the current key
  const keyDisplay = section.querySelector('#' + idPrefix + '-current-key');
  const key = await getGroupInviteKey(groupId);
  keyDisplay.textContent = key || 'Could not load key.';

  // 4. Wire events
  wireGroupInviteKeyEvents(section, idPrefix, groupId);
}

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
  showGroupInviteKeySection(_editGroupId);
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
