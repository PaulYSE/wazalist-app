/**
 * @file components/compare-table.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-25
 * @brief Unified comparison matrix builder for the Compare tab, plus the
 *        shared wiring helpers (save labels, mark toggles, row navigation,
 *        column removal) used after the matrix is rendered.
 *
 *        Supersedes the old two-party-only table builders and the separate
 *        N-column bulk matrix builder — both are now the same function.
 *        A comparison with zero added entries, one entry, or many entries
 *        all flow through buildCompareMatrixHTML(); the only thing that
 *        changes is how many columns get rendered.
 */

import { state } from '../state/state.js';
import { SHAPES } from '../config/constants.js';
import { saveLabels, getP, saveP } from '../services/progress.js';
import { showToast } from './show-toast.js';
import { escapeHtml } from '../lib/escape.js';
import { dispName } from '../lib/search.js';
import { markingPips } from './render-helpers.js';
import { navigateToBrowse } from '../app/shell.js';
import { selectWaza } from '../views/waza-detail.js';

// ── Main Entry Point ────────────────────────────────────────

/**
 * @brief Builds the full HTML for the Compare tab's result section:
 *        the Marking Labels table, followed by the waza comparison rows.
 *
 * @param {Object[]} entries - Added comparison entries (sourceType 'member'|'imported'), NOT including "you".
 * @param {Object} yourEntry - Your own entry, shape { sourceType: 'self', sourceId, username: 'You', markings, labels }.
 * @param {Object} [opts]
 * @param {'both'|'jp'|'en'} [opts.wazaNameDisplay='both'] - Waza name display mode.
 *   @todo Extend to primary/secondary language pairs (JP+CN, EN+CN, etc.)
 *         once that preference UI exists. Only 'both' (JP+EN), 'jp', and
 *         'en' are implemented today.
 * @param {string} [opts.emptyMessage] - Shown when entries is empty (no comparison added yet).
 * @return {string} HTML string.
 */
export function buildCompareMatrixHTML(entries, yourEntry, opts = {}) {
  const {
    wazaNameDisplay = 'both',
    emptyMessage = 'Add a Group member or Imported List to start comparing.',
  } = opts;

  const allMembers = [...entries, yourEntry]; // entries first, "you" always last

  // ── Zero entries: just your own labels, nothing to compare against ──
  if (!entries.length) {
    return buildLabelsTableHTML(allMembers) + '<div class="cmp-empty">' + emptyMessage + '</div>';
  }

  // Row set is anchored on what the OTHER parties have marked — matching
  // the original design (your own marks alone never produce rows; the
  // comparison is "what have they marked, and how do you compare").
  const wazaIds = new Set();
  entries.forEach((e) => Object.keys(e.markings || {}).forEach((id) => wazaIds.add(+id)));
  const rows = state.wazaData.filter((w) => wazaIds.has(w.id));

  const labelsHtml = buildLabelsTableHTML(allMembers);

  if (!rows.length) {
    return (
      labelsHtml +
      '<div class="cmp-empty">None of the added members or lists have marked any Waza yet.</div>'
    );
  }

  const headersHtml = buildHeadersHTML(allMembers);
  const rowsHtml = rows.map((w) => buildRowHTML(w, allMembers, wazaNameDisplay)).join('');

  return labelsHtml + headersHtml + rowsHtml;
}

// ── Labels Section ──────────────────────────────────────────

/**
 * @brief Counts how many waza have a given marking index active.
 *
 * @param {Object<number, boolean[]>} markings
 * @param {number} markingIndex
 * @return {number}
 */
function countMarking(markings, markingIndex) {
  let count = 0;
  Object.values(markings || {}).forEach((arr) => {
    if (arr && arr[markingIndex]) count++;
  });
  return count;
}

/**
 * @brief Builds the Marking Labels comparison section.
 *
 * A header row identifies which column belongs to which entry (matching
 * the same identification the waza-rows header below it provides), followed
 * by one row per marking (●▲■♥★◆). Every non-"you" column is read-only;
 * "you" always gets an editable input, regardless of how many other
 * columns are present — including the zero-entries case.
 *
 * @param {Object[]} allMembers - entries + your own entry, "you" last.
 * @return {string} HTML string.
 */
function buildLabelsTableHTML(allMembers) {
  const others = allMembers.filter((m) => m.sourceType !== 'self');
  const yours = allMembers.find((m) => m.sourceType === 'self');

  const columnCount = others.length + 2; // marking symbol + others + you
  const gridStyle = 'style="grid-template-columns: 40px repeat(' + (columnCount - 1) + ', 1fr)"';

  // ── Header row: whose column is whose ──────────────────────
  let headerRow = '<div class="cmp-labels-row cmp-labels-header" ' + gridStyle + '>';
  headerRow += '<span class="cmp-labels-marking"></span>';
  others.forEach((m) => {
    headerRow += '<span class="cmp-labels-col-name">' + escapeHtml(m.username) + '</span>';
  });
  headerRow += '<span class="cmp-labels-col-name cmp-labels-col-name-you">You</span>';
  headerRow += '</div>';

  const rowsHtml = SHAPES.map((s, i) => {
    let row = '<div class="cmp-labels-row" ' + gridStyle + '>';
    row += '<span class="cmp-labels-marking">' + s + '</span>';

    others.forEach((m) => {
      const label = (m.labels && m.labels[i]) || '';
      const count = countMarking(m.markings, i);
      row += '<div class="cmp-labels-their">';
      row += label
        ? '<span class="label-names">' + escapeHtml(label) + '</span>'
        : '<span class="label-unset">Unlabelled</span>';
      row += '<span class="cmp-labels-count">' + count + ' waza</span>';
      row += '</div>';
    });

    const yourLabel = (yours && yours.labels && yours.labels[i]) || '';
    const yourCount = yours ? countMarking(yours.markings, i) : 0;
    row += '<div class="cmp-labels-mine">';
    row +=
      '<input class="cmp-labels-input" data-si="' +
      i +
      '" type="text" maxlength="32" placeholder="Your Marking Label…" value="' +
      yourLabel.replace(/"/g, '&quot;') +
      '">';
    row += '<span class="cmp-labels-count">' + yourCount + ' waza</span>';
    row += '</div>';

    row += '</div>';
    return row;
  }).join('');

  const saveBtnRow =
    '<div class="cmp-labels-actions">' +
    '<button class="btn" id="cmpSaveLabelsBtn">Save Marking Labels</button>' +
    '</div>';

  return (
    '<div class="dsec2">' +
    '<h3>Marking Labels</h3>' +
    '<div class="cmp-labels-table">' +
    headerRow +
    rowsHtml +
    '</div>' +
    saveBtnRow +
    '</div>'
  );
}

// ── Column Headers ──────────────────────────────────────────

/**
 * @brief Builds the column header row: waza name + one header per member.
 *
 * Every non-"you" column gets a ✕ remove button. There is no edit-mode
 * gate any more — removing a column is always available, the same way
 * it was always available to switch lists in the old single-compare view.
 *
 * @param {Object[]} allMembers
 * @return {string} HTML string.
 */
function buildHeadersHTML(allMembers) {
  const columnCount = allMembers.length + 1; // waza name + members
  const gridStyle = 'style="grid-template-columns: 1fr repeat(' + (columnCount - 1) + ', auto)"';

  let html = '<div class="cmp-col-headers cmp-matrix-headers" ' + gridStyle + '>';
  html += '<span>Waza</span>';

  allMembers.forEach((m) => {
    html += '<span class="cmp-matrix-header-cell">';
    html += escapeHtml(m.username);
    if (m.sourceType !== 'self') {
      // data-source-id is always a string here (DOM dataset attributes are
      // always strings) — the caller wiring removeCompareEntry() must
      // convert back to a number for 'member' sourceType before comparing.
      html +=
        ' <button class="cmp-matrix-remove-btn" data-source-type="' +
        m.sourceType +
        '" data-source-id="' +
        m.sourceId +
        '" title="Remove ' +
        escapeHtml(m.username) +
        '">✕</button>';
    }
    html += '</span>';
  });

  html += '</div>';
  return html;
}

// ── Matrix Row ──────────────────────────────────────────────

/**
 * @brief Builds a single waza row across all member columns.
 *
 * @param {Object} w - Waza object from state.wazaData.
 * @param {Object[]} allMembers
 * @param {'both'|'jp'|'en'} wazaNameDisplay
 * @return {string} HTML string.
 */
function buildRowHTML(w, allMembers, wazaNameDisplay) {
  const columnCount = allMembers.length + 1;
  const gridStyle = 'style="grid-template-columns: 1fr repeat(' + (columnCount - 1) + ', auto)"';

  let html = '<div class="cmp-row cmp-matrix-row" data-id="' + w.id + '" ' + gridStyle + '>';

  // Waza name cell
  html += '<div class="cmp-names">';
  if (wazaNameDisplay === 'jp') {
    html += '<div class="cmp-name-jp">' + escapeHtml(w.name_jp || '—') + '</div>';
  } else if (wazaNameDisplay === 'en') {
    html += '<div class="cmp-name-en">' + escapeHtml(dispName(w)) + '</div>';
  } else {
    html += '<div class="cmp-name-jp">' + escapeHtml(w.name_jp || '—') + '</div>';
    html += '<div class="cmp-name-en">' + escapeHtml(dispName(w)) + '</div>';
  }
  html += '</div>';

  // Member columns — "you" is always an interactive toggle pill;
  // everyone else is always read-only pips. No mode switch.
  allMembers.forEach((m) => {
    const markings = (m.markings && m.markings[w.id]) || Array(6).fill(false);

    if (m.sourceType === 'self') {
      html += '<div class="cmp-mark-pill">';
      html += SHAPES.map(
        (s, i) =>
          '<button class="cmp-mark-seg' +
          (markings[i] ? ' on' : '') +
          '" data-wid="' +
          w.id +
          '" data-si="' +
          i +
          '" title="' +
          escapeHtml(state.markingLabels[i] || 'Marking ' + (i + 1)) +
          '">' +
          s +
          '</button>',
      ).join('');
      html += '</div>';
    } else {
      html += '<div class="cmp-markings-imported">' + markingPips(markings) + '</div>';
    }
  });

  html += '</div>';
  return html;
}

// ── Wiring Helpers ──────────────────────────────────────────

/**
 * @brief Wires the "Save Marking Labels" button inside a container.
 *
 * Reads all .cmp-labels-input values, writes them to state.markingLabels,
 * persists via saveLabels(), and shows a toast.
 *
 * @param {HTMLElement} container - DOM element containing #cmpSaveLabelsBtn and .cmp-labels-input elements.
 * @return {void}
 */
export function wireSaveLabelsButton(container) {
  container.querySelector('#cmpSaveLabelsBtn')?.addEventListener('click', () => {
    container.querySelectorAll('.cmp-labels-input').forEach((inp) => {
      state.markingLabels[+inp.dataset.si] = inp.value;
    });
    saveLabels();
    showToast('Marking Labels saved', 'green');
  });
}

/**
 * @brief Wires mark toggles, row-click navigation, and column-remove buttons.
 *
 * Call this after setting innerHTML that contains .cmp-mark-seg buttons,
 * .cmp-row elements, and/or .cmp-matrix-remove-btn buttons. Safe to call
 * multiple times — uses querySelectorAll, which only targets elements
 * present at call time.
 *
 * @param {HTMLElement} container - DOM element containing the rendered matrix.
 * @param {Function} [onRemove] - Called as onRemove(sourceType, sourceIdString)
 *   when a column's ✕ is clicked. Conversion of sourceIdString back to a
 *   number (for 'member' entries) is the caller's responsibility, since
 *   this module doesn't know which sourceType needs which ID type.
 * @return {void}
 */
export function wireCompareTableListeners(container, onRemove) {
  container.querySelectorAll('.cmp-mark-seg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = +btn.dataset.wid;
      const si = +btn.dataset.si;
      const ns = (getP(wid).markings || Array(6).fill(false)).slice();
      ns[si] = !ns[si];
      btn.classList.toggle('on', ns[si]);
      saveP(wid, { markings: ns });
    });
  });

  container.querySelectorAll('.cmp-row').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.cmp-mark-pill')) return;
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });

  if (onRemove) {
    container.querySelectorAll('.cmp-matrix-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(btn.dataset.sourceType, btn.dataset.sourceId);
      });
    });
  }
}
