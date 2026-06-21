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

  /** @type {Object} Search and marking filters. */
  filters: {
    /** @type {string} Search query string. */
    search: '',
    /** @type {boolean[]} Array of 6 marking filter booleans. */
    markings: Array(6).fill(false),
  },

  /** @type {boolean} Whether "Any" marking filter mode is active. */
  browseFilterAny: false,
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

// ── filters.search ──────────────────────────────────────────

/**
 * @brief Accessors for the search filter.
 *
 * - getBrowseSearchFilter() → {string}
 * - setBrowseSearchFilter(val) → {void}
 * - resetBrowseSearchFilter() → {void}
 */
export function getBrowseSearchFilter() {
  return wazaBrowseState.filters.search;
}
export function setBrowseSearchFilter(val) {
  wazaBrowseState.filters.search = val;
}
export function resetBrowseSearchFilter() {
  wazaBrowseState.filters.search = '';
}

// ── filters.markings ────────────────────────────────────────

/**
 * @brief Accessors for the marking filters.
 *
 * - getBrowseMarkingFilters() → {boolean[]}
 * - setBrowseMarkingFilters(val) → {void}
 * - setAllBrowseMarkingFilters(val) → {void}
 * - toggleBrowseMarkingFilter(index) → {boolean} (returns new state)
 * - resetBrowseMarkingFilters() → {void}
 */
export function getBrowseMarkingFilters() {
  return wazaBrowseState.filters.markings;
}
export function setBrowseMarkingFilters(val) {
  wazaBrowseState.filters.markings = Array.isArray(val) ? val : Array(6).fill(false);
}
export function setAllBrowseMarkingFilters(val) {
  wazaBrowseState.filters.markings = Array(6).fill(!!val);
}
export function toggleBrowseMarkingFilter(index) {
  wazaBrowseState.filters.markings[index] = !wazaBrowseState.filters.markings[index];
  return wazaBrowseState.filters.markings[index];
}
export function resetBrowseMarkingFilters() {
  wazaBrowseState.filters.markings = Array(6).fill(false);
}

// ── browseFilterAny ─────────────────────────────────────────

/**
 * @brief Accessors for the "Any" marking filter mode.
 *
 * - isBrowseFilterAny() → {boolean}
 * - toggleBrowseFilterAny() → {boolean} (returns new state)
 * - setBrowseFilterAny() → {void}
 * - resetBrowseFilterAny() → {void}
 */
export function isBrowseFilterAny() {
  return wazaBrowseState.browseFilterAny;
}
export function toggleBrowseFilterAny() {
  wazaBrowseState.browseFilterAny = !wazaBrowseState.browseFilterAny;
  return wazaBrowseState.browseFilterAny;
}
export function setBrowseFilterAny() {
  wazaBrowseState.browseFilterAny = true;
}
export function resetBrowseFilterAny() {
  wazaBrowseState.browseFilterAny = false;
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
export function setBrowseSortState({ field, order } = {}) {
  if (field !== undefined) wazaBrowseState.browseSortField = field;
  if (order !== undefined) wazaBrowseState.browseSortOrder = order;
  saveSortToLS();
}

// ── Derived state ───────────────────────────────────────────

/**
 * @brief Whether at least one individual marking filter is active.
 *
 * @return {boolean}
 */
export function isAnyMarkingFilterActive() {
  return wazaBrowseState.filters.markings.some(Boolean);
}

/**
 * @brief Whether all six marking filters are active.
 *
 * @return {boolean}
 */
export function isAllMarkingFiltersActive() {
  return wazaBrowseState.filters.markings.every(Boolean);
}

/**
 * @brief Whether any non-default filter is active.
 *
 * True when: Any marking filter is on, Any mode is active,
 * sort field is not default, or sort order is not ascending.
 *
 * @return {boolean}
 */
export function hasActiveFilter() {
  return (
    wazaBrowseState.browseFilterAny ||
    isAnyMarkingFilterActive() ||
    wazaBrowseState.browseSortField !== 'default' ||
    wazaBrowseState.browseSortOrder !== 'asc'
  );
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

/**
 * @brief Resets all browse preferences to defaults.
 *
 * @return {void}
 */
export function resetBrowseState() {
  resetBrowseSortField();
  resetBrowseSortOrder();
  resetBrowseListView();
  resetBrowseMarkingFilters();
  resetBrowseSearchFilter();
  resetBrowseFilterAny();
}
