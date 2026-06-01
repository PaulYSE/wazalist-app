/* main.js — BOOT / wiring. URL auto-import hook, Guide buttons, popstate.
   Loaded after every other app file but before onboarding.js. */
    // ── URL auto-import (fires after initApp loads wazaData) ──────
    const _origInitApp = initApp;
    // Monkey-patch: after wazaData loads, check for auto-import key
    const _checkAutoImport = () => {
      if (window._autoImportKey) {
        const k = window._autoImportKey;
        window._autoImportKey = null;
        // Need to wait for app to be ready, then open import modal
        setTimeout(() => openImportModal(k), 400);
      }
    };

    // ── Modal ─────────────────────────────────────────────────────
    // Guide button triggers onboarding
    document.getElementById('helpBtn').addEventListener('click', () => { 
      if (typeof showWazaOnboarding === 'function') showWazaOnboarding(); 
    });
    document.getElementById('mobHelpBtn').addEventListener('click', () => { 
      closeMobMenu(); 
      if (typeof showWazaOnboarding === 'function') showWazaOnboarding(); 
    });

    // ── Popstate ─────────────────────────────────────── 
    window.addEventListener('popstate', e => {
      // When user presses back button, check if we should close the detail panel
      // e.state will be null when going back to the initial page state
      // or won't have wazaOpen when going back from the detail view
      if (selectedId !== null && (!e.state || !e.state.wazaOpen)) {
        // User pressed back while detail panel is open - close it
        document.querySelectorAll('.embed-wrap.open iframe').forEach(f => { f.src = ''; });
        selectedId = null;
        renderList(); renderDetail();
        document.querySelector('.main').classList.remove('waza-selected');
      }
    });
