/**
 * @file shell.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Core UI shell module. Manages search placeholder rotation, marking filter UI sync, mobile menu, filter sheet, and navigation tabs.
 */

import { state } from '../state/state.js';
import { renderDashStats } from '../views/stats.js';
import { renderDashCompare } from '../views/compare.js';
import { renderAccount } from '../views/account.js';
import { renderContribute } from '../views/contribute.js';
import { renderList, setBrowseView, setBrowseSort } from '../views/browse-list.js';
import { doLogout } from '../services/auth.js';
import { openNewWazaModal } from '../modals/new-waza.js';

// ── Rotating search placeholder ───────────────────────────────

const PLACEHOLDER_DEFAULT = 'Search Waza by name (JP / EN)…';

/**
 * @brief Starts rotating search input placeholder with random waza names.
 *
 * Cycles between showing a random waza name (JP or EN) for 4 seconds,
 * then the default prompt for 2.5 seconds. Pool rebuilds when wazaData changes.
 *
 * @return {void}
 */
export function startWazaPlaceholderRotation() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  if (input._phTimer) clearTimeout(input._phTimer); // cancel any prior chain

  // Build a flat pool of name strings from name_jp and name_en only
  function buildPool() {
    const pool = [];
    state.wazaData.forEach((w) => {
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
    let candidates = pool.filter((n) => n !== lastPicked);
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

  // Rebuild pool if state.wazaData ever grows (contributions approved etc.)
  input._rebuildPool = () => {
    pool = buildPool();
  };
}

// ── Marking filter UI sync ────────────────────────────────────

/**
 * @brief Updates UI for marking filters across desktop and mobile.
 *
 * Toggles active classes on filter buttons and shows/hides the filter dot indicator.
 *
 * @return {void}
 */
export function updateMarkingFilterUI() {
  // Desktop
  document
    .getElementById('filterMarkingAll')
    .classList.toggle('active', !state.browseFilterAny && state.filters.markings.every(Boolean));
  document.getElementById('filterMarkingAny').classList.toggle('active', state.browseFilterAny);
  document.querySelectorAll('.marking-filter-btn').forEach((btn) => {
    btn.classList.toggle(
      'active',
      !state.browseFilterAny && state.filters.markings[+btn.dataset.si],
    );
  });
  // Mobile sheet mirrors
  document
    .getElementById('filterMarkingAllMob')
    .classList.toggle('active', !state.browseFilterAny && state.filters.markings.every(Boolean));
  document.getElementById('filterMarkingAnyMob').classList.toggle('active', state.browseFilterAny);
  document.querySelectorAll('.marking-filter-btn-mob').forEach((btn) => {
    btn.classList.toggle(
      'active',
      !state.browseFilterAny && state.filters.markings[+btn.dataset.si],
    );
  });
  // Filter dot: visible when any non-default filter is active
  const hasFilter =
    state.browseFilterAny ||
    state.filters.markings.some(Boolean) ||
    state.browseSortField !== 'default' ||
    state.browseSortOrder !== 'asc';
  document.getElementById('filterDot').classList.toggle('visible', hasFilter);
}

// ── Mobile ⋮ menu (element refs + helpers) ────────────────────

const mobMenuBtn = document.getElementById('mobMenuBtn');
const mobMenuOverlay = document.getElementById('mobMenuOverlay');
const mobMenuSlideover = document.getElementById('mobMenuSlideover');
const mobMenuClose = document.getElementById('mobMenuClose');

/**
 * @brief Opens the mobile menu slideover.
 *
 * Adds 'open' class to overlay and slideover elements, then updates the active menu item state.
 *
 * @return {void}
 */
const openMobMenu = () => {
  mobMenuOverlay.classList.add('open');
  mobMenuSlideover.classList.add('open');
  // Update active state for current tab
  updateMobMenuActiveState();
};

/**
 * @brief Closes the mobile menu slideover.
 *
 * @return {void}
 */
export const closeMobMenu = () => {
  mobMenuOverlay.classList.remove('open');
  mobMenuSlideover.classList.remove('open');
};

const updateMobMenuActiveState = () => {
  const currentTab = document.querySelector('.ntab.active')?.dataset.tab;
  document.querySelectorAll('.mob-menu-item[data-menu-tab]').forEach((item) => {
    item.classList.toggle('active', item.dataset.menuTab === currentTab);
  });
};

// ── Mobile filter sheet (element refs) ────────────────────────

const filterSheetBg = document.getElementById('filterSheetBg');
const filterSheet = document.getElementById('filterSheet');

// ── Wiring ────────────────────────────────────────────────────

/**
 * @brief Initializes all UI event listeners and interactive components.
 *
 * Sets up search input, filter buttons, sort controls, mobile menu,
 * mobile filter sheet, and navigation tab switching. Called once from main.js.
 *
 * @return {void}
 */
export function initUi() {
  // ── Filter events ───────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchWrap = searchInput.closest('.search-wrap');

  // Show/hide clear button based on input value
  searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    searchWrap.classList.toggle('has-value', !!e.target.value);
    renderList();
  });

  // Clear button resets input and search state
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.search = '';
    searchWrap.classList.remove('has-value');
    searchInput.focus();
    renderList();
  });

  document.getElementById('filterMarkingAll').addEventListener('click', () => {
    state.browseFilterAny = false;
    const anyOn = state.filters.markings.some(Boolean);
    // If any on → turn all off; if all off → turn all on
    state.filters.markings = Array(6).fill(!anyOn);
    updateMarkingFilterUI();
    renderList();
  });

  document.getElementById('filterMarkingAny').addEventListener('click', () => {
    state.browseFilterAny = !state.browseFilterAny;
    if (state.browseFilterAny) state.filters.markings = Array(6).fill(false); // clear specific state.filters when entering Any mode
    updateMarkingFilterUI();
    renderList();
  });

  document.querySelectorAll('.marking-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.browseFilterAny = false; // specific marking filter exits Any mode
      const i = +btn.dataset.si;
      state.filters.markings = state.filters.markings.map((v, idx) => (idx === i ? !v : v));
      updateMarkingFilterUI();
      renderList();
    });
  });

  document.getElementById('browseSortField').addEventListener('change', (e) => {
    state.browseSortField = e.target.value;
    const isDefault = state.browseSortField === 'default';
    document.getElementById('browseSortOrder').disabled = isDefault;
    document.getElementById('browseSortOrderMob').disabled = isDefault;
    // Save to localStorage
    localStorage.setItem(
      'wl_sort_prefs',
      JSON.stringify({ field: state.browseSortField, order: state.browseSortOrder }),
    );
    updateMarkingFilterUI();
    renderList();
  });

  document.getElementById('browseSortOrder').addEventListener('change', (e) => {
    state.browseSortOrder = e.target.value;
    document.getElementById('browseSortOrderMob').value = e.target.value;
    // Save to localStorage
    localStorage.setItem(
      'wl_sort_prefs',
      JSON.stringify({ field: state.browseSortField, order: state.browseSortOrder }),
    );
    updateMarkingFilterUI();
    renderList();
  });

  // ── Mobile ⋮ menu ───────────────────────────────────────────
  mobMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMobMenu();
  });

  mobMenuOverlay.addEventListener('click', closeMobMenu);
  mobMenuClose.addEventListener('click', closeMobMenu);

  // Navigation items in slideover
  document.querySelectorAll('.mob-menu-item[data-menu-tab]').forEach((item) => {
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

  // ── Mobile filter sheet ─────────────────────────────────────
  document.getElementById('filterSheetBtn').addEventListener('click', () => {
    filterSheetBg.classList.add('open');
  });
  filterSheetBg.addEventListener('click', (e) => {
    if (!filterSheet.contains(e.target)) filterSheetBg.classList.remove('open');
  });

  // Mobile marking buttons — stage only, applied on Confirm
  document.getElementById('filterMarkingAllMob').addEventListener('click', () => {
    state.browseFilterAny = false;
    const anyOn = state.filters.markings.some(Boolean);
    state.filters.markings = Array(6).fill(!anyOn);
    updateMarkingFilterUI();
  });
  document.getElementById('filterMarkingAnyMob').addEventListener('click', () => {
    state.browseFilterAny = !state.browseFilterAny;
    if (state.browseFilterAny) state.filters.markings = Array(6).fill(false);
    updateMarkingFilterUI();
  });
  document.querySelectorAll('.marking-filter-btn-mob').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.browseFilterAny = false;
      const i = +btn.dataset.si;
      state.filters.markings = state.filters.markings.map((v, idx) => (idx === i ? !v : v));
      updateMarkingFilterUI();
    });
  });
  document.getElementById('browseSortFieldMob').addEventListener('change', (e) => {
    const isDefault = e.target.value === 'default';
    document.getElementById('browseSortOrderMob').disabled = isDefault;
  });
  document.getElementById('browseSortOrderMob').addEventListener('change', () => {});
  document.getElementById('browseViewSelectMob').addEventListener('change', () => {});

  document.getElementById('filterSheetConfirm').addEventListener('click', () => {
    // Read staged values from mob selects
    const newSortField = document.getElementById('browseSortFieldMob').value;
    const newSortOrder = document.getElementById('browseSortOrderMob').value;
    const newView = document.getElementById('browseViewSelectMob').value;

    filterSheetBg.classList.remove('open');
    setBrowseSort({ field: newSortField, order: newSortOrder });
    setBrowseView(newView); // applies state + persists + syncs all selects + renders once
  });

  // ── Nav tabs ────────────────────────────────────────────────
  document.querySelectorAll('.ntab').forEach((tab) =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ntab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.tab;
      document.getElementById('browseView').style.display = t === 'browse' ? 'flex' : 'none';
      document.getElementById('statsView').style.display = t === 'stats' ? 'block' : 'none';
      document.getElementById('compareView').style.display = t === 'compare' ? 'block' : 'none';
      document.getElementById('contributeView').style.display =
        t === 'contribute' ? 'block' : 'none';
      document.getElementById('accountView').style.display = t === 'account' ? 'block' : 'none';
      if (t === 'stats') renderDashStats();
      if (t === 'compare') renderDashCompare();
      if (t === 'contribute') renderContribute();
      if (t === 'account') renderAccount();
      // Update mobile menu active state
      updateMobMenuActiveState();
    }),
  );
}

// ── Navigation helper ─────────────────────────────────────────

/**
 * @brief Programmatically navigates to the browse tab.
 *
 * Activates the browse tab UI and hides all other views.
 *
 * @return {void}
 */
export function navigateToBrowse() {
  document.querySelectorAll('.ntab').forEach((t) => t.classList.remove('active'));
  document.querySelector('[data-tab="browse"]').classList.add('active');
  document.getElementById('browseView').style.display = 'flex';
  document.getElementById('statsView').style.display = 'none';
  document.getElementById('compareView').style.display = 'none';
  document.getElementById('accountView').style.display = 'none';
  document.getElementById('contributeView').style.display = 'none';
}
