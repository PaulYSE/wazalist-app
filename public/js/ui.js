/* ui.js — UI chrome: rotating placeholders, marking-filter UI, the mobile
   slide-over menu, the mobile filter sheet, and the escHtml() helper. */
    // ── Rotating search placeholder ───────────────────────────────
    const PLACEHOLDER_DEFAULT = 'Search Waza by name (JP / EN)…';

    function startWazaPlaceholderRotation() {
      const input = document.getElementById('searchInput');
      if (!input) return;

      // Build a flat pool of name strings from name_jp and name_en only
      function buildPool() {
        const pool = [];
        wazaData.forEach(w => {
          if (w.name_jp && w.name_jp.trim()) pool.push(w.name_jp.trim());
          if (w.name_en && w.name_en.trim()) pool.push(w.name_en.trim());
        });
        return pool;
      }

      let pool = buildPool();
      let lastPicked = '';

      function pickRandom() {
        if (!pool.length) return PLACEHOLDER_DEFAULT;
        // Avoid repeating the same name twice in a row
        let candidates = pool.filter(n => n !== lastPicked);
        if (!candidates.length) candidates = pool;
        const name = candidates[Math.floor(Math.random() * candidates.length)];
        lastPicked = name;
        return name;
      }

      function setPlaceholder(text) {
        // Fade out, swap, fade in — only when input is empty and unfocused
        if (input.value || document.activeElement === input) {
          input.placeholder = text;
          return;
        }
        input.classList.add('ph-fade');
        setTimeout(() => {
          input.placeholder = text;
          input.classList.remove('ph-fade');
        }, 150);
      }

      // Cycle: show a waza name for a beat, then return to default, repeat
      let phase = 0; // 0 = show default, 1 = show waza name
      const WAZA_DISPLAY_MS = 4000;
      const DEFAULT_DISPLAY_MS = 2500;

      function tick() {
        if (phase === 0) {
          setPlaceholder(pickRandom());
          phase = 1;
          input._phTimer = setTimeout(tick, WAZA_DISPLAY_MS);
        } else {
          setPlaceholder(PLACEHOLDER_DEFAULT);
          phase = 0;
          input._phTimer = setTimeout(tick, DEFAULT_DISPLAY_MS);
        }
      }

      // Don't start immediately — give a longer pause after load
      input._phTimer = setTimeout(tick, 5000);

      // Rebuild pool if wazaData ever grows (contributions approved etc.)
      input._rebuildPool = () => { pool = buildPool(); };
    }

    // ── Filter events ─────────────────────────────────────────────
    document.getElementById('searchInput').addEventListener('input', e => { filters.search = e.target.value; renderList(); });

    function updateMarkingFilterUI() {
      // Desktop
      document.getElementById('filterMarkingAll').classList.toggle('active', !browseFilterAny && filters.markings.every(Boolean));
      document.getElementById('filterMarkingAny').classList.toggle('active', browseFilterAny);
      document.querySelectorAll('.marking-filter-btn').forEach(btn => {
        btn.classList.toggle('active', !browseFilterAny && filters.markings[+btn.dataset.si]);
      });
      // Mobile sheet mirrors
      document.getElementById('filterMarkingAllMob').classList.toggle('active', !browseFilterAny && filters.markings.every(Boolean));
      document.getElementById('filterMarkingAnyMob').classList.toggle('active', browseFilterAny);
      document.querySelectorAll('.marking-filter-btn-mob').forEach(btn => {
        btn.classList.toggle('active', !browseFilterAny && filters.markings[+btn.dataset.si]);
      });
      // Filter dot: visible when any non-default filter is active
      const hasFilter = browseFilterAny || filters.markings.some(Boolean) || browseSortField !== 'default' || browseSortOrder !== 'asc';
      document.getElementById('filterDot').classList.toggle('visible', hasFilter);
    }

    document.getElementById('filterMarkingAll').addEventListener('click', () => {
      browseFilterAny = false;
      const anyOn = filters.markings.some(Boolean);
      filters.markings = Array(6).fill(!anyOn); // if any on → turn all off; if all off → turn all on
      updateMarkingFilterUI(); renderList();
    });

    document.getElementById('filterMarkingAny').addEventListener('click', () => {
      browseFilterAny = !browseFilterAny;
      if (browseFilterAny) filters.markings = Array(6).fill(false); // clear specific filters when entering Any mode
      updateMarkingFilterUI(); renderList();
    });

    document.querySelectorAll('.marking-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        browseFilterAny = false; // specific marking filter exits Any mode
        const i = +btn.dataset.si;
        filters.markings = filters.markings.map((v, idx) => idx === i ? !v : v);
        updateMarkingFilterUI(); renderList();
      });
    });

    document.getElementById('browseSortField').addEventListener('change', e => {
      browseSortField = e.target.value;
      const isDefault = browseSortField === 'default';
      document.getElementById('browseSortOrder').disabled = isDefault;
      document.getElementById('browseSortOrderMob').disabled = isDefault;
      // Save to localStorage
      localStorage.setItem('wl_sort_prefs', JSON.stringify({ field: browseSortField, order: browseSortOrder }));
      updateMarkingFilterUI(); renderList();
    });

    document.getElementById('browseSortOrder').addEventListener('change', e => {
      browseSortOrder = e.target.value;
      document.getElementById('browseSortOrderMob').value = e.target.value;
      // Save to localStorage
      localStorage.setItem('wl_sort_prefs', JSON.stringify({ field: browseSortField, order: browseSortOrder }));
      updateMarkingFilterUI(); renderList();
    });

    // ── Mobile ⋮ menu ─────────────────────────────────────────────
    const mobMenuBtn = document.getElementById('mobMenuBtn');
    const mobMenuOverlay = document.getElementById('mobMenuOverlay');
    const mobMenuSlideover = document.getElementById('mobMenuSlideover');
    const mobMenuClose = document.getElementById('mobMenuClose');
    
    const openMobMenu = () => {
      mobMenuOverlay.classList.add('open');
      mobMenuSlideover.classList.add('open');
      // Update active state for current tab
      updateMobMenuActiveState();
    };
    
    const closeMobMenu = () => {
      mobMenuOverlay.classList.remove('open');
      mobMenuSlideover.classList.remove('open');
    };
    
    const updateMobMenuActiveState = () => {
      const currentTab = document.querySelector('.ntab.active')?.dataset.tab;
      document.querySelectorAll('.mob-menu-item[data-menu-tab]').forEach(item => {
        item.classList.toggle('active', item.dataset.menuTab === currentTab);
      });
    };
    
    mobMenuBtn.addEventListener('click', e => {
      e.stopPropagation();
      openMobMenu();
    });
    
    mobMenuOverlay.addEventListener('click', closeMobMenu);
    mobMenuClose.addEventListener('click', closeMobMenu);
    
    // Navigation items in slideover
    document.querySelectorAll('.mob-menu-item[data-menu-tab]').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.menuTab;
        document.querySelector(`.ntab[data-tab="${tab}"]`)?.click();
        closeMobMenu();
      });
    });

    document.getElementById('mobLogoutBtn').onclick = () => {
      closeMobMenu();
      doLogout();
    };
    
    document.getElementById('mobNewWazaBtn').onclick = () => {
      closeMobMenu();
      openNewWazaModal();
    };

    // ── Mobile filter sheet ───────────────────────────────────────
    const filterSheetBg = document.getElementById('filterSheetBg');
    const filterSheet = document.getElementById('filterSheet');

    document.getElementById('filterSheetBtn').addEventListener('click', () => {
      filterSheetBg.classList.add('open');
    });
    filterSheetBg.addEventListener('click', e => {
      if (!filterSheet.contains(e.target)) filterSheetBg.classList.remove('open');
    });

    // Mobile marking buttons — stage only, applied on Confirm
    document.getElementById('filterMarkingAllMob').addEventListener('click', () => {
      browseFilterAny = false;
      const anyOn = filters.markings.some(Boolean);
      filters.markings = Array(6).fill(!anyOn);
      updateMarkingFilterUI();
    });
    document.getElementById('filterMarkingAnyMob').addEventListener('click', () => {
      browseFilterAny = !browseFilterAny;
      if (browseFilterAny) filters.markings = Array(6).fill(false);
      updateMarkingFilterUI();
    });
    document.querySelectorAll('.marking-filter-btn-mob').forEach(btn => {
      btn.addEventListener('click', () => {
        browseFilterAny = false;
        const i = +btn.dataset.si;
        filters.markings = filters.markings.map((v, idx) => idx === i ? !v : v);
        updateMarkingFilterUI();
      });
    });
    document.getElementById('browseSortFieldMob').addEventListener('change', e => {
      const isDefault = e.target.value === 'default';
      document.getElementById('browseSortOrderMob').disabled = isDefault;
    });
    document.getElementById('browseSortOrderMob').addEventListener('change', () => { });
    document.getElementById('browseViewSelectMob').addEventListener('change', () => { });

    document.getElementById('filterSheetConfirm').addEventListener('click', () => {
      // Read staged values from mob selects
      const newSortField = document.getElementById('browseSortFieldMob').value;
      const newSortOrder = document.getElementById('browseSortOrderMob').value;
      const newView = document.getElementById('browseViewSelectMob').value;
      // Apply to state + sync desktop controls
      browseSortField = newSortField;
      browseSortOrder = newSortOrder;
      browseListView = newView;
      document.getElementById('browseSortField').value = newSortField;
      const isDefault = newSortField === 'default';
      document.getElementById('browseSortOrder').disabled = isDefault;
      document.getElementById('browseSortOrder').value = newSortOrder;
      document.getElementById('browseViewSelect').value = newView;
      // Save to localStorage
      localStorage.setItem('wl_sort_prefs', JSON.stringify({ field: browseSortField, order: browseSortOrder }));
      localStorage.setItem('wl_view_style', browseListView);
      // Close sheet and re-render
      filterSheetBg.classList.remove('open');
      updateMarkingFilterUI();
      renderList();
    });

    // ── Nav tabs ──────────────────────────────────────────────────
    document.querySelectorAll('.ntab').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
      const t = tab.dataset.tab;
      document.getElementById('browseView').style.display = t === 'browse' ? 'flex' : 'none';
      document.getElementById('statsView').style.display = t === 'stats' ? 'block' : 'none';
      document.getElementById('compareView').style.display = t === 'compare' ? 'block' : 'none';
      document.getElementById('contributeView').style.display = t === 'contribute' ? 'block' : 'none';
      document.getElementById('accountView').style.display = t === 'account' ? 'block' : 'none';
      if (t === 'stats') renderDashStats();
      if (t === 'compare') renderDashCompare();
      if (t === 'contribute') renderContribute();
      if (t === 'account') renderAccount();
      // Update mobile menu active state
      if (typeof updateMobMenuActiveState !== 'undefined') updateMobMenuActiveState();
    }));

    function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    // ── Suggest Edit modal ────────────────────────────────────────
