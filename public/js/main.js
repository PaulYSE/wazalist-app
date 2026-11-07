/**
 * @file main.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-28
 * @brief Application entry point. Initializes all modules, sets up event listeners, and boots the app based on authentication state.
 */

import { state } from './state/state.js';
import { initApp } from './app/init.js';
import { initAuth } from './services/auth.js';
import { initBrowseList, renderList } from './views/waza-browse-list.js';
import { initBrowseState } from './state/waza-browse-state.js';
import { initCompareState } from './state/compare-state.js';
import {
  initWazaDetail,
  selectWazaFromHistory,
  closeDetailPanelFromHistory,
} from './views/waza-detail.js';
import { initUi, closeMobMenu, activateTab } from './app/shell.js';
import { initShare } from './features/share-list.js';
import { initNewWaza } from './modals/waza-new.js';
import { initSuggestEdit, initFieldEdit } from './modals/waza-edit.js';
import { initOnboarding, showOnboarding } from './features/onboarding.js';
import { parseRoute } from './app/router.js';
import { initTheme } from './services/theme.js';
import { renderDashStats } from './views/stats.js';
import { renderDashCompare } from './views/compare.js';
import {
  initGroups,
  selectGroupFromHistory,
  closeGroupDetailFromHistory,
} from './views/groups-browse-list.js';
import { getGroupsSelectedId } from './state/groups-state.js';
import { initCreateGroup } from './modals/group-new.js';
import { initEditGroup } from './modals/group-edit.js';
import { getToken, initToken } from './state/user-state.js';
import {
  checkForGroupJoinKey,
  hasPendingGroupJoin,
  showPendingJoinBanner,
} from './features/group-join-link.js';

// ── Guide buttons ─────────────────────────────────────────────

/**
 * Shows the onboarding guide when the Help button is clicked.
 *
 * @return {void}
 */
document.getElementById('helpBtn').addEventListener('click', () => {
  showOnboarding();
});

/**
 * Closes the mobile menu and shows the onboarding guide when the
 * Help button is clicked.
 *
 * @return {void}
 */
document.getElementById('mobHelpBtn').addEventListener('click', () => {
  closeMobMenu();
  showOnboarding();
});

// ── Popstate — back button closes the detail panel ────────────

/**
* Reconciles application navigation state after browser history navigation.
*
* Restores the active tab and corresponding Waza or Group detail state
* from the current URL without creating additional history entries.
* Waza parameters are resolved through resolveWaza(), while Group
* parameters must be numeric. Missing or invalid detail parameters close
* any corresponding open detail selection.
*
* @return {void}
*/
window.addEventListener('popstate', () => {
  const { tab, wazaParam, groupParam } = parseRoute();

  // 1. Reconcile the tab (visual switch only — no history write).
  const currentTab = document.querySelector('.ntab.active')?.dataset.tab;
  if (tab !== currentTab) activateTab(tab);

  // 2. Reconcile the waza (only meaningful on browse).
  const targetId = wazaParam ? resolveWaza(wazaParam) : null;
  if (targetId != null) {
    if (state.selectedId !== targetId) selectWazaFromHistory(targetId);
  } else if (state.selectedId !== null) {
    closeDetailPanelFromHistory();
  }

  // 3. Reconcile the group (only meaningful on groups). Group ids are
  // purely numeric — no name-slug fallback exists for groups the way
  // it does for waza, so an invalid/non-numeric param is just ignored.
  const targetGroupId = groupParam ? parseInt(groupParam) : null;
  if (targetGroupId != null && !isNaN(targetGroupId)) {
    if (getGroupsSelectedId() !== targetGroupId) selectGroupFromHistory(targetGroupId);
  } else if (getGroupsSelectedId() !== null) {
    closeGroupDetailFromHistory();
  }
});

/**
 * Handles theme changes by re-rendering views with theme-dependent marking tints.
 *
 * Marking tints are baked into inline styles at render time and depend on the
 * current theme's color scheme. Re-renders the Browse, Stats, and Compare
 * views so their marking styles reflect the newly active theme.
 *
 * @return {void}
 */
window.addEventListener('themechange', () => {
  renderList();
  renderDashStats();
  renderDashCompare();
});

/**
 * @brief Resolves a decoded Waza URL parameter to a valid Waza ID.
 *
 * Supports numeric IDs and exact Japanese-name parameters for backward
 * compatibility. The parameter has already been decoded by URLSearchParams.
 *
 * @param {string} param - Decoded numeric ID or exact Japanese name.
 * @return {number|null} Matching Waza ID, or null if no match exists.
 */
function resolveWaza(param) {
  const id = parseInt(param);

  if (!isNaN(id) && state.wazaData.some((w) => w.id === id)) {
    return id;
  }

  const match = state.wazaData.find(
    (w) => w.name_jp && w.name_jp.trim() === param,
  );

  return match ? match.id : null;
}

// ── Boot ──────────────────────────────────────────────────────

initBrowseState();
initCompareState();
initBrowseList();
initWazaDetail();
initUi();
initShare();
initGroups();
initCreateGroup();
initEditGroup();
initNewWaza();
initSuggestEdit();
initFieldEdit();
initOnboarding();
initAuth();
initTheme();

// Initialize token state from localStorage, then boot if logged in
initToken();
if (getToken()) {
  initApp();
} else {
  checkForGroupJoinKey().then(() => {
    if (hasPendingGroupJoin()) showPendingJoinBanner();
  });
}
