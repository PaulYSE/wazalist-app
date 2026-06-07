/* compare.js — list serialization + SHA-256 hashing, the share/import modals,
   and the Compare tab (renderDashCompare). */
import { state } from '../state/state.js';
import { SHAPES } from '../config/constants.js';
import { saveLabels, getP, saveP } from '../services/progress.js';
import { showToast } from '../components/show-toast.js';
import { escapeHtml } from '../lib/escape.js';
import { dispName } from '../lib/search.js';
import { markingPips } from '../components/render-helpers.js';
import { navigateToBrowse } from '../app/shell.js';
import { selectWaza } from './waza-detail.js';
import {
  openImportModal,
  importedLists,
  saveImported,
  openExportModal,
} from '../features/share-list.js';

// ── Compare tab ───────────────────────────────────────────────
let compareSelectedKey = null;

export function renderDashCompare() {
  const container = document.getElementById('dashCompare');
  const keys = Object.keys(importedLists);

  if (compareSelectedKey && !importedLists[compareSelectedKey]) compareSelectedKey = null;
  if (!compareSelectedKey && keys.length) compareSelectedKey = keys[0];

  const headerOpts = keys
    .map(
      (k) =>
        '<option value="' +
        escapeHtml(k) +
        '"' +
        (k === compareSelectedKey ? ' selected' : '') +
        '>' +
        escapeHtml(importedLists[k].name) +
        '</option>',
    )
    .join('');
  const selectHtml =
    '<select class="cmp-select" id="cmpSelect">' +
    '<option value="">— select a list —</option>' +
    headerOpts +
    '</select>';

  const headerHtml =
    '<div class="cmp-header">' +
    selectHtml +
    (compareSelectedKey
      ? '<button class="btn" id="cmpRemoveBtn" style="color:var(--red);border-color:var(--red)">Remove</button>'
      : '') +
    '<button class="btn" id="cmpImportBtn" style="margin-left:auto">↓ Import List</button>' +
    '</div>';

  // Shared save button HTML
  const saveBtnHtml =
    '<div style="margin-top:10px;display:flex;gap:8px">' +
    '<button class="btn" id="cmpExportBtn">↑ Export My List</button>' +
    '<button class="btn" id="cmpSaveLabelsBtn" style="margin-left:auto">Save Labels</button>' +
    '</div>';

  if (!keys.length) {
    const markingCounts = Array(6).fill(0);
    state.wazaData.forEach((w) => {
      const p = getP(w.id);
      if (p.markings)
        p.markings.forEach((on, i) => {
          if (on) markingCounts[i]++;
        });
    });
    const simpleLabelsHTML =
      '<div class="dsec2"><h3>My labels</h3>' +
      SHAPES.map(
        (s, i) =>
          '<div class="labels-row">' +
          '<span class="labels-marking">' +
          s +
          '</span>' +
          '<input class="labels-input" data-si="' +
          i +
          '" type="text" maxlength="32" placeholder="Label this marking…" value="' +
          state.markingLabels[i].replace(/"/g, '&quot;') +
          '">' +
          '<span class="labels-count">' +
          markingCounts[i] +
          ' waza</span>' +
          '</div>',
      ).join('') +
      saveBtnHtml +
      '</div>';

    container.innerHTML =
      simpleLabelsHTML +
      headerHtml +
      '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">No imported lists yet.<br>Use <b>↓ Import List</b> to add one.</div>';

    container.querySelector('#cmpExportBtn').addEventListener('click', openExportModal);
    container.querySelector('#cmpImportBtn').addEventListener('click', () => openImportModal());
    container.querySelector('#cmpSaveLabelsBtn').addEventListener('click', () => {
      container.querySelectorAll('.labels-input').forEach((inp) => {
        state.markingLabels[+inp.dataset.si] = inp.value;
      });
      saveLabels();
      showToast('Labels saved', 'green');
    });
    return;
  }

  const imp = compareSelectedKey ? importedLists[compareSelectedKey] : null;

  let combinedLabelsHTML;
  if (imp) {
    const impMarkingCounts = Array(6).fill(0);
    const myMarkingCounts = Array(6).fill(0);
    if (imp.marks) {
      Object.values(imp.marks).forEach((mark) => {
        if (mark.markings)
          mark.markings.forEach((on, i) => {
            if (on) impMarkingCounts[i]++;
          });
      });
    }
    const importedIds = new Set(Object.keys(imp.marks).map(Number));
    state.wazaData.forEach((w) => {
      if (importedIds.has(w.id)) {
        const p = getP(w.id);
        if (p.markings)
          p.markings.forEach((on, i) => {
            if (on) myMarkingCounts[i]++;
          });
      }
    });

    combinedLabelsHTML =
      '<div class="dsec2"><h3>Labels comparison</h3>' +
      SHAPES.map((s, i) => {
        const impLabel = imp.labels && imp.labels[i] ? imp.labels[i] : '';
        const myLabel = state.markingLabels[i] || '';
        return (
          '<div class="labels-row">' +
          '<span class="labels-marking">' +
          s +
          '</span>' +
          '<div class="labels-combined">' +
          '<div class="labels-stacked">' +
          '<div class="labels-imported" title="Their label">' +
          (impLabel
            ? escapeHtml(impLabel)
            : '<span style="color:var(--text3);font-style:italic">Unlabeled</span>') +
          '</div>' +
          '<div class="labels-divider"></div>' +
          '<input class="labels-input-bottom" data-si="' +
          i +
          '" type="text" maxlength="32" placeholder="Your label…" value="' +
          myLabel.replace(/"/g, '&quot;') +
          '" title="Your label">' +
          '</div>' +
          '</div>' +
          '<div class="labels-count-stacked">' +
          '<div class="labels-count-top" title="Their marks">' +
          impMarkingCounts[i] +
          '</div>' +
          '<div class="labels-count-divider"></div>' +
          '<div class="labels-count-bottom" title="Your marks">' +
          myMarkingCounts[i] +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }).join('') +
      saveBtnHtml +
      '</div>';
  } else {
    const myMarkingCounts = Array(6).fill(0);
    state.wazaData.forEach((w) => {
      const p = getP(w.id);
      if (p.markings)
        p.markings.forEach((on, i) => {
          if (on) myMarkingCounts[i]++;
        });
    });
    combinedLabelsHTML =
      '<div class="dsec2"><h3>My labels</h3>' +
      SHAPES.map(
        (s, i) =>
          '<div class="labels-row">' +
          '<span class="labels-marking">' +
          s +
          '</span>' +
          '<input class="labels-input" data-si="' +
          i +
          '" type="text" maxlength="32" placeholder="Label this marking…" value="' +
          state.markingLabels[i].replace(/"/g, '&quot;') +
          '">' +
          '<span class="labels-count">' +
          myMarkingCounts[i] +
          ' waza</span>' +
          '</div>',
      ).join('') +
      saveBtnHtml +
      '</div>';
  }

  const importedIds = imp ? new Set(Object.keys(imp.marks).map(Number)) : new Set();
  const rows = state.wazaData.filter((w) => importedIds.has(w.id));
  const colHeaders =
    '<div class="cmp-col-headers"><span>Waza</span><span>Their marks</span><span>Your marks</span></div>';
  const rowsHtml = rows
    .map((w) => {
      const importedMark = imp
        ? imp.marks[w.id] || { markings: Array(6).fill(false), like: null }
        : { markings: Array(6).fill(false), like: null };
      const myP = getP(w.id);
      const myMarkings = myP.markings || Array(6).fill(false);
      const impMarkings = importedMark.markings || Array(6).fill(false);
      return (
        '<div class="cmp-row" data-id="' +
        w.id +
        '">' +
        '<div><div class="cmp-name-jp">' +
        (w.name_jp || '—') +
        '</div><div class="cmp-name-en">' +
        dispName(w) +
        '</div></div>' +
        '<div class="cmp-markings-imported">' +
        markingPips(impMarkings) +
        '</div>' +
        '<div class="cmp-markings-mine">' +
        SHAPES.map(
          (s, i) =>
            '<button class="cmp-marking-btn' +
            (myMarkings[i] ? ' on' : '') +
            '" data-wid="' +
            w.id +
            '" data-si="' +
            i +
            '" title="' +
            (state.markingLabels[i] || 'Marking ' + (i + 1)) +
            '">' +
            s +
            '</button>',
        ).join('') +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  const emptyRows = !rows.length
    ? '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">This list has no marks.</div>'
    : '';

  container.innerHTML =
    combinedLabelsHTML + headerHtml + (rows.length ? colHeaders : '') + rowsHtml + emptyRows;

  container.querySelector('#cmpExportBtn')?.addEventListener('click', openExportModal);

  // Save button — single handler covers both .labels-input and .labels-input-bottom
  container.querySelector('#cmpSaveLabelsBtn')?.addEventListener('click', () => {
    container.querySelectorAll('.labels-input, .labels-input-bottom').forEach((inp) => {
      state.markingLabels[+inp.dataset.si] = inp.value;
    });
    saveLabels();
    showToast('Labels saved', 'green');
  });

  container.querySelector('#cmpSelect').addEventListener('change', (e) => {
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

  container.querySelectorAll('.cmp-marking-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = +btn.dataset.wid,
        si = +btn.dataset.si;
      const cur = getP(wid);
      const ns = [...(cur.markings || Array(6).fill(false))];
      ns[si] = !ns[si];
      saveP(wid, { markings: ns }).then(() => renderDashCompare());
    });
  });

  container.querySelectorAll('.cmp-row').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('cmp-marking-btn')) return;
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });
}
