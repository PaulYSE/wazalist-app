/* state.js — mutable app state + localStorage helpers.
   These globals are read/written by almost every other file. */
    let isGuest = false, token = localStorage.getItem('wl_token') || '';
    let currentUsername = localStorage.getItem('wl_username') || '';
    let wazaData = [], prog = {}, selectedId = null;
    const savingIds = new Set(); // waza IDs currently being saved
    let filters = { search: '', markings: Array(6).fill(false) };
    let browseFilterAny = false; // true = show only waza with any mark (replaces My List)
    
    // Load sort preferences from localStorage
    const loadSortPrefs = () => { 
      try { 
        const prefs = JSON.parse(localStorage.getItem('wl_sort_prefs') || '{}');
        return { field: prefs.field || 'default', order: prefs.order || 'asc' };
      } catch { 
        return { field: 'default', order: 'asc' };
      }
    };
    const savedSort = loadSortPrefs();
    let browseSortField = savedSort.field; // 'default' | 'name' | 'likes'
    let browseSortOrder = savedSort.order;  // 'asc' | 'desc'
    
    // Load view style preference from localStorage
    let browseListView = localStorage.getItem('wl_view_style') || 'expanded'; // 'expanded' | 'list' | 'compact' — default: Cards
    let isAdmin = false;

    // ── localStorage ─────────────────────────────────────────────
    const LS_KEY = 'wl_local_prog';
    const LS_LABELS = 'wl_marking_labels';
    const LS_SORT = 'wl_sort_prefs';
    const LS_VIEW = 'wl_view_style';
    const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} } };
    const saveLocal = d => localStorage.setItem(LS_KEY, JSON.stringify(d));
    let markingLabels = JSON.parse(localStorage.getItem(LS_LABELS) || '["","","","","",""]');

    // ── API ──────────────────────────────────────────────────────
