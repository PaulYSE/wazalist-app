/**
 * @file suggest-edit.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-10
 * @brief Suggest edit modal for waza data. Allows users to propose changes to existing waza entries, which are submitted to the contributions API for admin review.
 */

import { api } from '../services/api.js';
import { videoKey } from '../components/render-helpers.js';

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

// ── Field-targeted suggest edit (modify one field, or append a video) ──

// Human labels + input hints per editable field.
const FIELD_META = {
  name_jp: { label: 'Name (Japanese)', type: 'text' },
  name_en: { label: 'Name (English)', type: 'text' },
  name_en_literal: { label: 'Romaji', type: 'text' },
  name_en_gtranslate: { label: 'Google Translate (EN)', type: 'text' },
  name_cn_gtranslate: { label: 'Google Translate (CN)', type: 'text' },
  tag: { label: 'Classification', type: 'text' },
  reference: { label: 'Reference / lore', type: 'text' },
  parent_en0: { label: 'Parent Waza (EN)', type: 'text' },
  parent_jp0: { label: 'Parent Waza (JP)', type: 'text' },
  author_en0: { label: 'Author (EN)', type: 'text' },
  author_jp0: { label: 'Author (JP)', type: 'text' },
};

const VIDEO_FIELDS = [
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

// Module-scoped context for the currently open field-edit modal.
let feWaza = null;
let feField = null; // the concrete field to write (e.g. 'name_en' or 'video4')
let feMode = null; // 'modify' | 'addVideo'

/**
 * @brief Opens the focused modal to MODIFY one existing field of a waza.
 *
 * @param {Object} w - Waza object.
 * @param {string} field - The field to edit (e.g. 'name_en', 'video2').
 * @return {void}
 */
export function openFieldEdit(w, field) {
  feWaza = w;
  feField = field;
  feMode = 'modify';
  const meta = FIELD_META[field] || { label: field, type: 'text' };
  document.getElementById('fieldEditTitle').textContent = '✏️ Suggest a change';
  document.getElementById('fieldEditDesc').textContent =
    'Suggest a correction for this field. An admin reviews it before it goes live.';
  document.getElementById('fieldEditLabel').textContent = meta.label;
  const input = document.getElementById('fieldEditInput');
  input.type = meta.type;
  input.value = '';
  input.placeholder = w[field] || '';
  // Show current value.
  const curWrap = document.getElementById('fieldEditCurrentWrap');
  const cur = document.getElementById('fieldEditCurrent');
  curWrap.style.display = '';
  cur.textContent = w[field] || '(empty)';
  document.getElementById('fieldEditErr').textContent = '';
  document.getElementById('fieldEditBg').style.display = 'flex';
  input.focus();
}

/**
 * @brief Opens the focused modal to APPEND a new video to a waza. Computes the
 *        next empty video slot (never video0) client-side; dedups against
 *        existing videos ignoring timestamps and URL form.
 *
 * @param {Object} w - Waza object.
 * @return {void}
 */
export function openVideoSuggest(w) {
  feWaza = w;
  feMode = 'addVideo';
  feField = null; // resolved at submit time (next empty slot)
  document.getElementById('fieldEditTitle').textContent = '🎥 Suggest a video';
  document.getElementById('fieldEditDesc').textContent =
    'Paste a video link to add to this waza. An admin reviews it before it goes live.';
  document.getElementById('fieldEditLabel').textContent = 'Video link';
  const input = document.getElementById('fieldEditInput');
  input.type = 'url';
  input.value = '';
  input.placeholder = 'https://…';
  document.getElementById('fieldEditCurrentWrap').style.display = 'none';
  document.getElementById('fieldEditErr').textContent = '';
  document.getElementById('fieldEditBg').style.display = 'flex';
  input.focus();
}

// Find the first empty video slot, skipping video0 (never append there).
function nextVideoSlot(w) {
  for (let i = 1; i < VIDEO_FIELDS.length; i++) {
    const v = w[VIDEO_FIELDS[i]];
    if (!v || !v.trim() || v === '0') return VIDEO_FIELDS[i];
  }
  return null; // all slots full
}

/**
 * @brief Wires the field-targeted modal (close/cancel/submit). Call once at boot.
 *
 * @return {void}
 */
export function initFieldEdit() {
  const bg = document.getElementById('fieldEditBg');
  const close = () => {
    bg.style.display = 'none';
  };
  document.getElementById('fieldEditClose').addEventListener('click', close);
  document.getElementById('fieldEditCancel').addEventListener('click', close);
  bg.addEventListener('click', (e) => {
    if (e.target === bg) close();
  });
  const input = document.getElementById('fieldEditInput');
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') document.getElementById('fieldEditSubmit').click();
  });

  document.getElementById('fieldEditSubmit').addEventListener('click', async () => {
    const errEl = document.getElementById('fieldEditErr');
    const val = input.value.trim();
    errEl.textContent = '';
    if (!val) {
      errEl.textContent = 'Please enter a value.';
      return;
    }

    let field = feField;
    if (feMode === 'addVideo') {
      // Dedup against existing videos, ignoring timestamps / URL form.
      const existing = VIDEO_FIELDS.map((f) => feWaza[f]).filter((v) => v && v.trim() && v !== '0');
      if (existing.some((v) => videoKey(v) === videoKey(val))) {
        errEl.textContent = 'This link already exists!';
        return;
      }
      field = nextVideoSlot(feWaza);
      if (!field) {
        errEl.textContent = 'This waza already has the maximum number of videos.';
        return;
      }
    }

    const btn = document.getElementById('fieldEditSubmit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    try {
      const res = await api('/api/contributions', 'POST', {
        type: 'edit',
        waza_id: feWaza.id,
        payload: { [field]: val },
      });
      if (res.error) {
        errEl.textContent = res.error;
        btn.disabled = false;
        btn.textContent = 'Submit suggestion';
        return;
      }
      bg.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Submit suggestion';
      const fb = document.createElement('div');
      fb.style.cssText =
        'position:fixed;bottom:20px;right:20px;background:#002a10;color:#4caf82;border:1px solid #4caf82;border-radius:8px;padding:10px 16px;font-size:13px;z-index:300';
      fb.textContent = 'Suggestion submitted — thank you!';
      document.body.appendChild(fb);
      setTimeout(() => fb.remove(), 3000);
    } catch (e) {
      console.error('Field-edit submit failed:', e);
      errEl.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Submit suggestion';
    }
  });
}
