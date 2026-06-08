/**
 * @file suggest-edit.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Suggest edit modal for waza data. Allows users to propose changes to existing waza entries, which are submitted to the contributions API for admin review.
 */

import { api } from '../services/api.js';

/**
 * @brief List of editable field names for waza suggestions.
 *
 * @type {string[]}
 */
const SE_FIELDS = [
  'name_jp',
  'name_en',
  'name_en_literal',
  'name_en_gtranslate',
  'tag',
  'reference',
  'parent_jp0',
  'parent_en0',
  'parent_jp1',
  'parent_en1',
  'author_jp0',
  'author_en0',
  'author_jp1',
  'author_en1',
  'video0',
  'video1',
  'video2',
  'video3',
  'video4',
  'video5',
  'video6',
  'video7',
  'video8',
  'video9',
];

/**
 * @brief Opens the suggest edit modal pre-filled with current waza values as placeholders.
 *
 * @param {Object} w - Waza object to suggest edits for.
 * @return {void}
 */
export function openSuggestEdit(w) {
  // Pre-fill with current values as placeholders
  SE_FIELDS.forEach((f) => {
    const el = document.getElementById('se-' + f);
    if (el) {
      el.value = '';
      el.placeholder = w[f] || '';
    }
  });
  document.getElementById('suggestWazaName').textContent =
    w.name_jp || w.name_en || 'Waza #' + w.id;
  document.getElementById('se-err').textContent = '';
  document.getElementById('suggestBg').style.display = 'flex';
  document.getElementById('suggestBg').dataset.wazaId = w.id;
}

/**
 * @brief Initializes event listeners for the suggest edit modal.
 *
 * Sets up close buttons, background click dismissal, and form submission handler.
 *
 * @return {void}
 */
export function initSuggestEdit() {
  document.getElementById('suggestClose').addEventListener('click', () => {
    document.getElementById('suggestBg').style.display = 'none';
  });
  document.getElementById('suggestCancel').addEventListener('click', () => {
    document.getElementById('suggestBg').style.display = 'none';
  });
  document.getElementById('suggestBg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('suggestBg'))
      document.getElementById('suggestBg').style.display = 'none';
  });

  document.getElementById('se-submit').addEventListener('click', async () => {
    const wazaId = +document.getElementById('suggestBg').dataset.wazaId;
    const payload = {};
    SE_FIELDS.forEach((f) => {
      const v = document.getElementById('se-' + f)?.value.trim();
      if (v) payload[f] = v;
    });
    const errEl = document.getElementById('se-err');
    if (!Object.keys(payload).length) {
      errEl.textContent = 'Please fill in at least one field.';
      return;
    }
    const btn = document.getElementById('se-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    errEl.textContent = '';
    try {
      const res = await api('/api/contributions', 'POST', {
        type: 'edit',
        waza_id: wazaId,
        payload,
      });
      if (res.error) {
        errEl.textContent = res.error;
        btn.disabled = false;
        btn.textContent = 'Submit suggestion';
        return;
      }
      document.getElementById('suggestBg').style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Submit suggestion';
      // Flash feedback in detail panel
      const fb = document.createElement('div');
      fb.style.cssText =
        'position:fixed;bottom:20px;right:20px;background:#002a10;color:#4caf82;border:1px solid #4caf82;border-radius:8px;padding:10px 16px;font-size:13px;z-index:300';
      fb.textContent = 'Suggestion submitted — thank you!';
      document.body.appendChild(fb);
      setTimeout(() => fb.remove(), 3000);
    } catch (e) {
      console.error('Suggestion submit failed:', e);
      errEl.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Submit suggestion';
    }
  });
}
