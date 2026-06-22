/**
 * @file components/compare-matrix.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-23
 * @brief Bulk compare matrix builder. Renders multi-column comparison tables
 *        for the Bulk Compare feature in the Compare tab.
 */

import { state } from '../state/state.js';
import { SHAPES } from '../config/constants.js';
import { escapeHtml } from '../lib/escape.js';
import { dispName } from '../lib/search.js';
import { markingPips } from './render-helpers.js';

// ── Main Entry Point ────────────────────────────────────────

/**
 * @brief Builds the HTML for a multi-column bulk compare matrix.
 *
 * Renders labels section (one row per marking, read-only columns per member
 * plus your editable column), column headers, and matrix rows.
 *
 * @param {Set<number>} wazaIds - Set of waza IDs to display.
 * @param {Array<{userId: number, username: string, markings: Object<number, boolean[]>, labels: string[]}>} membersData - Selected members' data.
 * @param {number} yourUserId - Your user ID for the interactive column.
 * @param {Object} opts - Options.
 * @param {boolean} [opts.editMode=false] - Whether edit mode is active.
 * @param {'both'|'jp'|'en'} [opts.wazaNameDisplay='both'] - Waza name display mode.
 * @param {string} [opts.emptyMessage='No waza to compare.'] - Empty state message.
 * @return {string} HTML string for the matrix.
 */
export function buildCompareMatrixHTML(wazaIds, membersData, yourUserId, opts = {}) {
  const { editMode = false, wazaNameDisplay = 'both', emptyMessage = 'No waza to compare.' } = opts;

  const rows = state.wazaData.filter((w) => wazaIds.has(w.id));

  if (!rows.length) {
    return '<div class="cmp-empty">' + emptyMessage + '</div>';
  }

  const labelsHtml = buildMatrixLabelsHTML(membersData, yourUserId);
  const headersHtml = buildMatrixHeadersHTML(membersData, editMode);
  const rowsHtml = rows
    .map((w) => buildMatrixRowHTML(w, membersData, yourUserId, editMode, wazaNameDisplay))
    .join('');

  return labelsHtml + headersHtml + rowsHtml;
}

// ── Labels Section ──────────────────────────────────────────

/**
 * @brief Builds the labels comparison section for the matrix.
 *
 * One row per marking (●▲■♥★◆). Each member gets a read-only label display.
 * Your labels are editable inputs.
 *
 * @param {Array<{userId: number, username: string, labels: string[]}>} membersData
 * @param {number} yourUserId
 * @return {string} HTML string.
 */
function buildMatrixLabelsHTML(membersData, yourUserId) {
  const yourData = membersData.find((m) => m.userId === yourUserId);
  const otherMembers = membersData.filter((m) => m.userId !== yourUserId);

  const columnCount = otherMembers.length + 2; // symbol + others + you
  const gridStyle = 'style="grid-template-columns: 40px repeat(' + (columnCount - 1) + ', 1fr)"';

  const rowsHtml = SHAPES.map((s, i) => {
    let row = '<div class="cmp-labels-row" ' + gridStyle + '>';
    row += '<span class="cmp-labels-marking">' + s + '</span>';

    otherMembers.forEach((m) => {
      const label = m.labels && m.labels[i] ? m.labels[i] : '';
      row += '<div class="cmp-labels-their">';
      row += label
        ? '<span class="label-names">' + escapeHtml(label) + '</span>'
        : '<span class="label-unset">Unlabelled</span>';
      row += '</div>';
    });

    const yourLabel = yourData && yourData.labels ? yourData.labels[i] || '' : '';
    row += '<div class="cmp-labels-mine">';
    row +=
      '<input class="cmp-labels-input" data-si="' +
      i +
      '" type="text" maxlength="32" placeholder="Your Marking Label…" value="' +
      yourLabel.replace(/"/g, '&quot;') +
      '">';
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
    rowsHtml +
    '</div>' +
    saveBtnRow +
    '</div>'
  );
}

// ── Column Headers ──────────────────────────────────────────

/**
 * @brief Builds the column header row for the matrix.
 *
 * @param {Array<{userId: number, username: string}>} membersData
 * @param {boolean} editMode - Whether to show remove buttons.
 * @return {string} HTML string.
 */
function buildMatrixHeadersHTML(membersData, editMode) {
  const columnCount = membersData.length + 1; // waza name + members
  const gridStyle = 'style="grid-template-columns: 1fr repeat(' + (columnCount - 1) + ', auto)"';

  let html = '<div class="cmp-col-headers cmp-matrix-headers" ' + gridStyle + '>';
  html += '<span>Waza</span>';

  membersData.forEach((m) => {
    html += '<span class="cmp-matrix-header-cell">';
    html += escapeHtml(m.username);
    if (editMode) {
      html +=
        ' <button class="cmp-matrix-remove-btn" data-uid="' +
        m.userId +
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
 * @brief Builds a single waza row for the matrix.
 *
 * @param {Object} w - Waza object from state.wazaData.
 * @param {Array<{userId: number, markings: Object<number, boolean[]>}>} membersData
 * @param {number} yourUserId
 * @param {boolean} editMode
 * @param {'both'|'jp'|'en'} wazaNameDisplay
 * @return {string} HTML string.
 */
function buildMatrixRowHTML(w, membersData, yourUserId, editMode, wazaNameDisplay) {
  const columnCount = membersData.length + 1;
  const gridStyle = 'style="grid-template-columns: 1fr repeat(' + (columnCount - 1) + ', auto)"';

  let html = '<div class="cmp-row cmp-matrix-row" data-id="' + w.id + '" ' + gridStyle + '>';

  // Waza name cell
  html += '<div class="cmp-names">';
  if (wazaNameDisplay === 'jp') {
    html += '<div class="cmp-name-jp">' + escapeHtml(w.name_jp || '—') + '</div>';
  } else if (wazaNameDisplay === 'en') {
    html += '<div class="cmp-name-jp">' + escapeHtml(dispName(w)) + '</div>';
  } else {
    html += '<div class="cmp-name-jp">' + escapeHtml(w.name_jp || '—') + '</div>';
    html += '<div class="cmp-name-en">' + escapeHtml(dispName(w)) + '</div>';
  }
  html += '</div>';

  // Member columns
  membersData.forEach((m) => {
    const markings = m.markings && m.markings[w.id] ? m.markings[w.id] : Array(6).fill(false);

    if (m.userId === yourUserId && editMode) {
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
