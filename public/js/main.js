/**
 * @file main.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Application entry point. Initializes all modules, sets up event listeners, and boots the app based on authentication state.
 */

import { state } from './state/state.js';
import { initApp } from './app/init.js';
import { initAuth } from './services/auth.js';
import { initBrowseList, renderList } from './views/browse-list.js';
import { initWazaDetail, renderDetail } from './views/waza-detail.js';
import { initUi, closeMobMenu } from './app/shell.js';
import { initShare } from './features/share-list.js';
import { initNewWaza } from './modals/new-waza.js';
import { initSuggestEdit } from './modals/suggest-edit.js';
import { initOnboarding, showOnboarding } from './features/onboarding.js';

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
 * @brief Handles browser back/forward navigation to close detail panel when appropriate.
 */
window.addEventListener('popstate', (e) => {
  // e.state is null on the initial page state, or lacks wazaOpen when
  // returning from the detail view.
  if (state.selectedId !== null && (!e.state || !e.state.wazaOpen)) {
    document.querySelectorAll('.embed-wrap.open iframe').forEach((f) => {
      f.src = '';
    });
    state.selectedId = null;
    renderList();
    renderDetail();
    document.querySelector('.main').classList.remove('waza-selected');
  }
});

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
initOnboarding();
initAuth();

// If token exists (logged-in user), start the app immediately
if (state.token) initApp();
