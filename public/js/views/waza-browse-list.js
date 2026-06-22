/**
 * @file views/waza-browse-list.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-21
 * @brief Browse list view rendering and controls. Handles list/card/compact view modes, sorting, filtering, and selection.
 */

import {
  markingStyle,
  markingPips,
  cardLikePill,
  videoButtons,
} from '../components/render-helpers.js';
import { state } from '../state/state.js';
import { filterWaza, dispName } from '../lib/search.js';
import { getP } from '../services/progress.js';
import { selectWaza } from './waza-detail.js';
import { updateMarkingFilterUI, setSearchInput } from '../app/shell.js';
import { openNewWazaModal } from '../modals/waza-new.js';
import { isGuest, getToken } from '../state/user-state.js';
import {
  getBrowseListView,
  getBrowseSortField,
  getBrowseSortOrder,
  setBrowseListView,
  setBrowseSortState,
} from '../state/waza-browse-state.js';

// ── Browse sort ───────────────────────────────────────────────
// Single entry point for changing sort. Pass either field, order, or both;
// omitted values keep their current state. Persists, syncs all four selects
// (+ the order-disabled state), and re-renders once. Adding a new sort field
// later means only adding an <option> in the HTML — this stays untouched.

/**
 * @brief Changes the browse sort field and/or order.
 *
 * @param {Object} options - Sort options.
 * @param {string} [options.field] - Sort field ('default' or 'likes').
 * @param {string} [options.order] - Sort order ('asc' or 'desc').
 * @return {void}
 */
export function setBrowseSort({ field, order } = {}) {
  if (field !== undefined || order !== undefined) {
    setBrowseSortState({ field, order });
  }
  updateMarkingFilterUI();
  syncBrowseSortControls();
  renderList();
}

// Reflect current sort state into the desktop + mobile selects and the
// order-disabled state, without persisting or rendering. Used at boot and by
// setBrowseSort.

/**
 * @brief Syncs all sort control dropdowns with current state.
 *
 * @return {void}
 */
export function syncBrowseSortControls() {
  const sortField = getBrowseSortField();
  const sortOrder = getBrowseSortOrder();
  const isDefault = sortField === 'default';
  ['browseSortField', 'browseSortFieldMob'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = sortField;
  });
  ['browseSortOrder', 'browseSortOrderMob'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = sortOrder;
      el.disabled = isDefault;
    }
  });
}

// ── Browse view mode ──────────────────────────────────────────
// The single entry point for changing the list view style (expanded / list /
// compact). Every input — desktop dropdown, mobile dropdown, filter sheet —
// routes here, so state, persistence, all three <select>s, and the rendered
// list can never drift apart.

/**
 * @brief Changes the browse view mode (expanded/list/compact).
 *
 * @param {string} view - View mode: 'expanded', 'list', or 'compact'.
 * @return {void}
 */
export function setBrowseView(view) {
  setBrowseListView(view);
  syncBrowseViewControls();
  renderList();
}

// Reflect current state into the three view-style selects without re-rendering
// or persisting. Used at boot, and by setBrowseView to keep the controls synced.

/**
 * @brief Syncs all view mode dropdowns with current state.
 *
 * @return {void}
 */
export function syncBrowseViewControls() {
  const viewMode = getBrowseListView();
  ['browseViewSelect', 'browseViewSelectMob', 'viewStyleSelectMobile'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = viewMode;
  });
}

// Wire the controls that apply immediately (desktop + standalone mobile
// dropdown). The filter-sheet's staged select is applied on Confirm in shell.js.

/**
 * @brief Initializes browse list event listeners.
 *
 * @return {void}
 */
export function initBrowseList() {
  document.getElementById('browseViewSelect').addEventListener('change', (e) => {
    setBrowseView(e.target.value);
  });
  document.getElementById('viewStyleSelectMobile')?.addEventListener('change', (e) => {
    setBrowseView(e.target.value);
  });
  document.getElementById('browseSortField').addEventListener('change', (e) => {
    setBrowseSort({ field: e.target.value });
  });
  document.getElementById('browseSortOrder').addEventListener('change', (e) => {
    setBrowseSort({ order: e.target.value });
  });

  document.getElementById('wazaList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) selectWaza(+row.dataset.id);
  });
}

/**
 * @brief Updates a single browse-list row's marking tint + pips in place,
 *        without rebuilding the whole list. Used after a marking toggle when no
 *        marking-filter is active, so a 1312-row re-render isn't triggered for a
 *        one-row visual change.
 *
 * @param {number} id - Waza ID whose row should refresh.
 * @return {void}
 */
export function updateListRowMarkings(id) {
  const listEl = document.getElementById('wazaList');
  if (!listEl) return;
  const row = listEl.querySelector(`[data-id="${id}"]`);
  if (!row) return; // not currently in the list (filtered out / different state) — nothing to patch

  const w = state.wazaData.find((x) => x.id === id);
  if (!w) return;
  const p = getP(id);
  const markings = p.markings || Array(6).fill(false);

  // Re-tint: markingStyle() returns { cls, style } exactly as renderList builds each row.
  const ms = markingStyle(markings);
  row.classList.toggle('sh-active', ms.cls === 'sh-active');
  row.setAttribute('style', ms.style); // background + border-left-color, or '' when no markings

  // Refresh the pips. All three views contain a .markings-row with the pips.
  const pipsHost = row.querySelector('.markings-row');
  if (pipsHost) pipsHost.innerHTML = markingPips(markings);
}

/**
 * @brief Picks a random waza, drops its English name into the search box (which
 *        filters the list to it), and opens its detail panel.
 *
 * Picks from the actual loaded waza array rather than a random id in
 * [1, max(id)], because ids are non-contiguous — a random id could hit a gap.
 *
 * @return {void}
 */
export function surpriseMe() {
  if (!state.wazaData.length) return;
  const w = state.wazaData[Math.floor(Math.random() * state.wazaData.length)];

  // Put its English name in the search bar (filters the list to this waza).
  const name = (w.name_en || w.name_en_literal || w.name_jp || '').trim();
  setSearchInput(name); // single chokepoint: updates box + state + re-renders list
  renderList(); // apply the filter so the list narrows to this waza

  // Open its detail.
  selectWaza(w.id);
}

/**
 * @brief Renders the browse list based on current filter, sort, and view mode.
 *
 * @return {void}
 */
export function renderList() {
  const filtered = filterWaza();
  document.getElementById('countBar').textContent =
    filtered.length + ' of ' + state.wazaData.length + ' Waza';
  const list = document.getElementById('wazaList');
  if (!filtered.length) {
    const canAdd = !isGuest() && !!getToken();
    list.innerHTML =
      '<div style="padding:24px 20px;text-align:center;color:var(--text3)">' +
      '<div style="font-size:14px;color:var(--text2)">No Waza found</div>' +
      '<div style="margin-top:10px;font-size:13px">Can\'t find the Waza you\'re looking for?</div>' +
      (canAdd
        ? '<button class="btn" id="noResultAddBtn" style="margin-top:12px">+ Help us add it to the database!</button>'
        : '<div style="margin-top:6px;font-size:12px">Sign in to help add it to the database.</div>') +
      '</div>';
    if (canAdd) {
      const addBtn = document.getElementById('noResultAddBtn');
      if (addBtn) addBtn.addEventListener('click', () => openNewWazaModal());
    }
    return;
  }

  const viewMode = getBrowseListView();
  if (viewMode === 'expanded') {
    list.innerHTML = filtered
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const pill = cardLikePill(w, p);
        const bottomRow =
          '<div class="card-bottom-row">' +
          '<div class="markings-row wce-markings">' +
          markingPips(markings) +
          '</div>' +
          pill +
          '</div>';
        const _ms1 = markingStyle(markings);
        return (
          '<div class="waza-card ' +
          _ms1.cls +
          (state.selectedId === w.id ? ' selected' : '') +
          '" data-id="' +
          w.id +
          '" style="' +
          _ms1.style +
          '">' +
          '<div class="wce-header">' +
          '<div class="njp">' +
          (w.name_jp || '—') +
          '</div>' +
          '<div class="nen">' +
          dispName(w) +
          '</div>' +
          bottomRow +
          '</div>' +
          videoButtons(w) +
          '</div>'
        );
      })
      .join('');
  } else if (viewMode === 'list') {
    list.innerHTML = filtered
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const pill = cardLikePill(w, p);
        const bottomRow =
          '<div class="card-bottom-row">' +
          '<div class="markings-row wce-markings">' +
          markingPips(markings) +
          '</div>' +
          pill +
          '</div>';
        const _ms2 = markingStyle(markings);
        return (
          '<div class="waza-list ' +
          _ms2.cls +
          (state.selectedId === w.id ? ' selected' : '') +
          '" data-id="' +
          w.id +
          '" style="' +
          _ms2.style +
          '">' +
          '<div class="njp">' +
          (w.name_jp || '—') +
          '</div>' +
          '<div class="nen">' +
          dispName(w) +
          '</div>' +
          bottomRow +
          '</div>'
        );
      })
      .join('');
  } else {
    // Compact — no likes, equal truncating names
    list.innerHTML = filtered
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const _ms3 = markingStyle(markings);
        return (
          '<div class="waza-compact ' +
          _ms3.cls +
          (state.selectedId === w.id ? ' selected' : '') +
          '" data-id="' +
          w.id +
          '" style="' +
          _ms3.style +
          '">' +
          '<span class="drn">' +
          (w.name_jp || '—') +
          '</span>' +
          '<span class="drs">' +
          dispName(w) +
          '</span>' +
          '<div class="markings-row" style="flex-shrink:0">' +
          markingPips(markings) +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }
}
