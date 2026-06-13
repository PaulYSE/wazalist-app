/**
 * @file state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Manages global mutable application state and localStorage synchronization helpers.
 */

import { LS_SORT, LS_VIEW, LS_LABELS } from './localStorage.js';

/**
 * @brief Loads saved sort preferences from localStorage.
 *
 * @return {object} An object with `field` and `order` properties, defaulting to { field: 'default', order: 'asc' } if none exist or parsing fails.
 */
const loadSortPrefs = () => {
  try {
    const prefs = JSON.parse(localStorage.getItem(LS_SORT) || '{}');
    return { field: prefs.field || 'default', order: prefs.order || 'asc' };
  } catch {
    // If parsing fails, fall back to default sort preferences
    return { field: 'default', order: 'asc' };
  }
};
const savedSort = loadSortPrefs();

// ── Shared mutable state ─────────────────────────────────────

/**
 * @brief Global application state object.
 *
 * Stores authentication status, user data, waza list, progress, UI filters,
 * sort preferences, view mode, and custom marking labels.
 */
export const state = {
  token: localStorage.getItem('wl_token') || '',
  isGuest: false,
  currentUsername: localStorage.getItem('wl_username') || '',
  isAdmin: false,
  wazaData: [],
  prog: {},
  selectedId: null,
  savingIds: new Set(),
  filters: { search: '', markings: Array(6).fill(false) },
  browseFilterAny: false,
  browseSortField: savedSort.field,
  browseSortOrder: savedSort.order,
  browseListView: localStorage.getItem(LS_VIEW) || 'expanded',
  markingLabels: JSON.parse(localStorage.getItem(LS_LABELS) || '["","","","","",""]'),
  myGroups: [],         // [{ id, name, role }] — groups the user belongs to
myGroupsLoaded: false,
currentUserId: null,  // set on login/session restore for group member comparisons
};

// ── Import-from-text shared state ─────────────────────────────

/**
 * @brief Shared mutable state for the import-from-text feature.
 *
 * Tracks found labels, auto-mapping, unmatched lines, preview mode,
 * and Excel color mappings across the multi-phase parsing process.
 * This keeps the import-ui.js module focused on DOM and user interaction,
 * while tiState and related functions in import-from-text.js handle the parsing logic.
 */
export const tiState = {
  matched: [], // [{waza, rawLine, category, manualMarkings}]
  unmatched: [], // [rawLine]
  parsed: false,
  foundLabels: [], // ordered unique label strings found in text
  autoMapping: {}, // { [labelStr]: markingIndex (-1 = none) }
  labelNames: {}, // { [labelStr]: displayName } — user-editable
  previewMode: false, // true when auto-labels applied to manualMarkings as preview
  excelColors: {}, // { colorHex: [wazaNames] }
  colorMapping: {}, // { colorHex: markingIndex }
  excelColorLabels: {}, // { colorHex: labelName }
};
