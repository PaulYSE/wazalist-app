/**
 * @file group-new.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Create Group modal. Handles social link management, form validation, and API submission for creating new groups.
 */

import { api } from '../services/api.js';
import { renderSocialList, readSocialList } from "../components/render-group-helpers.js"

// Callbacks set when modals are opened
let _onCreate = null;

// ── Create Group ──────────────────────────────────────────────

/**
 * @brief Opens the Create Group modal.
 *
 * Resets form fields, clears social links, and displays the modal.
 * The social link list is rendered with an empty array.
 *
 * @param {Function} onSuccess - Callback invoked after successful group creation.
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
 * Sets up close handlers for the modal backdrop, close button, and cancel button.
 * Also wires the submit handler for group creation.
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