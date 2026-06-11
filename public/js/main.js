/**
 * @file main.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-09
 * @brief Application entry point. Initializes all modules, sets up event listeners, and boots the app based on authentication state.
 */

import { state } from './state/state.js';
import { initApp } from './app/init.js';
import { initAuth } from './services/auth.js';
import { initBrowseList } from './views/browse-list.js';
import {
  initWazaDetail,
  selectWazaFromHistory,
  closeDetailPanelFromHistory,
} from './views/waza-detail.js';
import { initUi, closeMobMenu, activateTab } from './app/shell.js';
import { initShare } from './features/share-list.js';
import { initNewWaza } from './modals/new-waza.js';
import { initSuggestEdit, initFieldEdit } from './modals/suggest-edit.js';
import { initOnboarding, showOnboarding } from './features/onboarding.js';
import { parseRoute } from './app/router.js';

// ── Guide buttons ─────────────────────────────────────────────

/**
 * @brief Help button click handler that shows onboarding.
 */
document.getElementById('helpBtn').addEventListener('click', () => {
  showOnboarding();
});

/**
 * @brief Mobile help button click handler that closes mobile menu and shows onboarding.
 */
document.getElementById('mobHelpBtn').addEventListener('click', () => {
  closeMobMenu();
  showOnboarding();
});

// ── Popstate — back button closes the detail panel ────────────

/**
 * @brief Handles browser back/forward navigation to restore tab and waza detail state from URL.
 *
 * Parses the current URL for tab and waza parameters, reconciles the active tab
 * (without writing history), and opens/closes the detail panel as needed.
 */
window.addEventListener('popstate', () => {
  const { tab, wazaParam } = parseRoute();

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
 * 5. New waza submission modal
 * 6. Suggest edit modal
 * 7. Onboarding tour
 * 8. Authentication UI
 * 9. If token exists, initialize main app
 */
initBrowseList();
initWazaDetail();
initUi();
initShare();
initNewWaza();
initSuggestEdit();
initFieldEdit();
initOnboarding();
initAuth();

// If token exists (logged-in user), start the app immediately
if (state.token) initApp();
