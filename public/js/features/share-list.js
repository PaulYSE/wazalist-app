/**
 * @file share-list.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-11
 * @brief Share and import waza marking lists via URL keys. Handles serialization, upload to server, and import with merge preview.
 */

import { state } from '../state/state.js';
import { LS_IMPORTED } from '../state/localStorage.js';
import { showToast } from '../components/show-toast.js';
import { renderDashCompare } from '../views/compare.js';

// Check URL for ?import= key on load

/**
 * @brief Checks URL for ?import= parameter on page load and triggers import modal.
 *
 * @return {void}
 */
export function checkAutoImport() {
  const importKey = new URL(location.href).searchParams.get('import');
  if (!importKey) return;
  history.replaceState({}, '', location.pathname);
  setTimeout(() => openImportModal(importKey), 400);
}

const loadImported = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_IMPORTED) || '{}');
  } catch {
    return {};
  }
};

/**
 * @brief Saves imported lists to localStorage.
 *
 * @param {Object} d - Imported lists data.
 * @return {void}
 */
export const saveImported = (d) => localStorage.setItem(LS_IMPORTED, JSON.stringify(d));

/**
 * @brief Cache of imported lists keyed by share key.
 *
 * @type {Object.<string, Object>}
 */
export let importedLists = loadImported(); // { [key]: { key, name, importedAt, labels, marks } }

// Pending import data — held between fetch modal and name modal
let _pendingImport = null;

// ── List serialization ────────────────────────────────────────

/**
 * @brief Serializes current user's marks and labels into a JSON string.
 *
 * @return {string} Serialized list data.
 */
function serializeList() {
  const marks = {};
  Object.entries(state.prog).forEach(([id, p]) => {
    const hasMarking = p.markings && p.markings.some(Boolean);
    if (hasMarking || p.like)
      marks[+id] = { markings: p.markings || Array(6).fill(false), like: p.like || null };
  });
  return JSON.stringify({ v: 1, labels: state.markingLabels, marks });
}

/**
 * @brief Generates SHA-256 hash of serialized list for use as share key.
 *
 * @param {string} serialized - Serialized list JSON string.
 * @return {Promise<string>} Hex hash string.
 */
async function hashList(serialized) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Export flow ───────────────────────────────────────────────

/**
 * @brief Opens the export modal and uploads user's list to server.
 *
 * @return {Promise<void>}
 */
export async function openExportModal() {
  const marks = Object.entries(state.prog).filter(
    ([, p]) => (p.markings && p.markings.some(Boolean)) || p.like,
  );
  if (!marks.length) {
    showToast('Your list is empty — mark some Waza first.', 'amber');
    return;
  }

  document.getElementById('exportStatus').style.display = '';
  document.getElementById('exportStatus').textContent = 'Generating key…';
  document.getElementById('exportKeyWrap').style.display = 'none';
  document.getElementById('exportErr').textContent = '';
  document.getElementById('exportBg').style.display = 'flex';

  try {
    const data = serializeList();
    const key = await hashList(data);
    document.getElementById('exportStatus').textContent = 'Uploading…';
    const res = await fetch('/api/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data }),
    });
    const json = await res.json();
    if (json.error) {
      document.getElementById('exportErr').textContent = json.error;
      document.getElementById('exportStatus').style.display = 'none';
      return;
    }
    document.getElementById('exportStatus').style.display = 'none';
    document.getElementById('exportKey').textContent = key;
    document.getElementById('exportUrl').textContent = location.origin + '/?import=' + key;
    document.getElementById('exportKeyWrap').style.display = '';
  } catch (e) {
    console.error('List export upload failed:', e);
    document.getElementById('exportErr').textContent = 'Upload failed. Please try again.';
    document.getElementById('exportStatus').style.display = 'none';
  }
}

// ── Import flow ───────────────────────────────────────────────

/**
 * @brief Opens the import modal, optionally prefilled with a share key.
 *
 * @param {string} prefillKey - Optional share key to prefill.
 * @return {void}
 */
export function openImportModal(prefillKey = '') {
  document.getElementById('importKeyInput').value = prefillKey;
  document.getElementById('importErr').textContent = '';
  document.getElementById('importBg').style.display = 'flex';
  if (prefillKey) document.getElementById('importFetchBtn').click();
}

/**
 * @brief Initializes all share/import modal event listeners.
 *
 * @return {void}
 */
export function initShare() {
  document.getElementById('exportClose').addEventListener('click', () => {
    document.getElementById('exportBg').style.display = 'none';
  });
  document.getElementById('exportCancel').addEventListener('click', () => {
    document.getElementById('exportBg').style.display = 'none';
  });
  document.getElementById('exportBg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('exportBg'))
      document.getElementById('exportBg').style.display = 'none';
  });

  document.getElementById('copyKeyBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.getElementById('exportKey').textContent);
    document.getElementById('copyKeyBtn').textContent = 'Copied!';
    setTimeout(() => (document.getElementById('copyKeyBtn').textContent = 'Copy key'), 1800);
  });
  document.getElementById('copyLinkBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.getElementById('exportUrl').textContent);
    document.getElementById('copyLinkBtn').textContent = 'Copied!';
    setTimeout(() => (document.getElementById('copyLinkBtn').textContent = 'Copy link'), 1800);
  });

  document.getElementById('importClose').addEventListener('click', () => {
    document.getElementById('importBg').style.display = 'none';
  });
  document.getElementById('importCancel').addEventListener('click', () => {
    document.getElementById('importBg').style.display = 'none';
  });
  document.getElementById('importBg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('importBg'))
      document.getElementById('importBg').style.display = 'none';
  });

  document.getElementById('importFetchBtn').addEventListener('click', async () => {
    const key = document.getElementById('importKeyInput').value.trim().toLowerCase();
    const errEl = document.getElementById('importErr');
    errEl.textContent = '';
    if (!/^[0-9a-f]{64}$/.test(key)) {
      errEl.textContent = "That key doesn't look right — check you copied all of it.";
      return;
    }
    const btn = document.getElementById('importFetchBtn');
    btn.disabled = true;
    btn.textContent = 'Fetching…';
    try {
      const res = await fetch('/api/list?key=' + key);
      const json = await res.json();
      btn.disabled = false;
      btn.textContent = 'Import';
      if (json.error) {
        errEl.textContent =
          res.status === 404
            ? 'List not found — the key may have expired (keys last 90 days).'
            : json.error;
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(json.data);
      } catch {
        errEl.textContent = "That list couldn't be read. (Invalid list data)";
        return;
      }
      if (!parsed.v || !parsed.marks) {
        errEl.textContent = "That list couldn't be read. (Unrecognised list format)";
        return;
      }
      _pendingImport = { key, ...parsed };
      document.getElementById('importBg').style.display = 'none';
      // Open name modal
      const now = new Date();
      const defaultName =
        'Imported List ' + now.toLocaleString('en', { month: 'long', year: 'numeric' });
      document.getElementById('importNameInput').value = importedLists[key]?.name || defaultName;
      const dupWarn = document.getElementById('importDupWarning');
      const dupSpan = document.getElementById('importDupName');
      if (importedLists[key]) {
        dupWarn.style.display = '';
        dupSpan.textContent = importedLists[key].name;
      } else {
        dupWarn.style.display = 'none';
      }
      document.getElementById('nameImportBg').style.display = 'flex';
    } catch (e) {
      console.error('List import fetch failed:', e);
      btn.disabled = false;
      btn.textContent = 'Import';
      errEl.textContent = 'Network error. Please try again.';
    }
  });

  document.getElementById('nameImportClose').addEventListener('click', () => {
    document.getElementById('nameImportBg').style.display = 'none';
  });
  document.getElementById('importNameCancel').addEventListener('click', () => {
    document.getElementById('nameImportBg').style.display = 'none';
  });
  document.getElementById('importSaveBtn').addEventListener('click', () => {
    const name = document.getElementById('importNameInput').value.trim();
    if (!name || !_pendingImport) return;
    const { key, labels, marks } = _pendingImport;
    importedLists[key] = {
      key,
      name,
      importedAt: new Date().toISOString(),
      labels: labels || Array(6).fill(''),
      marks: marks || {},
    };
    saveImported(importedLists);
    _pendingImport = null;
    document.getElementById('nameImportBg').style.display = 'none';
    showToast('List imported: ' + name, 'green');
    // Switch to Compare top-level tab
    document.querySelectorAll('.ntab').forEach((t) => t.classList.remove('active'));
    document.querySelector('[data-tab="compare"]').classList.add('active');
    document.getElementById('browseView').style.display = 'none';
    document.getElementById('statsView').style.display = 'none';
    document.getElementById('accountView').style.display = 'none';
    document.getElementById('contributeView').style.display = 'none';
    document.getElementById('compareView').style.display = 'block';
    renderDashCompare();
  });
}
