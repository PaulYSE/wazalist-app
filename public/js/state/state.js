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
  wazaData: [],
  prog: {},
  selectedId: null,
  savingIds: new Set(),
  filters: { search: '', markings: Array(6).fill(false) },
  browseFilterAny: false,
  markingLabels: JSON.parse(localStorage.getItem(LS_LABELS) || '["","","","","",""]'),
};
