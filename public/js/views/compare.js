/**
 * @file compare.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
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
import {
  openImportModal,
  importedLists,
  saveImported,
  openExportModal,
} from '../features/share-list.js';
import { refreshMyGroups } from './groups.js';

// ── Group comparison section ──────────────────────────────────

/**
 * @brief Builds the inner HTML for the "Compare with Group" accordion body.
 *
 * Only the group/member selects and a result container are rendered here.
 * The actual member list is fetched lazily when the user picks a group,
 * so this stays synchronous and fast.
 *
 * @param {boolean} loggedIn - Whether the current user is authenticated.
 * @return {string} HTML string.
 */
function buildGroupBody(loggedIn) {
  if (!loggedIn) {
    return (
      '<div style="font-size:13px;color:var(--text3)">' +
      'Sign in to compare with Group members.' +
      '</div>'
    );
  }

  return (
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +

    // Group picker — populated from state.myGroups (already loaded)
    '<select id="cmpGroupSelect" class="cmp-select" style="min-width:160px">' +
    '<option value="">— Select a Group —</option>' +
    state.myGroups.map(g =>
      '<option value="' + g.id + '">' + escapeHtml(g.name) + '</option>'
    ).join('') +
    '</select>' +

    // Member picker — starts disabled; populated after group is chosen
    '<select id="cmpMemberSelect" class="cmp-select" style="min-width:160px" disabled>' +
    '<option value="">— Select a member —</option>' +
    '</select>' +

    // Compare button — starts disabled until a member is chosen
    '<button class="btn" id="cmpGroupLoadBtn" disabled>Compare</button>' +
    '</div>' +

    // Result area — filled by wireGroupContent() after the API call
    '<div id="cmpGroupResult" style="margin-top:12px"></div>'
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
  const groupSel  = container.querySelector('#cmpGroupSelect');
  const memberSel = container.querySelector('#cmpMemberSelect');
  const loadBtn   = container.querySelector('#cmpGroupLoadBtn');

  // None of these elements exist when the accordion is closed — safe to bail.
  if (!groupSel || !memberSel || !loadBtn) return;

  // ── Group selection → fetch members ──────────────────────────
  groupSel.addEventListener('change', async () => {
    const gid = +groupSel.value;
    memberSel.innerHTML = '<option value="">Loading…</option>';
    memberSel.disabled  = true;
    loadBtn.disabled    = true;

    if (!gid) {
      memberSel.innerHTML = '<option value="">— Select a member —</option>';
      return;
    }

    try {
      const members = await api('/api/groups/' + gid + '/members');
      const others  = members.filter(m => m.user_id !== state.currentUserId);
      memberSel.innerHTML =
        '<option value="">— Select a member —</option>' +
        others.map(m =>
          '<option value="' + m.user_id + '">' +
          escapeHtml(m.username) +
          (m.tag ? ' (' + escapeHtml(m.tag) + ')' : '') +
          '</option>'
        ).join('');
      memberSel.disabled = false;
    } catch {
      memberSel.innerHTML = '<option value="">Couldn\'t load members</option>';
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

    loadBtn.disabled    = true;
    loadBtn.textContent = 'Loading…';
    const resultEl      = container.querySelector('#cmpGroupResult');
    resultEl.innerHTML  =
      '<div style="color:var(--text3);font-size:13px">Loading…</div>';

    try {
      const data = await api(
        '/api/groups/' + gid + '/members/' + uid + '/progress'
      );

      if (data.error) {
        resultEl.innerHTML =
          '<div style="color:var(--red);font-size:13px">' +
          escapeHtml(data.error) + '</div>';
        loadBtn.disabled    = false;
        loadBtn.textContent = 'Compare';
        return;
      }

      const memberName  = memberSel.options[memberSel.selectedIndex].text;
      const importedIds = new Set(Object.keys(data.markings).map(Number));
      const rows        = state.wazaData.filter(w => importedIds.has(w.id));

      if (!rows.length) {
        resultEl.innerHTML =
          '<div style="color:var(--text3);font-size:13px">' +
          escapeHtml(memberName) + ' hasn\'t marked any Waza yet.</div>';
        loadBtn.disabled    = false;
        loadBtn.textContent = 'Compare';
        return;
      }

      // ── Labels side-by-side ──────────────────────────────────
      const theirLabels   = data.labels || Array(6).fill('');
      const memberLabelsHtml =
        '<div class="dsec2"><h3>Marking Labels — ' +
        escapeHtml(memberName) + '</h3>' +
        '<div class="cmp-labels-table">' +
        SHAPES.map((s, i) => {
          const theirLabel = theirLabels[i] || '';
          const myLabel    = state.markingLabels[i] || '';
          return (
            '<div class="cmp-labels-row">' +
            '<span class="cmp-labels-marking">' + s + '</span>' +
            '<div class="cmp-labels-their">' +
            (theirLabel
              ? escapeHtml(theirLabel)
              : '<span class="cmp-labels-unset">Unlabelled</span>') +
            '</div>' +
            '<div class="cmp-labels-mine">' +
            '<span style="font-size:13px;color:var(--text2)">' +
            escapeHtml(myLabel || '(unlabelled)') +
            '</span></div></div>'
          );
        }).join('') +
        '</div></div>';

      // ── Waza comparison rows ──────────────────────────────────
      const colHeaders =
        '<div class="cmp-col-headers"><span>Waza</span>' +
        '<span>' + escapeHtml(memberName) + '</span>' +
        '<span>Your marks</span></div>';

      const rowsHtml = rows.map(w => {
        const theirMark     = data.markings[w.id] || { markings: Array(6).fill(false) };
        const myMarkings    = (getP(w.id).markings || Array(6).fill(false)).slice();
        const theirMarkings = theirMark.markings || Array(6).fill(false);
        return (
          '<div class="cmp-row" data-id="' + w.id + '">' +
          '<div class="cmp-names">' +
          '<div class="cmp-name-jp">' + escapeHtml(w.name_jp || '—') + '</div>' +
          '<div class="cmp-name-en">' + escapeHtml(dispName(w)) + '</div>' +
          '</div>' +
          '<div class="cmp-markings-imported">' + markingPips(theirMarkings) + '</div>' +
          '<div class="cmp-mark-pill">' +
          SHAPES.map((s, i) =>
            '<button class="cmp-mark-seg' + (myMarkings[i] ? ' on' : '') +
            '" data-wid="' + w.id + '" data-si="' + i +
            '" title="' + escapeHtml(state.markingLabels[i] || 'Marking ' + (i + 1)) +
            '">' + s + '</button>'
          ).join('') +
          '</div></div>'
        );
      }).join('');

      resultEl.innerHTML = memberLabelsHtml + colHeaders + rowsHtml;

      // Wire mark toggles inside the result
      resultEl.querySelectorAll('.cmp-mark-seg').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const wid = +btn.dataset.wid, si = +btn.dataset.si;
          const ns  = (getP(wid).markings || Array(6).fill(false)).slice();
          ns[si]    = !ns[si];
          btn.classList.toggle('on', ns[si]);
          saveP(wid, { markings: ns });
        });
      });

      // Clicking a row navigates to that waza in the Browse tab
      resultEl.querySelectorAll('.cmp-row').forEach(el => {
        el.addEventListener('click', e => {
          if (e.target.closest('.cmp-mark-pill')) return;
          navigateToBrowse();
          selectWaza(+el.dataset.id);
        });
      });

    } catch {
      resultEl.innerHTML =
        '<div style="color:var(--red);font-size:13px">' +
        'Couldn\'t load this member\'s list.</div>';
    }

    loadBtn.disabled    = false;
    loadBtn.textContent = 'Compare';
  });
}

// ── Module-level state ────────────────────────────────────────
/** @brief Key of the currently displayed imported list. */
let compareSelectedKey = null;

/**
 * @brief Which accordion is currently open.
 * 'group' | 'imported' | null (both collapsed)
 */
let activeAccordion = null;


// ── Data helpers ──────────────────────────────────────────────

/**
 * @brief Wipes all active comparison state.
 *
 * Called whenever an accordion is closed or switched so the next
 * accordion always starts with a blank slate.
 *
 * @return {void}
 */
function clearCompareData() {
  compareSelectedKey = null;
  // Visual clearing is handled by the next renderDashCompare() call.
  // No DOM manipulation needed here — keeping this function pure.
}

/**
 * @brief Toggles an accordion open or closed (mutually exclusive).
 *
 * Rules:
 *   - Clicking the open accordion → close it, clear data.
 *   - Clicking a closed accordion → clear data, close the other, open this one.
 *
 * @param {string} key - 'group' | 'imported'
 * @return {void}
 */
function toggleAccordion(key) {
  if (activeAccordion === key) {
    // User clicked the currently open accordion — close it.
    clearCompareData();
    activeAccordion = null;
  } else {
    // User clicked a different accordion — switch.
    clearCompareData();
    activeAccordion = key;
  }
  renderDashCompare();
}

/**
 * @brief Builds the HTML string for one accordion panel.
 *
 * Reuses the existing .dsec-toggle / .acc-body pattern used by
 * the Stats and Account tabs. The arrow rotates via CSS when the
 * 'collapsed' class is present on the toggle.
 *
 * @param {string}  key      - Identifier stored in data-acc (e.g. 'group').
 * @param {string}  label    - Text shown in the accordion header.
 * @param {boolean} visible  - False → wraps the whole thing in display:none.
 * @param {boolean} open     - True → body has the .open class (expanded).
 * @param {string}  bodyHtml - Inner HTML rendered inside the body when open.
 * @return {string} HTML string.
 */
function accShell(key, label, visible, open, bodyHtml) {
  return (
    // Outer wrapper: hidden entirely when visible = false (e.g. no groups)
    '<div class="dsec2"' + (visible ? '' : ' style="display:none"') + '>' +

    // Header row — clicking this fires toggleAccordion(key)
    '<div class="dsec-toggle cmp-acc-toggle' + (open ? '' : ' collapsed') +
    '" data-acc="' + key + '">' +
    '<h3 style="margin-bottom:0;border-bottom:none;padding-bottom:0">' +
    label + '</h3>' +
    '<span class="toggle-arrow">▾</span>' +  // rotates via CSS .collapsed rule
    '</div>' +

    // Collapsible body — .open triggers the grid 0fr→1fr animation in panels.css
    '<div class="acc-body' + (open ? ' open' : '') + '">' +
    '<div class="acc-body-inner"><div class="acc-body-box">' +
    bodyHtml +
    '</div></div></div>' +

    '</div>'
  );
}

/**
 * @brief Builds the inner HTML for the "Compare with Imported List" accordion body.
 *
 * Renders the list selector controls, the marking-labels comparison table,
 * and the side-by-side waza rows — all from in-memory state (fast, synchronous).
 *
 * @return {string} HTML string.
 */
function buildImportedBody() {
  const keys = Object.keys(importedLists);

  // Keep compareSelectedKey valid
  if (compareSelectedKey && !importedLists[compareSelectedKey]) compareSelectedKey = null;
  if (!compareSelectedKey && keys.length) compareSelectedKey = keys[0];

  const imp = compareSelectedKey ? importedLists[compareSelectedKey] : null;

  // ── Controls ──────────────────────────────────────────────────
  const listOpts = keys.map(k =>
    '<option value="' + escapeHtml(k) + '"' +
    (k === compareSelectedKey ? ' selected' : '') + '>' +
    escapeHtml(importedLists[k].name) + '</option>'
  ).join('');

  const controlsHtml =
    '<div class="cmp-controls">' +
    '<select class="cmp-select" id="cmpSelect">' +
    '<option value="">— select a list —</option>' + listOpts +
    '</select>' +
    (compareSelectedKey
      ? '<button class="btn cmp-ctrl-remove" id="cmpRemoveBtn">Remove</button>'
      : '') +
    '<button class="btn" id="cmpImportBtn">↓ Import List</button>' +
    '<button class="btn" id="cmpExportBtn">↑ Export My List</button>' +
    '</div>';

  // ── Marking counts (for label badges) ─────────────────────────
  const impMarkingCounts = Array(6).fill(0);
  const myMarkingCounts  = Array(6).fill(0);

  if (imp && imp.marks) {
    Object.values(imp.marks).forEach(mark => {
      if (mark.markings)
        mark.markings.forEach((on, i) => { if (on) impMarkingCounts[i]++; });
    });
    const importedIds = new Set(Object.keys(imp.marks).map(Number));
    state.wazaData.forEach(w => {
      if (!importedIds.has(w.id)) return;
      const p = getP(w.id);
      if (p.markings) p.markings.forEach((on, i) => { if (on) myMarkingCounts[i]++; });
    });
  } else {
    state.wazaData.forEach(w => {
      const p = getP(w.id);
      if (p.markings) p.markings.forEach((on, i) => { if (on) myMarkingCounts[i]++; });
    });
  }

  // ── Labels table ──────────────────────────────────────────────
  const saveBtnRow =
    '<div class="cmp-labels-actions">' +
    '<button class="btn" id="cmpSaveLabelsBtn">Save Marking Labels</button>' +
    '</div>';

  let labelsHtml;
  if (imp) {
    // Two-column: their label vs your editable label
    labelsHtml =
      '<div class="dsec2"><h3>Marking Labels comparison</h3>' +
      '<div class="cmp-labels-table">' +
      SHAPES.map((s, i) => {
        const impLabel = imp.labels && imp.labels[i] ? imp.labels[i] : '';
        const myLabel  = state.markingLabels[i] || '';
        return (
          '<div class="cmp-labels-row">' +
          '<span class="cmp-labels-marking">' + s + '</span>' +
          '<div class="cmp-labels-their">' +
          (impLabel
            ? escapeHtml(impLabel)
            : '<span class="cmp-labels-unset">Unlabelled</span>') +
          '<span class="cmp-labels-count">' + impMarkingCounts[i] + '</span>' +
          '</div>' +
          '<div class="cmp-labels-mine">' +
          '<input class="cmp-labels-input" data-si="' + i +
          '" type="text" maxlength="32" placeholder="Your Marking Label…" value="' +
          myLabel.replace(/"/g, '&quot;') + '">' +
          '<span class="cmp-labels-count">' + myMarkingCounts[i] + '</span>' +
          '</div></div>'
        );
      }).join('') +
      '</div>' + saveBtnRow + '</div>';
  } else {
    // Single-column: just your labels (no imported list selected)
    labelsHtml =
      '<div class="dsec2"><h3>My Marking Labels</h3>' +
      '<div class="cmp-labels-table">' +
      SHAPES.map((s, i) =>
        '<div class="cmp-labels-row cmp-labels-row-solo">' +
        '<span class="cmp-labels-marking">' + s + '</span>' +
        '<div class="cmp-labels-mine">' +
        '<input class="cmp-labels-input" data-si="' + i +
        '" type="text" maxlength="32" placeholder="Label this Marking…" value="' +
        state.markingLabels[i].replace(/"/g, '&quot;') + '">' +
        '<span class="cmp-labels-count">' + myMarkingCounts[i] + ' waza</span>' +
        '</div></div>'
      ).join('') +
      '</div>' + saveBtnRow + '</div>';
  }

  // ── Comparison rows ───────────────────────────────────────────
  let rowsSection;
  if (!keys.length) {
    rowsSection =
      '<div class="cmp-empty">No imported lists yet.<br>' +
      'Use <b>↓ Import List</b> to add one.</div>';
  } else {
    const importedIds = imp
      ? new Set(Object.keys(imp.marks).map(Number))
      : new Set();
    const rows = state.wazaData.filter(w => importedIds.has(w.id));

    const colHeaders =
      '<div class="cmp-col-headers">' +
      '<span>Waza</span><span>Their marks</span><span>Your marks</span>' +
      '</div>';

    const rowsHtml = rows.map(w => {
      const importedMark =
        imp ? imp.marks[w.id] || { markings: Array(6).fill(false) }
            : { markings: Array(6).fill(false) };
      const myMarkings   = (getP(w.id).markings || Array(6).fill(false)).slice();
      const impMarkings  = importedMark.markings || Array(6).fill(false);
      return (
        '<div class="cmp-row" data-id="' + w.id + '">' +
        '<div class="cmp-names">' +
        '<div class="cmp-name-jp">' + escapeHtml(w.name_jp || '—') + '</div>' +
        '<div class="cmp-name-en">' + escapeHtml(dispName(w)) + '</div>' +
        '</div>' +
        '<div class="cmp-markings-imported">' + markingPips(impMarkings) + '</div>' +
        '<div class="cmp-mark-pill">' +
        SHAPES.map((s, i) =>
          '<button class="cmp-mark-seg' + (myMarkings[i] ? ' on' : '') +
          '" data-wid="' + w.id + '" data-si="' + i +
          '" title="' + escapeHtml(state.markingLabels[i] || 'Marking ' + (i + 1)) +
          '">' + s + '</button>'
        ).join('') +
        '</div></div>'
      );
    }).join('');

    const empty = !rows.length
      ? '<div class="cmp-empty">This list has no marks.</div>'
      : '';
    rowsSection = (rows.length ? colHeaders : '') + rowsHtml + empty;
  }

  return controlsHtml + labelsHtml + rowsSection;
}

/**
 * @brief Wires all event listeners for the "Compare with Imported List" body.
 *
 * @param {HTMLElement} container - The #dashCompare element.
 * @return {void}
 */
function wireImportedContent(container) {
  container.querySelector('#cmpExportBtn')
    ?.addEventListener('click', openExportModal);

  container.querySelector('#cmpImportBtn')
    ?.addEventListener('click', () => openImportModal());

  container.querySelector('#cmpSaveLabelsBtn')
    ?.addEventListener('click', () => {
      container.querySelectorAll('.cmp-labels-input').forEach(inp => {
        state.markingLabels[+inp.dataset.si] = inp.value;
      });
      saveLabels();
      showToast('Marking Labels saved', 'green');
    });

  // List picker — re-render the whole tab to reflect the new selection
  container.querySelector('#cmpSelect')
    ?.addEventListener('change', e => {
      compareSelectedKey = e.target.value || null;
      renderDashCompare();
    });

  // Remove button — deletes from localStorage and re-renders
  container.querySelector('#cmpRemoveBtn')
    ?.addEventListener('click', () => {
      if (!compareSelectedKey) return;
      const name = importedLists[compareSelectedKey].name;
      if (!confirm('Remove "' + name + '" from your imported lists?')) return;
      delete importedLists[compareSelectedKey];
      saveImported(importedLists);
      compareSelectedKey = null;
      renderDashCompare();
    });

  // Marking toggle — in-place, no full re-render (preserves scroll + labels)
  container.querySelectorAll('.cmp-mark-seg').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wid = +btn.dataset.wid, si = +btn.dataset.si;
      const ns  = (getP(wid).markings || Array(6).fill(false)).slice();
      ns[si]    = !ns[si];
      btn.classList.toggle('on', ns[si]);
      saveP(wid, { markings: ns });
    });
  });

  // Row click — navigate to that waza
  container.querySelectorAll('.cmp-row').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.cmp-mark-pill')) return;
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });
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
  const loggedIn  = !state.isGuest && !!state.token;

  // Re-check group membership every time the Compare tab is opened.
  // refreshMyGroups() is a no-op if already loaded; we reset the flag
  // to force a fresh fetch each time so the accordion visibility is current.
  state.myGroupsLoaded = false;
  await refreshMyGroups();
  const hasGroups = loggedIn && state.myGroups && state.myGroups.length > 0;

  // If the group accordion was open but the user no longer has groups
  // (e.g. they left their last group), collapse it silently.
  if (activeAccordion === 'group' && !hasGroups) {
    clearCompareData();
    activeAccordion = null;
  }

  // ── Build accordion bodies (only when open — avoids rendering heavy
  //    row lists that would never be visible while collapsed) ──────
  const groupBody    = activeAccordion === 'group'
    ? buildGroupBody(loggedIn)
    : '';

  const importedBody = activeAccordion === 'imported'
    ? buildImportedBody()
    : '';

  // ── Render both accordion shells ──────────────────────────────
  container.innerHTML =
    accShell('group',    'Compare with Group',        hasGroups, activeAccordion === 'group',    groupBody)    +
    accShell('imported', 'Compare with Imported List', true,     activeAccordion === 'imported', importedBody);

  // ── Wire accordion toggle buttons ─────────────────────────────
  container.querySelectorAll('.cmp-acc-toggle').forEach(el => {
    el.addEventListener('click', () => toggleAccordion(el.dataset.acc));
  });

  // ── Wire content event listeners (only for the open section) ──
  if (activeAccordion === 'group')    wireGroupContent(container);
  if (activeAccordion === 'imported') wireImportedContent(container);
}
