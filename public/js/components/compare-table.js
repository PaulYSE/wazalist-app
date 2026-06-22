/**
 * @file components/compare-table.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-23
 * @brief Shared compare table builders and wiring helpers. Used by the Compare tab
 *        to render marking labels tables and waza comparison rows, and to wire
 *        interactive marking toggles and row-click navigation.
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

// ── Labels Table ────────────────────────────────────────────

/**
 * @brief Builds the HTML for a marking labels comparison table.
 *
 * Renders a table comparing marking labels between two users (or just the current user).
 * Displays shape symbols, label inputs, and waza counts. When a second user is provided,
 * shows a two-column layout (their labels read-only, your labels editable).
 *
 * @param {string} title - Section title to display.
 * @param {Object} userFirst - First user's data object containing { labels: string[], counts: number[] }.
 * @param {Object} [userSecond] - Optional second user's data object for two-column comparison.
 * @return {string} HTML string for the labels comparison section.
 */
export function buildCompareMarkingLabelsTableHTML(title, userFirst, userSecond) {
  const rowsHtml = SHAPES.map((s, i) => {
    const myLabels = userFirst.labels[i] || '';
    const myCounts = userFirst.counts[i];

    if (userSecond) {
      const theirLabels = userSecond.labels[i] || '';
      const theirCounts = userSecond.counts[i];

      return (
        '<div class="cmp-labels-row">' +
        '<span class="cmp-labels-marking">' +
        s +
        '</span>' +
        '<div class="cmp-labels-their">' +
        (theirLabels
          ? '<span class="label-names">' + escapeHtml(theirLabels) + '</span>'
          : '<span class="label-unset">Unlabelled</span>') +
        '<span class="cmp-labels-count">' +
        theirCounts +
        ' waza</span>' +
        '</div>' +
        '<div class="cmp-labels-mine">' +
        '<input class="cmp-labels-input" data-si="' +
        i +
        '" type="text" maxlength="32" placeholder="Your Marking Label…" value="' +
        myLabels.replace(/"/g, '&quot;') +
        '">' +
        '<span class="cmp-labels-count">' +
        myCounts +
        ' waza</span>' +
        '</div>' +
        '</div>'
      );
    } else {
      return (
        '<div class="cmp-labels-row cmp-labels-row-solo">' +
        '<span class="cmp-labels-marking">' +
        s +
        '</span>' +
        '<div class="cmp-labels-mine">' +
        '<input class="cmp-labels-input" data-si="' +
        i +
        '" type="text" maxlength="32" placeholder="Label this Marking…" value="' +
        myLabels.replace(/"/g, '&quot;') +
        '">' +
        '<span class="cmp-labels-count">' +
        myCounts +
        ' waza</span>' +
        '</div>' +
        '</div>'
      );
    }
  }).join('');

  const saveBtnRow =
    '<div class="cmp-labels-actions">' +
    '<button class="btn" id="cmpSaveLabelsBtn">Save Marking Labels</button>' +
    '</div>';

  return (
    '<div class="dsec2">' +
    '<h3>' +
    escapeHtml(title) +
    '</h3>' +
    '<div class="cmp-labels-table">' +
    rowsHtml +
    '</div>' +
    saveBtnRow +
    '</div>'
  );
}

// ── Waza Rows Table ─────────────────────────────────────────

/**
 * @brief Builds an HTML string for the waza comparison rows table.
 *
 * Renders column headers ("Waza", theirLabel, "Your marks") and a row per waza.
 * Each row shows the waza names, their marking pips (read-only), and your marking
 * toggle buttons (interactive — wiring happens after render via wireCompareTableListeners).
 *
 * @param {Set<number>}              wazaIds       - Set of waza IDs to display.
 * @param {Object<number, boolean[]>} theirMarkings - Map of wazaId → marking booleans.
 * @param {string}                   theirName    - Text for the "their" column header.
 * @param {string}                   emptyMessage  - Message shown when no waza have marks.
 * @return {string} HTML string for the comparison table (col-headers + rows).
 */
export function buildCompareMarkingTableRowsHTML(wazaIds, theirMarkings, theirName, emptyMessage) {
  const rows = state.wazaData.filter((w) => wazaIds.has(w.id));

  if (!rows.length) {
    return '<div class="cmp-empty">' + emptyMessage + '</div>';
  }

  const colHeaders =
    '<div class="cmp-col-headers">' +
    '<span>Waza</span>' +
    '<span>' +
    escapeHtml(theirName) +
    '</span>' +
    '<span>Your marks</span>' +
    '</div>';

  const rowsHtml = rows
    .map((w) => {
      const theirs = theirMarkings[w.id] || Array(6).fill(false);
      const mine = (getP(w.id).markings || Array(6).fill(false)).slice();

      return (
        '<div class="cmp-row" data-id="' +
        w.id +
        '">' +
        '<div class="cmp-names">' +
        '<div class="cmp-name-jp">' +
        escapeHtml(w.name_jp || '—') +
        '</div>' +
        '<div class="cmp-name-en">' +
        escapeHtml(dispName(w)) +
        '</div>' +
        '</div>' +
        '<div class="cmp-markings-imported">' +
        markingPips(theirs) +
        '</div>' +
        '<div class="cmp-mark-pill">' +
        SHAPES.map(
          (s, i) =>
            '<button class="cmp-mark-seg' +
            (mine[i] ? ' on' : '') +
            '" data-wid="' +
            w.id +
            '" data-si="' +
            i +
            '" title="' +
            escapeHtml(state.markingLabels[i] || 'Marking ' + (i + 1)) +
            '">' +
            s +
            '</button>',
        ).join('') +
        '</div></div>'
      );
    })
    .join('');

  return colHeaders + rowsHtml;
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
 * @brief Wires marking toggles and row-click navigation inside a container.
 *
 * Call this after setting innerHTML that contains .cmp-mark-seg buttons
 * and .cmp-row elements. Safe to call multiple times — uses querySelectorAll
 * which only targets elements present at call time.
 *
 * @param {HTMLElement} container - DOM element containing compare rows.
 * @return {void}
 */
export function wireCompareTableListeners(container) {
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
}
