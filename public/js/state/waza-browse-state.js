/**
 * @file state/waza-browse-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-21
 * @brief User search and view preferences. Backed by localStorage, no server sync.
 */

import { LS_SORT, LS_VIEW } from './localStorage.js';

// ── State container ─────────────────────────────────────────

/** @type {Object} Search preferences state. */
const wazaBrowseState = {
  /** @type {'default'|'name'|'likes'} */
  browseSortField: 'default',

  /** @type {'asc'|'desc'} */
  browseSortOrder: 'asc',

  /** @type {'expanded'|'list'|'compact'} */
  browseListView: 'expanded',
};

// ── Helpers ─────────────────────────────────────────────────

/**
 * @brief Reads sort preferences from localStorage.
 *
 * @return {{ field: string, order: string }}
 */
function loadSortFromLS() {
  try {
    const prefs = JSON.parse(localStorage.getItem(LS_SORT) || '{}');
    return {
      field: prefs.field || 'default',
      order: prefs.order || 'asc',
    };
  } catch {
    return { field: 'default', order: 'asc' };
  }
}

/**
 * @brief Writes sort preferences to localStorage.
 *
 * @return {void}
 */
function saveSortToLS() {
  localStorage.setItem(
    LS_SORT,
    JSON.stringify({
      field: wazaBrowseState.browseSortField,
      order: wazaBrowseState.browseSortOrder,
    }),
  );
}

// ── Init ────────────────────────────────────────────────────

/**
 * @brief Hydrates all preferences from localStorage.
 *
 * Call once at application boot. Safe to call multiple times —
 * subsequent calls overwrite memory with current LS values.
 *
 * @return {void}
 */
export function initSearchPreferences() {
  const sort = loadSortFromLS();
  wazaBrowseState.browseSortField = sort.field;
  wazaBrowseState.browseSortOrder = sort.order;
  wazaBrowseState.browseListView = localStorage.getItem(LS_VIEW) || 'expanded';
}

// ── browseSortField ─────────────────────────────────────────

/**
 * @brief Accessors for the sort field preference.
 *
 * - getBrowseSortField() → {'default'|'name'|'likes'}
 * - setBrowseSortField(val) → {void}
 * - resetBrowseSortField() → {void}
 */
export function getBrowseSortField() {
  return wazaBrowseState.browseSortField;
}
export function setBrowseSortField(val) {
  wazaBrowseState.browseSortField = val;
  saveSortToLS();
}
export function resetBrowseSortField() {
  wazaBrowseState.browseSortField = 'default';
  saveSortToLS();
}

// ── browseSortOrder ─────────────────────────────────────────

/**
 * @brief Accessors for the sort order preference.
 *
 * - getBrowseSortOrder() → {'asc'|'desc'}
 * - setBrowseSortOrder(val) → {void}
 * - resetBrowseSortOrder() → {void}
 */
export function getBrowseSortOrder() {
  return wazaBrowseState.browseSortOrder;
}
export function setBrowseSortOrder(val) {
  wazaBrowseState.browseSortOrder = val;
  saveSortToLS();
}
export function resetBrowseSortOrder() {
  wazaBrowseState.browseSortOrder = 'asc';
  saveSortToLS();
}

// ── browseListView ──────────────────────────────────────────

/**
 * @brief Accessors for the view mode preference.
 *
 * - getBrowseListView() → {'expanded'|'list'|'compact'}
 * - setBrowseListView(val) → {void}
 * - resetBrowseListView() → {void}
 */
export function getBrowseListView() {
  return wazaBrowseState.browseListView;
}
export function setBrowseListView(val) {
  wazaBrowseState.browseListView = val;
  localStorage.setItem(LS_VIEW, val);
}
export function resetBrowseListView() {
  wazaBrowseState.browseListView = 'expanded';
  localStorage.setItem(LS_VIEW, 'expanded');
}

// ── Bulk setter ─────────────────────────────────────────────

/**
 * @brief Sets sort field and/or order in one call.
 *
 * Omitted values keep their current value. Persists to localStorage.
 *
 * @param {Object} options
 * @param {string} [options.field]
 * @param {string} [options.order]
 * @return {void}
 */
export function setBrowseSort({ field, order } = {}) {
  if (field !== undefined) wazaBrowseState.browseSortField = field;
  if (order !== undefined) wazaBrowseState.browseSortOrder = order;
  saveSortToLS();
}

// ── Reset all ───────────────────────────────────────────────

/**
 * @brief Resets all search preferences to defaults.
 *
 * @return {void}
 */
export function resetSearchPreferences() {
  resetBrowseSortField();
  resetBrowseSortOrder();
  resetBrowseListView();
}