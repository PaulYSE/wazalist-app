/* main.js — BOOT / wiring. URL auto-import hook, Guide buttons, popstate.
Loaded after every other app file but before onboarding.js. */
import { showOnboarding } from './onboarding.js';
import { state } from './state.js';

// ── URL auto-import (fires after initApp loads wazaData) ──────
import { initApp } from './core.js';
const _origInitApp = initApp;

// ── Modal ─────────────────────────────────────────────────────
// Guide button triggers onboarding
document.getElementById('helpBtn').addEventListener('click', () => {
  showOnboarding();
});
document.getElementById('mobHelpBtn').addEventListener('click', () => {
  closeMobMenu();
  showOnboarding();
});

// ── Popstate ─────────────────────────────────────── 
window.addEventListener('popstate', e => {
  // When user presses back button, check if we should close the detail panel
  // e.state will be null when going back to the initial page state
  // or won't have wazaOpen when going back from the detail view
  if (state.selectedId !== null && (!e.state || !e.state.wazaOpen)) {
    // User pressed back while detail panel is open - close it
    document.querySelectorAll('.embed-wrap.open iframe').forEach(f => { f.src = ''; });
    state.selectedId = null;
    renderList(); renderDetail();
    document.querySelector('.main').classList.remove('waza-selected');
  }
});
