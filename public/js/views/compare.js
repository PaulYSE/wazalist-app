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
import { SHAPES } from '../config/constants.js';
import { saveLabels, getP, saveP } from '../services/progress.js';
import { showToast } from '../components/show-toast.js';
import { escapeHtml } from '../lib/escape.js';
import { dispName } from '../lib/search.js';
import { markingPips } from '../components/render-helpers.js';
import { navigateToBrowse } from '../app/shell.js';
import { selectWaza } from './waza-detail.js';
import { openImportModal, openExportModal } from '../features/share-list.js';
import { refreshMyGroups } from './groups-browse-list.js';
import { buildAccordion, closeAllAccordions } from '../app/accordion-shell.js';
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

// ── Compare Table Builder ──────────────────────────────────

/**
 * @brief Builds the HTML for a marking labels comparison table.
 *
 * Renders a table comparing marking labels between two users (or just the current user).
 * Displays shape symbols, label inputs, and waza counts. When a second user is provided,
 * shows a two-column layout (their labels read-only, your labels editable).
 *
 * @param {string} title - Section title to display.
 * @param {Object} userFirst - First user's data object containing { labels: string[], counts: number[] }.
 * @param {Object} [userSecond] - Optional second user's data object for two-column comparison.
 * @return {string} HTML string for the labels comparison section.
 */
function buildCompareMarkingLabelsTableHTML(title, userFirst, userSecond) {
  // ── Build the 6 rows ──────────────────────────────────────
  const rowsHtml = SHAPES.map((s, i) => {
    const myLabels = userFirst.labels[i] || '';
    const myCounts = userFirst.counts[i];

    if (userSecond) {
      const theirLabels = userSecond.labels[i] || '';
      const theirCounts = userSecond.counts[i];

      return (
        '<div class="cmp-labels-row">' +
        // Marking symbol
        '<span class="cmp-labels-marking">' +
        s +
        '</span>' +
        // Their label (read-only)
        '<div class="cmp-labels-their">' +
        (theirLabels
          ? '<span class="label-names">' + escapeHtml(theirLabels) + '</span>'
          : '<span class="label-unset">Unlabelled</span>') +
        '<span class="cmp-labels-count">' +
        theirCounts +
        ' waza</span>' +
        '</div>' +
        // Your label (editable input)
        '<div class="cmp-labels-mine">' +
        '<input class="cmp-labels-input" data-si="' +
        i +
        '" type="text" maxlength="32" placeholder="Your Marking Label…" value="' +
        myLabels.replace(/"/g, '&quot;') +
        '">' +
        '<span class="cmp-labels-count">' +
        myCounts +
        ' waza</span>' +
        '</div>' +
        '</div>'
      );
    } else {
      // Single-column: just your label (editable) with count
      return (
        '<div class="cmp-labels-row cmp-labels-row-solo">' +
        '<span class="cmp-labels-marking">' +
        s +
        '</span>' +
        '<div class="cmp-labels-mine">' +
        '<input class="cmp-labels-input" data-si="' +
        i +
        '" type="text" maxlength="32" placeholder="Label this Marking…" value="' +
        myLabels.replace(/"/g, '&quot;') +
        '">' +
        '<span class="cmp-labels-count">' +
        myCounts +
        ' waza</span>' +
        '</div>' +
        '</div>'
      );
    }
  }).join('');

  // ── Save Marking Labels Button ──────────────────────────────────────
  const saveBtnRow =
    '<div class="cmp-labels-actions">' +
    '<button class="btn" id="cmpSaveLabelsBtn">Save Marking Labels</button>' +
    '</div>';

  // ── Assemble the full section ──────────────────────────────
  return (
    '<div class="dsec2">' +
    '<h3>' +
    escapeHtml(title) +
    '</h3>' +
    '<div class="cmp-labels-table">' +
    rowsHtml +
    '</div>' +
    saveBtnRow +
    '</div>'
  );
}

/**
 * @brief Wires the "Save Marking Labels" button inside a container.
 *
 * Reads all .cmp-labels-input values, writes them to state.markingLabels,
 * persists via saveLabels(), and shows a toast.
 *
 * @param {HTMLElement} container - DOM element containing #cmpSaveLabelsBtn and .cmp-labels-input elements.
 * @return {void}
 */
function wireSaveLabelsButton(container) {
  container.querySelector('#cmpSaveLabelsBtn')?.addEventListener('click', () => {
    container.querySelectorAll('.cmp-labels-input').forEach((inp) => {
      state.markingLabels[+inp.dataset.si] = inp.value;
    });
    saveLabels();
    showToast('Marking Labels saved', 'green');
  });
}

/**
 * @brief Builds an HTML string for the waza comparison rows table.
 *
 * Renders column headers ("Waza", theirLabel, "Your marks") and a row per waza.
 * Each row shows the waza names, their marking pips (read-only), and your marking
 * toggle buttons (interactive — wiring happens after render via wireCompareListeners).
 *
 * @param {Set<number>}              wazaIds       - Set of waza IDs to display.
 * @param {Object<number, boolean[]>} theirMarkings - Map of wazaId → marking booleans.
 * @param {string}                   theirName    - Text for the "their" column header.
 * @param {string}                   emptyMessage  - Message shown when no waza have marks.
 * @return {string} HTML string for the comparison table (col-headers + rows).
 */
function buildCompareMarkingTableRowsHTML(wazaIds, theirMarkings, theirName, emptyMessage) {
  const rows = state.wazaData.filter((w) => wazaIds.has(w.id));

  // ── Empty state ───────────────────────────────────────────
  if (!rows.length) {
    return '<div class="cmp-empty">' + emptyMessage + '</div>';
  }

  // ── Column headers ────────────────────────────────────────
  const colHeaders =
    '<div class="cmp-col-headers">' +
    '<span>Waza</span>' +
    '<span>' +
    escapeHtml(theirName) +
    '</span>' +
    '<span>Your marks</span>' +
    '</div>';

  // ── Rows ──────────────────────────────────────────────────
  const rowsHtml = rows
    .map((w) => {
      const theirs = theirMarkings[w.id] || Array(6).fill(false);
      const mine = (getP(w.id).markings || Array(6).fill(false)).slice();

      return (
        '<div class="cmp-row" data-id="' +
        w.id +
        '">' +
        '<div class="cmp-names">' +
        '<div class="cmp-name-jp">' +
        escapeHtml(w.name_jp || '—') +
        '</div>' +
        '<div class="cmp-name-en">' +
        escapeHtml(dispName(w)) +
        '</div>' +
        '</div>' +
        '<div class="cmp-markings-imported">' +
        markingPips(theirs) +
        '</div>' +
        '<div class="cmp-mark-pill">' +
        SHAPES.map(
          (s, i) =>
            '<button class="cmp-mark-seg' +
            (mine[i] ? ' on' : '') +
            '" data-wid="' +
            w.id +
            '" data-si="' +
            i +
            '" title="' +
            escapeHtml(state.markingLabels[i] || 'Marking ' + (i + 1)) +
            '">' +
            s +
            '</button>',
        ).join('') +
        '</div></div>'
      );
    })
    .join('');

  return colHeaders + rowsHtml;
}

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
 * @brief Wires marking toggles and row-click navigation inside a container.
 *
 * Call this after setting innerHTML that contains .cmp-mark-seg buttons
 * and .cmp-row elements. Safe to call multiple times — uses querySelectorAll
 * which only targets elements present at call time.
 *
 * @param {HTMLElement} container - DOM element containing compare rows.
 * @return {void}
 */
function wireCompareTableListeners(container) {
  // ── Marking toggles ────────────────────────────────────
  container.querySelectorAll('.cmp-mark-seg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = +btn.dataset.wid;
      const si = +btn.dataset.si;
      const ns = (getP(wid).markings || Array(6).fill(false)).slice();
      ns[si] = !ns[si];
      btn.classList.toggle('on', ns[si]);
      saveP(wid, { markings: ns });
    });
  });

  // ── Row clicks → navigate to Browse ────────────────────
  container.querySelectorAll('.cmp-row').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.cmp-mark-pill')) return;
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });
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
        el.classList.add('collapsed');
        el.nextElementSibling?.classList.remove('open');
      } else {
        closeAllAccordions(container);
        el.classList.remove('collapsed');
        el.nextElementSibling?.classList.add('open');
      }
    });
  });

  // ── Wire content event listeners (only for the open section) ──
  wireGroupContent(container);
  wireCompareImportTable(container);

  renderCompareResult();
}
