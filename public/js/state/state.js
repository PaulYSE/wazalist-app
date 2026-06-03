// state.js — mutable app state + localStorage helpers
import { LS_SORT, LS_VIEW, LS_LABELS } from './localStorage.js';

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
};

// tiState is the shared mutable state for the import-from-text feature, which is complex enough to warrant its own module. It tracks found labels and auto-mapping state across the multi-phase parsing process. This keeps the import-ui.js module focused on DOM and user interaction, while tiState and related functions in import-from-text.js handle the parsing logic,
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
