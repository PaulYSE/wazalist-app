/* localStorage.js — constants and helpers for saving/loading from localStorage. */

// ── Constants ────────────────────────────────────────────────
export const LS_KEY = 'wl_local_prog';
export const LS_LABELS = 'wl_marking_labels';
export const LS_SORT = 'wl_sort_prefs';
export const LS_VIEW = 'wl_view_style';
export const LS_IMPORTED = 'wl_imported_lists';

// ── localStorage helpers ─────────────────────────────────────
export const loadLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
};
export const saveLocal = (d) => localStorage.setItem(LS_KEY, JSON.stringify(d));
