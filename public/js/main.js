/* main.js — BOOT / wiring entry point. Loaded last; nothing imports this file.
   Every other module now only declares and exports — none wires DOM events on
   import. main.js owns the boot order: wire each module's event listeners via
   its initX(), wire the auth screen, then load the app if a session exists. */

import { state } from './state/state.js';
import { initAuth, initApp } from './core.js';
import { initRender, renderList, renderDetail } from './render.js';
import { initUi, closeMobMenu } from './ui.js';
import { initShare } from './share.js';
import { initContributeModals } from './contribute-modals.js';
import { initOnboarding, showOnboarding } from './onboarding.js';

// ── Guide buttons ─────────────────────────────────────────────
document.getElementById('helpBtn').addEventListener('click', () => {
  showOnboarding();
});
document.getElementById('mobHelpBtn').addEventListener('click', () => {
  closeMobMenu();
  showOnboarding();
});

// ── Popstate — back button closes the detail panel ────────────
window.addEventListener('popstate', e => {
  // e.state is null on the initial page state, or lacks wazaOpen when
  // returning from the detail view.
  if (state.selectedId !== null && (!e.state || !e.state.wazaOpen)) {
    document.querySelectorAll('.embed-wrap.open iframe').forEach(f => { f.src = ''; });
    state.selectedId = null;
    renderList(); renderDetail();
    document.querySelector('.main').classList.remove('waza-selected');
  }
});

// ── Boot ──────────────────────────────────────────────────────
// All modules above have finished evaluating, so it is now safe to wire DOM
// events and run cross-module logic. Order among the initX() calls is not
// significant (each registers listeners on its own elements); auth is wired
// before the possible initApp() so the login screen is usable on a cold start.
initRender();
initUi();
initShare();
initContributeModals();
initOnboarding();
initAuth();

if (state.token) initApp();