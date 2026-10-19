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
 * @brief Resolves a waza URL parameter to a valid waza ID.
 *
 * Supports both numeric IDs and Japanese name slugs for backward compatibility.
 *
 * @param {string} param - URL parameter value (numeric ID or JP name slug).
 * @return {number|null} Waza ID if found, null otherwise.
 */
function resolveWaza(param) {
  const id = parseInt(param);
  if (!isNaN(id) && state.wazaData.some((w) => w.id === id)) return id;
  const decoded = decodeURIComponent(param);
  const match = state.wazaData.find((w) => w.name_jp && w.name_jp.trim() === decoded);
  return match ? match.id : null;
}

// ── Boot ──────────────────────────────────────────────────────
// All modules above have finished evaluating, so it is now safe to wire DOM
// events and run cross-module logic. Order among the initX() calls is not
// significant (each registers listeners on its own elements); auth is wired
// before the possible initApp() so the login screen is usable on a cold start.

/**
 * @brief Initializes all modules and starts the application.
 *
 * Order of initialization:
 * 1. Browse list event handlers
 * 2. Waza detail panel handlers
 * 3. UI shell components (search, filters, mobile menu)
 * 4. Share/import modal handlers
 * 5. Groups browse list handlers
 * 6. Create group modal handlers
 * 7. Edit group modal handlers
 * 8. New waza submission modal
 * 9. Suggest edit modal
 * 10. Field edit modal (video suggest, field-specific edits)
 * 11. Onboarding tour
 * 12. Authentication UI
 * 13. Theme system
 * 14. If token exists, initialize main app
 */
initBrowseState();
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
