// state.js — mutable app state + localStorage helpers

// ── Constants ────────────────────────────────────────────────
export const LS_KEY    = 'wl_local_prog';
export const LS_LABELS = 'wl_marking_labels';
export const LS_SORT   = 'wl_sort_prefs';
export const LS_VIEW   = 'wl_view_style';

// ── localStorage helpers ─────────────────────────────────────
export const loadLocal = () => { 
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} } 
};
export const saveLocal = d => localStorage.setItem(LS_KEY, JSON.stringify(d));

const loadSortPrefs = () => {
  try {
    const prefs = JSON.parse(localStorage.getItem(LS_SORT) || '{}');
    return { field: prefs.field || 'default', order: prefs.order || 'asc' };
  } catch {
    return { field: 'default', order: 'asc' };
  }
};
const savedSort = loadSortPrefs();

// ── Shared mutable state ─────────────────────────────────────
export const state = {
  token:           localStorage.getItem('wl_token') || '',
  isGuest:         false,
  currentUsername: localStorage.getItem('wl_username') || '',
  isAdmin:         false,
  wazaData:        [],
  prog:            {},
  selectedId:      null,
  savingIds:       new Set(),
  filters:         { search: '', markings: Array(6).fill(false) },
  browseFilterAny: false,
  browseSortField: savedSort.field,
  browseSortOrder: savedSort.order,
  browseListView:  localStorage.getItem(LS_VIEW) || 'expanded',
  markingLabels:   JSON.parse(localStorage.getItem(LS_LABELS) || '["","","","","",""]'),
};