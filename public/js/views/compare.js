/**
 * @file views/compare.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-22
 * @brief Compare tab view. Centralized top controls, label comparison editor, and side-by-side marks (their pips vs. your segmented mark-pill) with in-place toggling.
 */

import { api } from '../services/api.js';
import { state } from '../state/state.js';
import { getP } from '../services/progress.js';
import { showToast } from '../components/show-toast.js';
import { escapeHtml } from '../lib/escape.js';
import { openImportModal, openExportModal } from '../features/share-list.js';
import { refreshMyGroups } from './groups-browse-list.js';
import { buildAccordion, closeAllAccordions, toggleAccordionDOM } from '../app/accordion-shell.js';
import {
  getCurrentUserId,
  getMyGroups,
  getMyGroupsLoaded,
  isLoggedIn,
} from '../state/user-state.js';
import {
  clearCompareData,
  getCompareAccordion,
  getCompareLastGroupData,
  getCompareSelectedKey,
  getImportedList,
  getImportedListKeys,
  hasImportedList,
  removeImportedList,
  resetCompareAccordion,
  setCompareAccordion,
  setCompareLastGroupData,
  setCompareSelectedKey,
} from '../state/compare-state.js';
import {
  buildCompareMarkingLabelsTableHTML,
  buildCompareMarkingTableRowsHTML,
  wireCompareTableListeners,
  wireSaveLabelsButton,
} from '../components/compare-table.js';

/**
 * @brief Renders the shared comparison result section below the accordions.
 *
 * Reads the current active accordion and its data, builds the labels table
 * and waza rows, and renders them into #cmpResult. Wires all event listeners
 * for the newly created DOM elements.
 *
 * @return {void}
 */
function renderCompareResult() {
  const resultEl = document.getElementById('cmpResult');
  if (!resultEl) return;

  // ── Group mode ──────────────────────────────────────────
  if (getCompareAccordion() === 'group' && getCompareLastGroupData()) {
    const { memberName, importedIds, theirMarkingsLookup, theirLabels, myCounts, theirCounts } =
      getCompareLastGroupData();

    const labelsHtml = buildCompareMarkingLabelsTableHTML(
      'Marking Labels — ' + memberName,
      { labels: state.markingLabels, counts: myCounts },
      { labels: theirLabels, counts: theirCounts },
    );

    const rowsHtml = buildCompareMarkingTableRowsHTML(
      importedIds,
      theirMarkingsLookup,
      memberName,
      memberName + " hasn't marked any Waza yet.",
    );

    resultEl.innerHTML = labelsHtml + rowsHtml;
    wireSaveLabelsButton(resultEl);
    wireCompareTableListeners(resultEl);
    return;
  }

  // ── Imported mode ───────────────────────────────────────
  if (getCompareAccordion() === 'imported') {
    const key = getCompareSelectedKey();
    const imp = key ? getImportedList(key) : null;

    // Counts
    const impMarkingCounts = Array(6).fill(0);
    const myMarkingCounts = Array(6).fill(0);

    if (imp && imp.marks) {
      Object.values(imp.marks).forEach((mark) => {
        if (mark.markings)
          mark.markings.forEach((on, i) => {
            if (on) impMarkingCounts[i]++;
          });
      });
      const importedIds = new Set(Object.keys(imp.marks).map(Number));
      state.wazaData.forEach((w) => {
        if (!importedIds.has(w.id)) return;
        const p = getP(w.id);
        if (p.markings)
          p.markings.forEach((on, i) => {
            if (on) myMarkingCounts[i]++;
          });
      });
    }

    // Labels
    let labelsHtml;
    if (imp) {
      labelsHtml = buildCompareMarkingLabelsTableHTML(
        'Compare Marking Labels Table',
        { labels: state.markingLabels, counts: myMarkingCounts },
        { labels: imp.labels || Array(6).fill(''), counts: impMarkingCounts },
      );
    } else {
      labelsHtml = buildCompareMarkingLabelsTableHTML('My Marking Labels', {
        labels: state.markingLabels,
        counts: myMarkingCounts,
      });
    }

    // Rows
    let rowsHtml;
    const keys = getImportedListKeys();
    if (!keys.length) {
      rowsHtml =
        '<div class="cmp-empty">No imported lists yet.<br>Use <b>↓ Import List</b> to add one.</div>';
    } else {
      const importedIds = imp ? new Set(Object.keys(imp.marks).map(Number)) : new Set();
      const theirMarkingsLookup = {};
      if (imp) {
        for (const [wazaId, mark] of Object.entries(imp.marks)) {
          theirMarkingsLookup[+wazaId] = mark.markings || Array(6).fill(false);
        }
      }
      rowsHtml = buildCompareMarkingTableRowsHTML(
        importedIds,
        theirMarkingsLookup,
        'Their marks',
        'This list has no marks.',
      );
    }

    resultEl.innerHTML = labelsHtml + rowsHtml;
    wireSaveLabelsButton(resultEl);
    wireCompareTableListeners(resultEl);
    return;
  }

  // ── Default fallback: just the user's own labels ────────
  const labelsHtml = buildCompareMarkingLabelsTableHTML('My Marking Labels', {
    labels: state.markingLabels,
    counts: Array(6).fill(0),
  });
  resultEl.innerHTML = labelsHtml;
  wireSaveLabelsButton(resultEl);
}

// ── Group comparison section ──────────────────────────────────

/**
 * @brief Builds the inner HTML for the "Compare with Group" accordion body.
 *
 * Only the group/member selects and a result container are rendered here.
 * The actual member list is fetched lazily when the user picks a group,
 * so this stays synchronous and fast.
 *
 * @return {string} HTML string.
 */
function buildGroupBody() {
  const loggedIn = isLoggedIn();

  if (!loggedIn) {
    return (
      '<div style="font-size:13px;color:var(--text3)">' +
      'Sign in to compare with Group members.' +
      '</div>'
    );
  }

  return (
    '<div class="cmp-controls">' +
    // Group picker — populated from state.myGroups (already loaded)
    '<select id="cmpGroupSelect" class="cmp-select" style="min-width:160px">' +
    '<option value="">Select Group</option>' +
    getMyGroups()
      .map((g) => '<option value="' + g.id + '">' + escapeHtml(g.name) + '</option>')
      .join('') +
    '</select>' +
    // Member picker — starts disabled; populated after group is chosen
    '<select id="cmpMemberSelect" class="cmp-select" style="min-width:160px" disabled>' +
    '<option value="">Select Member</option>' +
    '</select>' +
    // Compare button — starts disabled until a member is chosen
    '<button class="btn" id="cmpGroupLoadBtn" disabled>Compare</button>' +
    '</div>'
  );
}

/**
 * @brief Wires all event listeners for the "Compare with Group" body.
 *
 * Must be called after renderDashCompare() sets innerHTML, since event
 * listeners don't survive DOM replacement.
 *
 * @param {HTMLElement} container - The #dashCompare element.
 * @return {void}
 */
function wireGroupContent(container) {
  const groupSel = container.querySelector('#cmpGroupSelect');
  const memberSel = container.querySelector('#cmpMemberSelect');
  const loadBtn = container.querySelector('#cmpGroupLoadBtn');

  // None of these elements exist when the accordion is closed — safe to bail.
  if (!groupSel || !memberSel || !loadBtn) return;

  // ── Group selection → fetch members ──────────────────────────
  groupSel.addEventListener('change', async () => {
    const gid = +groupSel.value;
    memberSel.innerHTML = '<option value="">Loading…</option>';
    memberSel.disabled = true;
    loadBtn.disabled = true;

    if (!gid) {
      memberSel.innerHTML = '<option value="">— Select a member —</option>';
      return;
    }

    try {
      const members = await api('/api/groups/' + gid + '/members');
      const others = members.filter((m) => m.user_id !== getCurrentUserId());
      memberSel.innerHTML =
        '<option value="">— Select a member —</option>' +
        others
          .map(
            (m) =>
              '<option value="' +
              m.user_id +
              '">' +
              escapeHtml(m.username) +
              (m.tag ? ' (' + escapeHtml(m.tag) + ')' : '') +
              '</option>',
          )
          .join('');
      memberSel.disabled = false;
    } catch {
      memberSel.innerHTML = '<option value="">Couldn\'t load members</option>';
      memberSel.disabled = false;
    }
  });

  // ── Member selection → enable Compare button ──────────────────
  memberSel.addEventListener('change', () => {
    loadBtn.disabled = !memberSel.value;
  });

  // ── Compare button → fetch and render the member's progress ──
  loadBtn.addEventListener('click', async () => {
    const gid = +groupSel.value;
    const uid = +memberSel.value;
    if (!gid || !uid) return;

    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading…';

    try {
      const data = await api('/api/groups/' + gid + '/members/' + uid + '/progress');

      if (data.error) {
        showToast(data.error, 'red');
        loadBtn.disabled = false;
        loadBtn.textContent = 'Compare';
        return;
      }

      const memberName = memberSel.options[memberSel.selectedIndex].text;
      const importedIds = new Set(Object.keys(data.markings).map(Number));

      // ── Compute per-marking counts for both users ─────────────
      const myMarkingCounts = Array(6).fill(0);
      const theirMarkingCounts = Array(6).fill(0);

      for (const wazaId of importedIds) {
        const myMarkings = getP(wazaId).markings || Array(6).fill(false);
        const theirMarkings = data.markings[wazaId]?.markings || Array(6).fill(false);

        myMarkings.forEach((on, i) => {
          if (on) myMarkingCounts[i]++;
        });
        theirMarkings.forEach((on, i) => {
          if (on) theirMarkingCounts[i]++;
        });
      }

      // ── Build their markings lookup ───────────────────────────
      const theirMarkingsLookup = {};
      for (const [wazaId, mark] of Object.entries(data.markings)) {
        theirMarkingsLookup[+wazaId] = mark.markings || Array(6).fill(false);
      }

      // Store the data for renderCompareResult to use
      setCompareLastGroupData({
        memberName,
        importedIds,
        theirMarkingsLookup,
        theirLabels: data.labels || Array(6).fill(''),
        myCounts: myMarkingCounts,
        theirCounts: theirMarkingCounts,
      });

      // Render into the shared section
      renderCompareResult();
    } catch {
      showToast("Couldn't load this member's list.", 'red');
    }

    loadBtn.disabled = false;
    loadBtn.textContent = 'Compare';
  });
}

// ── Data helpers ──────────────────────────────────────────────

/**
 * @brief Builds the inner HTML for the "Compare with Imported List" accordion body.
 *
 * Renders the list selector controls, the marking-labels comparison table,
 * and the side-by-side waza rows — all from in-memory state (fast, synchronous).
 *
 * @return {string} HTML string.
 */
function buildImportedBody() {
  const keys = getImportedListKeys();
  const selectedKey = getCompareSelectedKey();

  // Keep selectedKey valid
  if (selectedKey && !hasImportedList(selectedKey)) setCompareSelectedKey(null);
  if (!getCompareSelectedKey() && keys.length) setCompareSelectedKey(keys[0]);

  // ── Controls ──────────────────────────────────────────────────
  const listOpts = keys
    .map(
      (k) =>
        '<option value="' +
        escapeHtml(k) +
        '"' +
        (k === getCompareSelectedKey() ? ' selected' : '') +
        '>' +
        escapeHtml(getImportedList(k).name) +
        '</option>',
    )
    .join('');

  return (
    '<div class="cmp-controls">' +
    '<select class="cmp-select" id="cmpSelect">' +
    '<option value="">— select a list —</option>' +
    listOpts +
    '</select>' +
    (getCompareSelectedKey()
      ? '<button class="btn cmp-ctrl-remove" id="cmpRemoveBtn">Remove</button>'
      : '') +
    '<button class="btn" id="cmpImportBtn">↓ Import List</button>' +
    '<button class="btn" id="cmpExportBtn">↑ Export My List</button>' +
    '</div>'
  );
}

/**
 * @brief Wires all event listeners for the "Compare with Imported List" body.
 *
 * @param {HTMLElement} container - The #dashCompare element.
 * @return {void}
 */
function wireCompareImportTable(container) {
  container.querySelector('#cmpExportBtn')?.addEventListener('click', openExportModal);

  container.querySelector('#cmpImportBtn')?.addEventListener('click', () => openImportModal());

  // List picker — re-render the whole tab to reflect the new selection
  container.querySelector('#cmpSelect')?.addEventListener('change', (e) => {
    setCompareSelectedKey(e.target.value || null);
    renderDashCompare();
  });

  // Remove button — deletes from localStorage and re-renders
  container.querySelector('#cmpRemoveBtn')?.addEventListener('click', () => {
    const key = getCompareSelectedKey();
    if (!key) return;
    const name = getImportedList(key).name;
    if (!confirm('Remove "' + name + '" from your imported lists?')) return;
    removeImportedList(key);
    renderDashCompare();
  });

  wireCompareTableListeners(container);
}

/**
 * @brief Renders the Compare tab as two mutually exclusive accordions.
 *
 * "Compare with Group" is hidden when the user has no groups.
 * Both accordions start collapsed. Opening one collapses the other
 * and clears all comparison data.
 *
 * @return {Promise<void>}
 */
export async function renderDashCompare() {
  const container = document.getElementById('dashCompare');
  const loggedIn = isLoggedIn();

  if (!getMyGroupsLoaded()) {
    await refreshMyGroups();
  }
  const myGroups = getMyGroups();
  const hasGroups = loggedIn && myGroups && myGroups.length > 0;

  // If the group accordion was open but the user no longer has groups
  // (e.g. they left their last group), collapse it silently.
  if (getCompareAccordion() === 'group' && !hasGroups) {
    clearCompareData();
    resetCompareAccordion();
  }

  // ── Build accordion bodies (only when open — avoids rendering heavy
  //    row lists that would never be visible while collapsed) ──────
  const groupBody = buildGroupBody();
  const importedBody = buildImportedBody();

  // ── Render both accordion shells ──────────────────────────────
  container.innerHTML =
    buildAccordion('group', 'Compare with Group', groupBody, {
      open: getCompareAccordion() === 'group',
      visible: hasGroups,
    }) +
    buildAccordion('imported', 'Compare with Imported List', importedBody, {
      open: getCompareAccordion() === 'imported',
    }) +
    '<div id="cmpResult"></div>';

  // ── Wire accordion toggle buttons ─────────────────────────────
  container.querySelectorAll('.acc-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.acc;
      const isOpen = getCompareAccordion() === key;

      setCompareAccordion(key);
      if (isOpen) {
        toggleAccordionDOM(el, false);
      } else {
        closeAllAccordions(container);
        toggleAccordionDOM(el, true);
      }
    });
  });

  // ── Wire content event listeners (only for the open section) ──
  wireGroupContent(container);
  wireCompareImportTable(container);

  renderCompareResult();
}
