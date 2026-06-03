/* share.js — list serialization + SHA-256 hashing, the share/import modals,
   and the Compare tab (renderDashCompare). */
import { state } from './state.js';
import { SHAPES } from './config.js';
import { saveLabels } from './core.js';
import { showToast } from './import-ui.js';
import { escapeHtml } from './ui.js';

const LS_IMPORTED = 'wl_imported_lists';
const loadImported = () => { try { return JSON.parse(localStorage.getItem(LS_IMPORTED) || '{}') } catch { return {} } };
const saveImported = d => localStorage.setItem(LS_IMPORTED, JSON.stringify(d));
let importedLists = loadImported(); // { [key]: { key, name, importedAt, labels, marks } }

// Pending import data — held between fetch modal and name modal
let _pendingImport = null;

// ── List serialization ────────────────────────────────────────
function serializeList() {
  const marks = {};
  Object.entries(state.prog).forEach(([id, p]) => {
    const hasMarking = p.markings && p.markings.some(Boolean);
    if (hasMarking || p.like) marks[+id] = { markings: p.markings || Array(6).fill(false), like: p.like || null };
  });
  return JSON.stringify({ v: 1, labels: state.markingLabels, marks });
}

async function hashList(serialized) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Export flow ───────────────────────────────────────────────
async function openExportModal() {
  const marks = Object.entries(state.prog).filter(([, p]) => (p.markings && p.markings.some(Boolean)) || p.like);
  if (!marks.length) { showToast('Your list is empty — mark some Waza first.', 'amber'); return; }

  document.getElementById('exportStatus').style.display = '';
  document.getElementById('exportStatus').textContent = 'Generating key…';
  document.getElementById('exportKeyWrap').style.display = 'none';
  document.getElementById('exportErr').textContent = '';
  document.getElementById('exportBg').style.display = 'flex';

  try {
    const data = serializeList();
    const key = await hashList(data);
    document.getElementById('exportStatus').textContent = 'Uploading…';
    const res = await fetch('/api/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, data }) });
    const json = await res.json();
    if (json.error) { document.getElementById('exportErr').textContent = json.error; document.getElementById('exportStatus').style.display = 'none'; return; }
    document.getElementById('exportStatus').style.display = 'none';
    document.getElementById('exportKey').textContent = key;
    document.getElementById('exportUrl').textContent = location.origin + '/?import=' + key;
    document.getElementById('exportKeyWrap').style.display = '';
  } catch (e) {
    document.getElementById('exportErr').textContent = 'Upload failed. Please try again.';
    document.getElementById('exportStatus').style.display = 'none';
  }
}

document.getElementById('exportClose').addEventListener('click', () => { document.getElementById('exportBg').style.display = 'none'; });
document.getElementById('exportCancel').addEventListener('click', () => { document.getElementById('exportBg').style.display = 'none'; });
document.getElementById('exportBg').addEventListener('click', e => { if (e.target === document.getElementById('exportBg')) document.getElementById('exportBg').style.display = 'none'; });

document.getElementById('copyKeyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('exportKey').textContent);
  document.getElementById('copyKeyBtn').textContent = 'Copied!';
  setTimeout(() => document.getElementById('copyKeyBtn').textContent = 'Copy key', 1800);
});
document.getElementById('copyLinkBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('exportUrl').textContent);
  document.getElementById('copyLinkBtn').textContent = 'Copied!';
  setTimeout(() => document.getElementById('copyLinkBtn').textContent = 'Copy link', 1800);
});

// ── Import flow ───────────────────────────────────────────────
function openImportModal(prefillKey = '') {
  document.getElementById('importKeyInput').value = prefillKey;
  document.getElementById('importErr').textContent = '';
  document.getElementById('importBg').style.display = 'flex';
  if (prefillKey) document.getElementById('importFetchBtn').click();
}

document.getElementById('importClose').addEventListener('click', () => { document.getElementById('importBg').style.display = 'none'; });
document.getElementById('importCancel').addEventListener('click', () => { document.getElementById('importBg').style.display = 'none'; });
document.getElementById('importBg').addEventListener('click', e => { if (e.target === document.getElementById('importBg')) document.getElementById('importBg').style.display = 'none'; });

document.getElementById('importFetchBtn').addEventListener('click', async () => {
  const key = document.getElementById('importKeyInput').value.trim().toLowerCase();
  const errEl = document.getElementById('importErr');
  errEl.textContent = '';
  if (!/^[0-9a-f]{64}$/.test(key)) { errEl.textContent = 'Key must be 64 hex characters.'; return; }
  const btn = document.getElementById('importFetchBtn');
  btn.disabled = true; btn.textContent = 'Fetching…';
  try {
    const res = await fetch('/api/list?key=' + key);
    const json = await res.json();
    btn.disabled = false; btn.textContent = 'Import';
    if (json.error) { errEl.textContent = res.status === 404 ? 'List not found — the key may have expired (keys last 90 days).' : json.error; return; }
    let parsed;
    try { parsed = JSON.parse(json.data); } catch { errEl.textContent = 'Invalid list data.'; return; }
    if (!parsed.v || !parsed.marks) { errEl.textContent = 'Unrecognised list format.'; return; }
    _pendingImport = { key, ...parsed };
    document.getElementById('importBg').style.display = 'none';
    // Open name modal
    const now = new Date();
    const defaultName = 'Imported List ' + now.toLocaleString('en', { month: 'long', year: 'numeric' });
    document.getElementById('importNameInput').value = importedLists[key]?.name || defaultName;
    const dupWarn = document.getElementById('importDupWarning');
    const dupSpan = document.getElementById('importDupName');
    if (importedLists[key]) { dupWarn.style.display = ''; dupSpan.textContent = importedLists[key].name; }
    else { dupWarn.style.display = 'none'; }
    document.getElementById('nameImportBg').style.display = 'flex';
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Import';
    errEl.textContent = 'Network error. Please try again.';
  }
});

document.getElementById('nameImportClose').addEventListener('click', () => { document.getElementById('nameImportBg').style.display = 'none'; });
document.getElementById('importNameCancel').addEventListener('click', () => { document.getElementById('nameImportBg').style.display = 'none'; });
document.getElementById('importSaveBtn').addEventListener('click', () => {
  const name = document.getElementById('importNameInput').value.trim();
  if (!name || !_pendingImport) return;
  const { key, labels, marks } = _pendingImport;
  importedLists[key] = { key, name, importedAt: new Date().toISOString(), labels: labels || Array(6).fill(''), marks: marks || {} };
  saveImported(importedLists);
  _pendingImport = null;
  document.getElementById('nameImportBg').style.display = 'none';
  showToast('List imported: ' + name, 'green');
  // Switch to Compare top-level tab
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="compare"]').classList.add('active');
  document.getElementById('browseView').style.display = 'none';
  document.getElementById('statsView').style.display = 'none';
  document.getElementById('accountView').style.display = 'none';
  document.getElementById('contributeView').style.display = 'none';
  document.getElementById('compareView').style.display = 'block';
  renderDashCompare();
});

// Check URL for ?import= key on load
export function checkAutoImport() {
  const importKey = new URL(location.href).searchParams.get('import');
  if (!importKey) return;
  history.replaceState({}, '', location.pathname);
  setTimeout(() => openImportModal(importKey), 400);
}

// ── Compare tab ───────────────────────────────────────────────
let compareSelectedKey = null;

export function renderDashCompare() {
  const container = document.getElementById('dashCompare');
  const keys = Object.keys(importedLists);

  if (compareSelectedKey && !importedLists[compareSelectedKey]) compareSelectedKey = null;
  if (!compareSelectedKey && keys.length) compareSelectedKey = keys[0];

  const headerOpts = keys.map(k => '<option value="' + escapeHtml(k) + '"' + (k === compareSelectedKey ? ' selected' : '') + '>' + escapeHtml(importedLists[k].name) + '</option>').join('');
  const selectHtml = '<select class="cmp-select" id="cmpSelect">'
    + '<option value="">— select a list —</option>'
    + headerOpts + '</select>';

  const headerHtml = '<div class="cmp-header">'
    + selectHtml
    + (compareSelectedKey ? '<button class="btn" id="cmpRemoveBtn" style="color:var(--red);border-color:var(--red)">Remove</button>' : '')
    + '<button class="btn" id="cmpImportBtn" style="margin-left:auto">↓ Import List</button>'
    + '</div>';

  // Shared save button HTML
  const saveBtnHtml = '<div style="margin-top:10px;display:flex;gap:8px">'
    + '<button class="btn" id="cmpExportBtn">↑ Export My List</button>'
    + '<button class="btn" id="cmpSaveLabelsBtn" style="margin-left:auto">Save Labels</button>'
    + '</div>';

  if (!keys.length) {
    const markingCounts = Array(6).fill(0);
    state.wazaData.forEach(w => { const p = getP(w.id); if (p.markings) p.markings.forEach((on, i) => { if (on) markingCounts[i]++; }); });
    const simpleLabelsHTML = '<div class="dsec2"><h3>My labels</h3>'
      + SHAPES.map((s, i) => '<div class="labels-row">'
        + '<span class="labels-marking">' + s + '</span>'
        + '<input class="labels-input" data-si="' + i + '" type="text" maxlength="32" placeholder="Label this marking…" value="' + state.markingLabels[i].replace(/"/g, '&quot;') + '">'
        + '<span class="labels-count">' + markingCounts[i] + ' waza</span>'
        + '</div>').join('')
      + saveBtnHtml
      + '</div>';

    container.innerHTML = simpleLabelsHTML + headerHtml + '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">No imported lists yet.<br>Use <b>↓ Import List</b> to add one.</div>';

    container.querySelector('#cmpExportBtn').addEventListener('click', openExportModal);
    container.querySelector('#cmpImportBtn').addEventListener('click', () => openImportModal());
    container.querySelector('#cmpSaveLabelsBtn').addEventListener('click', () => {
      container.querySelectorAll('.labels-input').forEach(inp => { state.markingLabels[+inp.dataset.si] = inp.value; });
      saveLabels();
      showToast('Labels saved', 'green');
    });
    return;
  }

  const imp = compareSelectedKey ? importedLists[compareSelectedKey] : null;

  let combinedLabelsHTML = '';
  if (imp) {
    const impMarkingCounts = Array(6).fill(0);
    const myMarkingCounts = Array(6).fill(0);
    if (imp.marks) {
      Object.values(imp.marks).forEach(mark => {
        if (mark.markings) mark.markings.forEach((on, i) => { if (on) impMarkingCounts[i]++; });
      });
    }
    const importedIds = new Set(Object.keys(imp.marks).map(Number));
    state.wazaData.forEach(w => {
      if (importedIds.has(w.id)) {
        const p = getP(w.id);
        if (p.markings) p.markings.forEach((on, i) => { if (on) myMarkingCounts[i]++; });
      }
    });

    combinedLabelsHTML = '<div class="dsec2"><h3>Labels comparison</h3>'
      + SHAPES.map((s, i) => {
        const impLabel = imp.labels && imp.labels[i] ? imp.labels[i] : '';
        const myLabel = state.markingLabels[i] || '';
        return '<div class="labels-row">'
          + '<span class="labels-marking">' + s + '</span>'
          + '<div class="labels-combined">'
          + '<div class="labels-stacked">'
          + '<div class="labels-imported" title="Their label">'
          + (impLabel ? escapeHtml(impLabel) : '<span style="color:var(--text3);font-style:italic">Unlabeled</span>')
          + '</div>'
          + '<div class="labels-divider"></div>'
          + '<input class="labels-input-bottom" data-si="' + i + '" type="text" maxlength="32" placeholder="Your label…" value="' + myLabel.replace(/"/g, '&quot;') + '" title="Your label">'
          + '</div>'
          + '</div>'
          + '<div class="labels-count-stacked">'
          + '<div class="labels-count-top" title="Their marks">' + impMarkingCounts[i] + '</div>'
          + '<div class="labels-count-divider"></div>'
          + '<div class="labels-count-bottom" title="Your marks">' + myMarkingCounts[i] + '</div>'
          + '</div>'
          + '</div>';
      }).join('')
      + saveBtnHtml
      + '</div>';
  } else {
    const myMarkingCounts = Array(6).fill(0);
    state.wazaData.forEach(w => { const p = getP(w.id); if (p.markings) p.markings.forEach((on, i) => { if (on) myMarkingCounts[i]++; }); });
    combinedLabelsHTML = '<div class="dsec2"><h3>My labels</h3>'
      + SHAPES.map((s, i) => '<div class="labels-row">'
        + '<span class="labels-marking">' + s + '</span>'
        + '<input class="labels-input" data-si="' + i + '" type="text" maxlength="32" placeholder="Label this marking…" value="' + state.markingLabels[i].replace(/"/g, '&quot;') + '">'
        + '<span class="labels-count">' + myMarkingCounts[i] + ' waza</span>'
        + '</div>').join('')
      + saveBtnHtml
      + '</div>';
  }

  const importedIds = imp ? new Set(Object.keys(imp.marks).map(Number)) : new Set();
  const rows = state.wazaData.filter(w => importedIds.has(w.id));
  const colHeaders = '<div class="cmp-col-headers"><span>Waza</span><span>Their marks</span><span>Your marks</span></div>';
  const rowsHtml = rows.map(w => {
    const importedMark = imp ? (imp.marks[w.id] || { markings: Array(6).fill(false), like: null }) : { markings: Array(6).fill(false), like: null };
    const myP = getP(w.id);
    const myMarkings = myP.markings || Array(6).fill(false);
    const impMarkings = importedMark.markings || Array(6).fill(false);
    return '<div class="cmp-row" data-id="' + w.id + '">'
      + '<div><div class="cmp-name-jp">' + (w.name_jp || '—') + '</div><div class="cmp-name-en">' + dispName(w) + '</div></div>'
      + '<div class="cmp-markings-imported">' + markingPips(impMarkings) + '</div>'
      + '<div class="cmp-markings-mine">'
      + SHAPES.map((s, i) => '<button class="cmp-marking-btn' + (myMarkings[i] ? ' on' : '') + '" data-wid="' + w.id + '" data-si="' + i + '" title="' + (state.markingLabels[i] || 'Marking ' + (i + 1)) + '">' + s + '</button>').join('')
      + '</div>'
      + '</div>';
  }).join('');

  const emptyRows = !rows.length ? '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">This list has no marks.</div>' : '';

  container.innerHTML = combinedLabelsHTML + headerHtml + (rows.length ? colHeaders : '') + rowsHtml + emptyRows;

  container.querySelector('#cmpExportBtn')?.addEventListener('click', openExportModal);

  // Save button — single handler covers both .labels-input and .labels-input-bottom
  container.querySelector('#cmpSaveLabelsBtn')?.addEventListener('click', () => {
    container.querySelectorAll('.labels-input, .labels-input-bottom').forEach(inp => { state.markingLabels[+inp.dataset.si] = inp.value; });
    saveLabels();
    showToast('Labels saved', 'green');
  });

  container.querySelector('#cmpSelect').addEventListener('change', e => {
    compareSelectedKey = e.target.value || null;
    renderDashCompare();
  });
  container.querySelector('#cmpImportBtn').addEventListener('click', () => openImportModal());
  container.querySelector('#cmpRemoveBtn')?.addEventListener('click', () => {
    if (!compareSelectedKey) return;
    const name = importedLists[compareSelectedKey].name;
    if (!confirm('Remove "' + name + '" from your imported lists?')) return;
    delete importedLists[compareSelectedKey];
    saveImported(importedLists);
    compareSelectedKey = null;
    renderDashCompare();
  });

  container.querySelectorAll('.cmp-marking-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wid = +btn.dataset.wid, si = +btn.dataset.si;
      const cur = getP(wid);
      const ns = [...(cur.markings || Array(6).fill(false))];
      ns[si] = !ns[si];
      saveP(wid, { markings: ns }).then(() => renderDashCompare());
    });
  });

  container.querySelectorAll('.cmp-row').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('cmp-marking-btn')) return;
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });
}

// ── Compare sub-tab switching ─────────────────────────────────
// ── Text Import ───────────────────────────────────────────────
// State for the text-import sub-tab
