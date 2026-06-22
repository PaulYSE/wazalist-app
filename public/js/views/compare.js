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
import {
  getBulkCompareData,
  getBulkCompareGroupId,
  getBulkCompareSelectedListKeys,
  getBulkCompareSelectedUserIds,
  getBulkCompareSourceType,
  getBulkCompareWazaNameDisplay,
  hasBulkCompareSelection,
  isBulkCompareEditMode,
  resetBulkCompareState,
  setBulkCompareData,
  setBulkCompareEditMode,
  setBulkCompareGroupId,
  setBulkCompareSelectedListKeys,
  setBulkCompareSelectedUserIds,
  setBulkCompareSourceType,
  setBulkCompareWazaNameDisplay,
} from '../state/compare-bulk-state.js';
import { buildCompareMatrixHTML } from '../components/compare-matrix.js';

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
 * @brief Builds the inner HTML for the "Bulk Compare" accordion body.
 *
 * Shows source type selector, group/list picker, and the comparison matrix.
 *
 * @return {string} HTML string.
 */
function buildBulkBody() {
  const sourceType = getBulkCompareSourceType();
  const selectedUserIds = getBulkCompareSelectedUserIds();
  const selectedListKeys = getBulkCompareSelectedListKeys();
  const editMode = isBulkCompareEditMode();
  const wazaNameDisplay = getBulkCompareWazaNameDisplay();
  const hasSelection = hasBulkCompareSelection();

  // ── Source type selector ────────────────────────────────
  let controlsHtml =
    '<div class="cmp-controls">' +
    '<select id="cmpBulkSourceType" class="cmp-select" style="min-width:140px">' +
    '<option value="">Select source…</option>' +
    '<option value="group"' +
    (sourceType === 'group' ? ' selected' : '') +
    '>Group Members</option>' +
    '<option value="imported"' +
    (sourceType === 'imported' ? ' selected' : '') +
    '>Imported Lists</option>' +
    '</select>';

  // ── Group picker ─────────────────────────────────────────
  if (sourceType === 'group') {
    const groupId = getBulkCompareGroupId();
    controlsHtml +=
      '<select id="cmpBulkGroupSelect" class="cmp-select" style="min-width:160px">' +
      '<option value="">Select Group</option>' +
      getMyGroups()
        .map(
          (g) =>
            '<option value="' +
            g.id +
            '"' +
            (g.id === groupId ? ' selected' : '') +
            '>' +
            escapeHtml(g.name) +
            '</option>',
        )
        .join('') +
      '</select>';
  }

  // ── Imported list picker ─────────────────────────────────
  if (sourceType === 'imported') {
    const keys = getImportedListKeys();
    controlsHtml +=
      '<select id="cmpBulkListSelect" class="cmp-select" style="min-width:160px">' +
      '<option value="">Select List</option>' +
      keys
        .map(
          (k) =>
            '<option value="' +
            escapeHtml(k) +
            '">' +
            escapeHtml(getImportedList(k).name) +
            '</option>',
        )
        .join('') +
      '</select>' +
      '<button class="btn" id="cmpBulkAddListBtn">Add List</button>';
  }

  // ── Action buttons ───────────────────────────────────────
  controlsHtml +=
    (hasSelection
      ? '<button class="btn" id="cmpBulkEditBtn">' +
        (editMode ? 'Done' : 'Edit') +
        '</button>' +
        '<button class="btn" id="cmpBulkClearBtn">Clear All</button>'
      : '') + '</div>';

  // ── Matrix ───────────────────────────────────────────────
  let matrixHtml;
  if (hasSelection && getBulkCompareData()) {
    const data = getBulkCompareData();
    const allWazaIds = new Set();

    // Collect all waza IDs from all selected users
    selectedUserIds.forEach((uid) => {
      if (data[uid] && data[uid].markings) {
        Object.keys(data[uid].markings).forEach((id) => allWazaIds.add(+id));
      }
    });

    // Build membersData array
    const membersData = [];
    // Other users first
    selectedUserIds.forEach((uid) => {
      if (data[uid]) {
        membersData.push({
          userId: uid,
          username: data[uid].username || 'User ' + uid,
          markings: data[uid].markings || {},
          labels: data[uid].labels || [],
        });
      }
    });
    // You last
    const yourData = data[getCurrentUserId()];
    if (yourData) {
      membersData.push({
        userId: getCurrentUserId(),
        username: 'You',
        markings: yourData.markings || {},
        labels: yourData.labels || [],
      });
    }

    // Waza name display toggle
    const nameToggleHtml =
      '<div class="cmp-controls" style="margin-bottom:12px">' +
      '<span style="font-size:12px;color:var(--text3);margin-right:8px">Waza names:</span>' +
      '<div class="seg-pill">' +
      '<button class="seg-item' +
      (wazaNameDisplay === 'both' ? ' on' : '') +
      '" data-display="both">Both</button>' +
      '<button class="seg-item' +
      (wazaNameDisplay === 'jp' ? ' on' : '') +
      '" data-display="jp">JP</button>' +
      '<button class="seg-item' +
      (wazaNameDisplay === 'en' ? ' on' : '') +
      '" data-display="en">EN</button>' +
      '</div>' +
      '</div>';

    matrixHtml =
      nameToggleHtml +
      buildCompareMatrixHTML(allWazaIds, membersData, getCurrentUserId(), {
        editMode,
        wazaNameDisplay,
        emptyMessage: 'No waza have been marked by the selected members.',
      });
  } else if (hasSelection && !getBulkCompareData()) {
    matrixHtml =
      '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">Loading comparison data…</div>';
  } else {
    matrixHtml =
      '<div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">Select a source and add lists to compare.</div>';
  }

  return controlsHtml + matrixHtml;
}

/**
 * @brief Wires all event listeners for the "Bulk Compare" body.
 *
 * @param {HTMLElement} container - The #dashCompare element.
 * @return {void}
 */
function wireBulkContent(container) {
  // ── Source type selector ─────────────────────────────────
  container.querySelector('#cmpBulkSourceType')?.addEventListener('change', (e) => {
    setBulkCompareSourceType(e.target.value || null);
    setBulkCompareGroupId(null);
    setBulkCompareSelectedUserIds([]);
    setBulkCompareSelectedListKeys([]);
    setBulkCompareData(null);
    renderDashCompare();
  });

  // ── Group selection → load members ───────────────────────
  container.querySelector('#cmpBulkGroupSelect')?.addEventListener('change', async (e) => {
    const gid = +e.target.value;
    setBulkCompareGroupId(gid || null);
    setBulkCompareSelectedUserIds([]);
    setBulkCompareData(null);
    if (!gid) {
      renderDashCompare();
      return;
    }

    // Render member checkboxes
    try {
      const members = await api('/api/groups/' + gid + '/members');
      const others = members.filter((m) => m.user_id !== getCurrentUserId());
      renderDashCompare(); // rebuild to show checkboxes

      // After rebuild, inject the member list
      const memberArea = container.querySelector('#cmpBulkMemberArea');
      if (memberArea) {
        memberArea.innerHTML = others
          .map(
            (m) =>
              '<label class="cmp-bulk-member-label">' +
              '<input type="checkbox" class="cmp-bulk-member-cb" value="' +
              m.user_id +
              '"> ' +
              escapeHtml(m.username) +
              (m.tag ? ' (' + escapeHtml(m.tag) + ')' : '') +
              '</label>',
          )
          .join('');

        memberArea.querySelector('button')?.addEventListener('click', async () => {
          const checked = memberArea.querySelectorAll('.cmp-bulk-member-cb:checked');
          const ids = Array.from(checked).map((cb) => +cb.value);
          setBulkCompareSelectedUserIds(ids);
          await loadBulkData();
          renderDashCompare();
        });
      }
    } catch {
      showToast("Couldn't load members.", 'red');
    }
  });

  // ── Imported list "Add" button ───────────────────────────
  container.querySelector('#cmpBulkAddListBtn')?.addEventListener('click', () => {
    const sel = container.querySelector('#cmpBulkListSelect');
    if (!sel || !sel.value) return;
    const current = getBulkCompareSelectedListKeys();
    if (!current.includes(sel.value)) {
      setBulkCompareSelectedListKeys([...current, sel.value]);
    }
    loadBulkData();
    renderDashCompare();
  });

  // ── Edit/Done toggle ─────────────────────────────────────
  container.querySelector('#cmpBulkEditBtn')?.addEventListener('click', () => {
    setBulkCompareEditMode(!isBulkCompareEditMode());
    renderDashCompare();
  });

  // ── Clear All ────────────────────────────────────────────
  container.querySelector('#cmpBulkClearBtn')?.addEventListener('click', () => {
    resetBulkCompareState();
    renderDashCompare();
  });

  // ── Remove column buttons (in edit mode) ─────────────────
  container.querySelectorAll('.cmp-matrix-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = +btn.dataset.uid;
      const current = getBulkCompareSelectedUserIds();
      setBulkCompareSelectedUserIds(current.filter((id) => id !== uid));
      loadBulkData();
      renderDashCompare();
    });
  });

  // ── Waza name display toggle ─────────────────────────────
  container.querySelectorAll('[data-display]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setBulkCompareWazaNameDisplay(btn.dataset.display);
      renderDashCompare();
    });
  });

  // ── Marking toggles in edit mode ─────────────────────────
  if (isBulkCompareEditMode()) {
    wireCompareTableListeners(container);
  }

  // ── Save labels button ───────────────────────────────────
  wireSaveLabelsButton(container);
}

/**
 * @brief Loads bulk comparison data from the current source.
 *
 * Handles both group members (API call) and imported lists (local data).
 * Always includes the current user's own progress.
 *
 * @return {Promise<void>}
 */
async function loadBulkData() {
  const sourceType = getBulkCompareSourceType();
  const data = {};

  // Always include your own progress
  const yourProgress = {};
  Object.entries(state.prog).forEach(([id, p]) => {
    if (p.markings && p.markings.some(Boolean)) {
      yourProgress[id] = p.markings;
    }
  });
  data[getCurrentUserId()] = {
    username: 'You',
    markings: yourProgress,
    labels: state.markingLabels,
  };

  if (sourceType === 'group') {
    const gid = getBulkCompareGroupId();
    const uids = getBulkCompareSelectedUserIds();
    if (!gid || !uids.length) {
      setBulkCompareData(data);
      return;
    }

    try {
      const res = await api('/api/groups/' + gid + '/bulk-progress', 'POST', { user_ids: uids });
      // Merge API response with our data
      Object.entries(res).forEach(([uid, memberData]) => {
        data[+uid] = memberData;
      });
    } catch {
      showToast("Couldn't load group data.", 'red');
    }
  }

  if (sourceType === 'imported') {
    const keys = getBulkCompareSelectedListKeys();
    keys.forEach((key) => {
      const list = getImportedList(key);
      if (list && list.marks) {
        data[key] = {
          username: list.name || 'List ' + key.slice(0, 8),
          markings: {},
          labels: list.labels || [],
        };
        Object.entries(list.marks).forEach(([wazaId, mark]) => {
          data[key].markings[+wazaId] = mark.markings || Array(6).fill(false);
        });
      }
    });
  }

  setBulkCompareData(data);
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
  const bulkBody = buildBulkBody();

  // ── Render both accordion shells ──────────────────────────────
  container.innerHTML =
    buildAccordion('group', 'Compare with Group', groupBody, {
      open: getCompareAccordion() === 'group',
      visible: hasGroups,
    }) +
    buildAccordion('imported', 'Compare with Imported List', importedBody, {
      open: getCompareAccordion() === 'imported',
    }) +
    buildAccordion('bulk', 'Bulk Compare', bulkBody, {
      open: getCompareAccordion() === 'bulk',
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

  // ── Wire content event listeners ──
  wireGroupContent(container);
  wireCompareImportTable(container);
  wireBulkContent(container);

  renderCompareResult();
}
