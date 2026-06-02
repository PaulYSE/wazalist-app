/* app-core.js — the lifecycle: api() fetch wrapper, guest/login, initApp(),
   and progress saving (saveP/saveLabels). This is where the app boots its data. */
    const api = async (path, method = 'GET', body = null) => {
      const opts = { method, headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) } };
      if (body) opts.body = JSON.stringify(body);
      return (await fetch(path, opts)).json();
    };

    // ── Auth ─────────────────────────────────────────────────────
    document.getElementById('toReg').onclick = () => { document.getElementById('loginBox').style.display = 'none'; document.getElementById('regBox').style.display = ''; };
    document.getElementById('toLi').onclick = () => { document.getElementById('regBox').style.display = 'none'; document.getElementById('loginBox').style.display = ''; };

    function startGuest() { isGuest = true; token = ''; Object.entries(loadLocal()).forEach(([id, p]) => { prog[+id] = p; }); initApp(); }
    document.getElementById('guestBtn').onclick = startGuest;
    document.getElementById('guestBtn2').onclick = startGuest;

    document.getElementById('li-btn').onclick = async () => {
      const username = document.getElementById('li-username').value.trim(), password = document.getElementById('li-password').value;
      const e = document.getElementById('li-err'); e.textContent = '';
      if (!username || !password) { e.textContent = 'Please fill in both fields.'; return; }
      const res = await api('/api/login', 'POST', { username, password });
      if (res.error) { e.textContent = res.error; return; }
      token = res.token; localStorage.setItem('wl_token', token);
      currentUsername = res.user.username; localStorage.setItem('wl_username', currentUsername);
      isAdmin = !!res.user.is_admin;
      initApp();
    };

    document.getElementById('rg-btn').onclick = async () => {
      const username = document.getElementById('rg-username').value.trim(), email = document.getElementById('rg-email').value.trim(), password = document.getElementById('rg-password').value;
      const e = document.getElementById('rg-err'); e.className = 'aerr'; e.textContent = '';
      if (!username || !password) { e.textContent = 'Username and password are required.'; return; }
      const res = await api('/api/register', 'POST', { username, email: email || undefined, password });
      if (res.error) { e.textContent = res.error; return; }
      e.className = 'aok'; e.textContent = 'Account created! Signing you in…';
      const li = await api('/api/login', 'POST', { username, password });
      if (li.token) { token = li.token; localStorage.setItem('wl_token', token); currentUsername = li.user.username; localStorage.setItem('wl_username', currentUsername); initApp(); window.showWazaOnboarding?.(); }
    };

    const doLogout = () => { token = ''; isGuest = false; currentUsername = ''; localStorage.removeItem('wl_token'); localStorage.removeItem('wl_username'); location.reload(); };
    document.getElementById('logoutBtn').onclick = doLogout;

    // ── Init ─────────────────────────────────────────────────────
    async function initApp() {
      // Stop username placeholder rotation if it's running
      if (typeof stopUsernamePlaceholderRotation === 'function') {
        stopUsernamePlaceholderRotation();
      }
      document.getElementById('authWrap').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      document.getElementById('guestBadge').style.display = isGuest ? '' : 'none';
      document.getElementById('logoutBtn').textContent = isGuest ? 'Sign in' : 'Sign out';
      const mobLogoutBtn = document.getElementById('mobLogoutBtn');
      mobLogoutBtn.innerHTML = isGuest 
        ? '<span class="mob-menu-item-icon">←</span><span>Sign in</span>'
        : '<span class="mob-menu-item-icon">→</span><span>Sign out</span>';
      const ub = document.getElementById('usernameBadge');
      if (!isGuest && currentUsername) { ub.textContent = '@' + currentUsername; ub.style.display = ''; } else { ub.style.display = 'none'; }
      document.getElementById('adminLink').style.display = 'none';
      document.getElementById('mobAdminLink').style.display = 'none';
      document.getElementById('newWazaBtn').style.display = 'none';
      document.getElementById('mobNewWazaBtn').style.display = 'none';
      document.getElementById('countBar').textContent = 'Loading Waza…';
      const wazaRes = await api('/api/waza');
      wazaData = Array.isArray(wazaRes) ? wazaRes : [];
      if (!isGuest) {
        try {
          const progRes = await api('/api/progress');
          if (Array.isArray(progRes)) progRes.forEach(p => {
            let markings = Array(6).fill(false);
            try { if (p.markings) markings = JSON.parse(p.markings); } catch { }
            prog[p.waza_id] = { markings, like: p.like || null, updated_at: p.updated_at || null };
          });
        } catch (err) { console.warn('Progress load error:', err); }

        // Load marking labels from server for logged-in users
        try {
          const labelsRes = await api('/api/labels');
          if (labelsRes && Array.isArray(labelsRes.labels)) {
            markingLabels = labelsRes.labels;
            // Also update localStorage for offline access
            localStorage.setItem(LS_LABELS, JSON.stringify(markingLabels));
          }
        } catch (err) { console.warn('Labels load error:', err); }
      }
      renderList(); renderStats();
      
      // Sync sort dropdowns with loaded preferences
      document.getElementById('browseSortField').value = browseSortField;
      document.getElementById('browseSortFieldMob').value = browseSortField;
      document.getElementById('browseSortOrder').value = browseSortOrder;
      document.getElementById('browseSortOrderMob').value = browseSortOrder;
      const isDefault = browseSortField === 'default';
      document.getElementById('browseSortOrder').disabled = isDefault;
      document.getElementById('browseSortOrderMob').disabled = isDefault;
      
      // Sync view style dropdowns with loaded preference
      document.getElementById('browseViewSelect').value = browseListView;
      document.getElementById('browseViewSelectMob').value = browseListView;
      // Sync mobile view style dropdown
      const mobileViewSelect = document.getElementById('viewStyleSelectMobile');
      if (mobileViewSelect) mobileViewSelect.value = browseListView;
      
      // Check for ?waza= in URL (from shared links or back navigation)
      const wazaParam = new URL(location.href).searchParams.get('waza');
      if (wazaParam) {
        // Parse as numeric ID (primary format)
        const id = parseInt(wazaParam);
        if (!isNaN(id) && wazaData.some(w => w.id === id)) {
          selectWaza(id);
        } else {
          // Backward compatibility: try matching by Japanese name slug
          const decodedSlug = decodeURIComponent(wazaParam);
          const match = wazaData.find(w => w.name_jp && w.name_jp.trim() === decodedSlug);
          if (match) {
            selectWaza(match.id);
          }
        }
      }
      startWazaPlaceholderRotation();
      _checkAutoImport();
    }
    if (token) initApp();

    // ── Progress helpers ─────────────────────────────────────────
    var emptyP = function() { return { shapes: Array(6).fill(false), like: null }; };
    var getP = function(id) { return prog[id] || emptyP(); };
    
    // ── Labels helpers ───────────────────────────────────────────
    async function saveLabels() {
      // Always save to localStorage (for guest mode and offline access)
      localStorage.setItem(LS_LABELS, JSON.stringify(markingLabels));
      
      // For logged-in users, also save to server
      if (!isGuest && token) {
        try {
          await api('/api/labels', 'POST', { labels: markingLabels });
        } catch (err) {
          console.warn('Failed to save labels to server:', err);
        }
      }
    }
    
    // Make saveLabels accessible to onboarding script
    window.saveLabels = saveLabels;

    async function saveP(id, patch) {
      prog[id] = { ...getP(id), ...patch, updated_at: new Date().toISOString() };
      if (isGuest) { const l = loadLocal(); l[id] = prog[id]; saveLocal(l); renderList(); renderDetail(); renderStats(); }
      else {
        savingIds.add(id);
        renderDetail(); // show spinning state immediately
        try {
          const res = await api('/api/progress', 'POST', { waza_id: id, markings: JSON.stringify(prog[id].markings), like: prog[id].like });
          if (res.error) { console.warn('Progress save failed:', res.error); }
          else if (res.like_count != null) {
            // Apply fresh aggregate counts back to wazaData so cards update immediately
            const w = wazaData.find(x => x.id === id);
            if (w) { w.like_count = res.like_count; w.dislike_count = res.dislike_count; }
          }
        } catch (err) { console.warn('Progress save error:', err); }
        savingIds.delete(id);
        renderList(); renderDetail(); renderStats();
        // Flash "Saved ✓" indicator
        const indicator = document.getElementById('saveIndicator');
        if (indicator) { indicator.style.opacity = '1'; clearTimeout(indicator._t); indicator._t = setTimeout(() => { indicator.style.opacity = '0'; }, 1400); }
      }
    }

    // ── Populate filter dropdowns (removed) ─────────────────────────────────

