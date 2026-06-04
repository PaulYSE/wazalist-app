/* main.js */

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
document.getElementById('helpBtn').addEventListener('click', () => {
  showOnboarding();
});
document.getElementById('mobHelpBtn').addEventListener('click', () => {
  closeMobMenu();
  showOnboarding();
});

// ── Popstate — back button closes the detail panel ────────────
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
initBrowseList();
initWazaDetail();
initUi();
initShare();
initNewWaza();
initSuggestEdit();
initOnboarding();
initAuth();

if (state.token) initApp();
