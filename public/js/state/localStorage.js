/* localStorage.js — constants and helpers for saving/loading from localStorage. */

// ── Constants ────────────────────────────────────────────────
export const LS_KEY = 'wl_local_prog';
export const LS_LABELS = 'wl_marking_labels';
export const LS_SORT = 'wl_sort_prefs';
export const LS_VIEW = 'wl_view_style';
export const LS_IMPORTED = 'wl_imported_lists';

// ── localStorage helpers ─────────────────────────────────────

/**
 * @brief Loads progress data from localStorage.
 *
 * @return {object} Parsed progress object, or an empty object if none exists or parsing fails.
 */
export const loadLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * @brief Saves progress data to localStorage.
 *
 * @param d The progress object to store.
 */
export const saveLocal = (d) => localStorage.setItem(LS_KEY, JSON.stringify(d));
