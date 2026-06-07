/* browse-list.js */

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
import { LS_VIEW, LS_SORT } from '../state/localStorage.js';
import { updateMarkingFilterUI } from '../app/shell.js';

// ── Browse sort ───────────────────────────────────────────────
// Single entry point for changing sort. Pass either field, order, or both;
// omitted values keep their current state. Persists, syncs all four selects
// (+ the order-disabled state), and re-renders once. Adding a new sort field
// later means only adding an <option> in the HTML — this stays untouched.
export function setBrowseSort({ field, order } = {}) {
  if (field !== undefined) state.browseSortField = field;
  if (order !== undefined) state.browseSortOrder = order;
  localStorage.setItem(
    LS_SORT,
    JSON.stringify({ field: state.browseSortField, order: state.browseSortOrder }),
  );
  updateMarkingFilterUI();
  syncBrowseSortControls();
  renderList();
}

// Reflect current sort state into the desktop + mobile selects and the
// order-disabled state, without persisting or rendering. Used at boot and by
// setBrowseSort.
export function syncBrowseSortControls() {
  const isDefault = state.browseSortField === 'default';
  ['browseSortField', 'browseSortFieldMob'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = state.browseSortField;
  });
  ['browseSortOrder', 'browseSortOrderMob'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = state.browseSortOrder;
      el.disabled = isDefault;
    }
  });
}

// ── Browse view mode ──────────────────────────────────────────
// The single entry point for changing the list view style (expanded / list /
// compact). Every input — desktop dropdown, mobile dropdown, filter sheet —
// routes here, so state, persistence, all three <select>s, and the rendered
// list can never drift apart.
export function setBrowseView(view) {
  state.browseListView = view;
  localStorage.setItem(LS_VIEW, view);
  syncBrowseViewControls();
  renderList();
}

// Reflect current state into the three view-style selects without re-rendering
// or persisting. Used at boot, and by setBrowseView to keep the controls synced.
export function syncBrowseViewControls() {
  ['browseViewSelect', 'browseViewSelectMob', 'viewStyleSelectMobile'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = state.browseListView;
  });
}

// Wire the controls that apply immediately (desktop + standalone mobile
// dropdown). The filter-sheet's staged select is applied on Confirm in shell.js.
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

export function renderList() {
  const filtered = filterWaza();
  document.getElementById('countBar').textContent =
    filtered.length + ' of ' + state.wazaData.length + ' Waza';
  const list = document.getElementById('wazaList');
  if (!filtered.length) {
    list.innerHTML =
      '<div style="padding:20px;text-align:center;color:#6a6880;font-size:14px">No Waza found</div>';
    return;
  }

  if (state.browseListView === 'expanded') {
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
  } else if (state.browseListView === 'list') {
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
