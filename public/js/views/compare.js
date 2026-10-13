/**
 * @file views/compare.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-25
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

import { getMyGroupsLoaded } from '../state/user-state.js';
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

let compareRenderVersion = 0;

/**
 * @brief Renders the Compare tab.
 *
 * @return {Promise<void>}
 */
export async function renderDashCompare() {
  const container = document.getElementById('dashCompare');
  if (!container) return;
   
  const renderVersion = ++compareRenderVersion;
   
  if (!getMyGroupsLoaded()) {
    await refreshMyGroups();
  }
   
  if (
    renderVersion !== compareRenderVersion ||
    !container.isConnected
  ) {
    return;
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
