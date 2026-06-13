/**
 * @file create-group.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-14
 * @brief Create and Edit Group modals. Handles social link management, form
 *        validation, and API submission for creating or updating Groups.
 */

import { api } from '../services/api.js';
import { escapeHtml } from '../lib/escape.js';

// Callbacks set when modals are opened
let _onCreate = null;
let _onEdit = null;
let _editGroupId = null;

// ── Social link builder (shared between create + edit) ────────

/**
 * @brief Renders the social link list into a container element.
 *
 * @param {HTMLElement} container
 * @param {Array<{platform:string,url:string}>} links
 * @return {void}
 */
function renderSocialList(container, links) {
  container.innerHTML = links
    .map(
      (s, i) =>
        '<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center" data-si="' +
        i +
        '">' +
        '<input class="cfield input sg-platform" type="text" placeholder="Platform (e.g. Instagram)" value="' +
        escapeHtml(s.platform) +
        '" style="flex:1;padding:7px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text1);font-size:13px">' +
        '<input class="cfield input sg-url" type="url" placeholder="https://…" value="' +
        escapeHtml(s.url) +
        '" style="flex:2;padding:7px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text1);font-size:13px">' +
        '<button class="btn sg-remove" data-si="' +
        i +
        '" style="padding:4px 8px;color:var(--red);border-color:var(--red);flex-shrink:0">✕</button>' +
        '</div>',
    )
    .join('');

  container.querySelectorAll('.sg-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      links.splice(+btn.dataset.si, 1);
      renderSocialList(container, links);
    });
  });
}

/**
 * @brief Reads the current social link inputs from a container.
 *
 * @param {HTMLElement} container
 * @return {Array<{platform:string,url:string}>}
 */
function readSocialList(container) {
  const rows = container.querySelectorAll('[data-si]');
  const result = [];
  rows.forEach((row) => {
    const platform = row.querySelector('.sg-platform').value.trim();
    const url = row.querySelector('.sg-url').value.trim();
    if (platform && url) result.push({ platform, url });
  });
  return result;
}

// ── Create Group ──────────────────────────────────────────────

/**
 * @brief Opens the Create Group modal.
 *
 * @param {Function} onSuccess - Callback after successful creation.
 * @return {void}
 */
export function openCreateGroup(onSuccess) {
  _onCreate = onSuccess;
  const socialLinks = [];

  document.getElementById('cg-name').value = '';
  document.getElementById('cg-policy').value = 'open';
  document.getElementById('cg-err').textContent = '';
  renderSocialList(document.getElementById('cg-social-list'), socialLinks);
  document.getElementById('createGroupBg').style.display = 'flex';

  // Re-wire Add link button (idempotent via replaceWith clone)
  const addBtn = document.getElementById('cg-add-social');
  const fresh = addBtn.cloneNode(true);
  addBtn.replaceWith(fresh);
  fresh.addEventListener('click', () => {
    if (socialLinks.length >= 10) return;
    socialLinks.push({ platform: '', url: '' });
    renderSocialList(document.getElementById('cg-social-list'), socialLinks);
  });
}

/**
 * @brief Initialises all Create Group modal event listeners. Call once at boot.
 *
 * @return {void}
 */
export function initCreateGroup() {
  const closeFn = () => {
    document.getElementById('createGroupBg').style.display = 'none';
  };
  document.getElementById('createGroupClose').addEventListener('click', closeFn);
  document.getElementById('createGroupCancel').addEventListener('click', closeFn);
  document.getElementById('createGroupBg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('createGroupBg')) closeFn();
  });

  document.getElementById('cg-submit').addEventListener('click', async () => {
    const name = document.getElementById('cg-name').value.trim();
    const join_policy = document.getElementById('cg-policy').value;
    const social = readSocialList(document.getElementById('cg-social-list'));
    const errEl = document.getElementById('cg-err');

    errEl.textContent = '';
    if (!name) {
      errEl.textContent = 'Group name is required.';
      return;
    }

    const btn = document.getElementById('cg-submit');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
      const res = await api('/api/groups', 'POST', { name, join_policy, social });
      if (res.error) {
        errEl.textContent = res.error;
        btn.disabled = false;
        btn.textContent = 'Create Group';
        return;
      }

      // If invite-only, show the key before closing
      if (res.invite_key) {
        alert(
          'Your Group has been created!\n\nInvite key (share this with members):\n' +
            res.invite_key,
        );
      }

      document.getElementById('createGroupBg').style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Create Group';
      if (_onCreate) await _onCreate();
    } catch (e) {
      console.error('Create group failed:', e);
      errEl.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Create Group';
    }
  });
}

// ── Edit Group ────────────────────────────────────────────────

/**
 * @brief Opens the Edit Group modal pre-filled with current group data.
 *
 * @param {Object} group - Current group data.
 * @param {Function} onSuccess - Callback after successful update.
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

  // Show current invite key if policy is invite
  if (group.join_policy === 'invite') {
    _showInviteKeySection(_editGroupId);
  }
}

/**
 * @brief Fetches and displays the invite key for admins in the edit modal.
 *
 * @param {number} groupId
 * @return {Promise<void>}
 */
async function _showInviteKeySection(groupId) {
  // The key is returned on creation; to surface it again we need a dedicated
  // GET — for now we don't expose GET for the key (security), so the admin
  // regenerates via a button. We show the regenerate button in the edit modal.
  const existing = document.getElementById('eg-invite-key-section');
  if (existing) existing.remove();

  const section = document.createElement('div');
  section.id = 'eg-invite-key-section';
  section.style.cssText = 'margin-top:12px';
  section.innerHTML =
    '<div class="cfield">' +
    '<label>Invite key</label>' +
    '<div style="font-size:13px;color:var(--text3);margin-bottom:6px">The invite key is only shown once on creation. Regenerate it below — this invalidates the old key.</div>' +
    '<button class="btn" id="eg-regen-key">🔑 Regenerate invite key</button>' +
    '<div id="eg-new-key" style="margin-top:8px;font-family:monospace;font-size:12px;word-break:break-all;color:var(--text2)"></div>' +
    '</div>';

  document.getElementById('eg-social-list').parentElement.appendChild(section);

  document.getElementById('eg-regen-key')?.addEventListener('click', async () => {
    if (!confirm('Regenerate the invite key? The old key will stop working immediately.')) return;
    const res = await api('/api/groups/' + groupId + '/invite-key', 'POST');
    if (res.error) {
      document.getElementById('eg-new-key').textContent = 'Error: ' + res.error;
      return;
    }
    document.getElementById('eg-new-key').textContent = 'New key: ' + res.invite_key;
  });
}

/**
 * @brief Initialises all Edit Group modal event listeners. Call once at boot.
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
