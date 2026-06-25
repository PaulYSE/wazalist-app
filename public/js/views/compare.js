/**
 * @file views/compare.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-24
 * @brief Compare tab view. Thin orchestrator: reads the active comparison
 *        entries from compare-state.js, asks compare-table.js to build the
 *        result matrix and compare-controls.js to build the control bar,
 *        then assembles and wires both into #dashCompare.
 *
 *        This file never mutates entries[] directly — additions happen in
 *        compare-controls.js, removals are wired here but delegate to
 *        compare-state.js's removeCompareEntry(). compare.js only re-renders
 *        after either happens.
 */

import { getMyGroupsLoaded, isAdmin } from '../state/user-state.js';
import { refreshMyGroups } from './groups-browse-list.js';
import { buildYourEntry } from '../services/compare-data.js';
import {
  getCompareEntries,
  getCompareWazaNameDisplay,
  removeCompareEntry,
} from '../state/compare-state.js';
import {
  buildCompareMatrixHTML,
  wireCompareTableListeners,
  wireSaveLabelsButton,
} from '../components/compare-table.js';
import { buildCompareControlsHTML, wireCompareControls } from './compare-controls.js';

// ── TEMPORARY: BLOCK START ────────────────────────────────────
// ── Admin-only access while the unified Compare rewrite is tested ──
// TODO: Remove this entire block once the new Compare tab (unifying the
// old Group/Imported/Bulk modes into one comparison surface) is considered
// stable and ready for all users.
//
// Differs slightly from groups-browse-list.js's enableGroupsForAdmins():
// that function re-applies visibility because it can run before login
// completes. renderDashCompare() is only ever called after a tab click
// (well after login), so there's no timing issue here — isAdmin() is
// simply checked live on every render. The dev override below exists
// purely so this can be previewed without an actual admin account.

/**
 * @brief Whether the new unified Compare tab should render for the current user.
 *
 * @return {boolean}
 */
function isCompareUnlocked() {
  return isAdmin() || !!window._compareDevOverride;
}

/**
 * @brief Dev-console override to preview the new Compare tab without an
 *        admin account. Call from the console: enableCompareForAdmins()
 *
 * @return {void}
 */
window.enableCompareForAdmins = function () {
  window._compareDevOverride = !window._compareDevOverride;
  renderDashCompare();
};

// ── TEMPORARY: BLOCK END ──────────────────────────────────────

/**
 * @brief Renders the Compare tab.
 *
 * @return {Promise<void>}
 */
export async function renderDashCompare() {
  const container = document.getElementById('dashCompare');
  if (!container) return;

  if (!isCompareUnlocked()) {
    container.innerHTML =
      '<div class="dsec2" style="text-align:center;padding:24px 0;color:var(--text3)">' +
      'Compare is being upgraded — check back soon.' +
      '</div>';
    return;
  }

  // Group picker in the add panel needs state.myGroups populated. Lazy-load
  // once per session — joining/leaving a group elsewhere already resets
  // the loaded flag, so this stays correct without forcing a refetch here.
  if (!getMyGroupsLoaded()) {
    await refreshMyGroups();
  }

  const entries = getCompareEntries();
  const yourEntry = buildYourEntry();

  const controlsHtml = buildCompareControlsHTML();
  const matrixHtml = buildCompareMatrixHTML(entries, yourEntry, {
    wazaNameDisplay: getCompareWazaNameDisplay(),
  });

  container.innerHTML = controlsHtml + '<div id="cmpResult">' + matrixHtml + '</div>';

  wireCompareControls(container, renderDashCompare);

  const resultEl = document.getElementById('cmpResult');
  wireSaveLabelsButton(resultEl);
  wireCompareTableListeners(resultEl, (sourceType, sourceIdString) => {
    // .dataset values are always strings — 'member' entries use a numeric
    // sourceId in compare-state, so it must be converted back here.
    const sourceId = sourceType === 'member' ? +sourceIdString : sourceIdString;
    removeCompareEntry(sourceType, sourceId);
    renderDashCompare();
  });
}