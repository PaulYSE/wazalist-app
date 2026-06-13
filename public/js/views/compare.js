/**
 * @file compare.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Compare tab view. Centralized top controls, label comparison editor, and side-by-side marks (their pips vs. your segmented mark-pill) with in-place toggling.
 */

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
 * @brief Renders the Group→member comparison section above the key-import flow.
 *
 * @param {HTMLElement} container - The dashCompare container element.
 * @return {Promise<void>}
 */
async function renderGroupCompareSection(container) {
  const loggedIn = !state.isGuest && !!state.token;
  const section = document.createElement('div');
  section.id = 'groupCompareSection';
  section.className = 'dsec2';
  container.prepend(section);

  if (!loggedIn) return; // guests see nothing here

  // Ensure myGroups is loaded
  if (!state.myGroupsLoaded) await refreshMyGroups();

  if (!state.myGroups.length) {
    section.innerHTML =
      '<h3>Compare with a Group member</h3>' +
      '<div style="font-size:13px;color:var(--text3)">Join a Group to compare your Wazalist with its members.</div>';
    return;
  }

  section.innerHTML =
    '<h3>Compare with a Group member</h3>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
    '<select id="cmpGroupSelect" class="cmp-select" style="min-width:160px">' +
    '<option value="">— Select a Group —</option>' +
    state.myGroups
      .map((g) => '<option value="' + g.id + '">' + escapeHtml(g.name) + '</option>')
      .join('') +
    '</select>' +
    '<select id="cmpMemberSelect" class="cmp-select" style="min-width:160px" disabled>' +
    '<option value="">— Select a member —</option>' +
    '</select>' +
    '<button class="btn" id="cmpGroupLoadBtn" disabled>Compare</button>' +
    '</div>' +
    '<div id="cmpGroupResult" style="margin-top:12px"></div>';

  const groupSel = section.querySelector('#cmpGroupSelect');
  const memberSel = section.querySelector('#cmpMemberSelect');
  const loadBtn = section.querySelector('#cmpGroupLoadBtn');

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
      const others = members.filter((m) => m.user_id !== state.currentUserId);
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
    } catch (e) {
      memberSel.innerHTML = '<option value="">Couldn\'t load members</option>';
    }
  });

  memberSel.addEventListener('change', () => {
    loadBtn.disabled = !memberSel.value;
  });

  loadBtn.addEventListener('click', async () => {
    const gid = +groupSel.value;
    const uid = +memberSel.value;
    if (!gid || !uid) return;

    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading…';
    const resultEl = section.querySelector('#cmpGroupResult');
    resultEl.innerHTML = '<div style="color:var(--text3);font-size:13px">Loading…</div>';

    try {
      const data = await api('/api/groups/' + gid + '/members/' + uid + '/progress');
      if (data.error) {
        resultEl.innerHTML =
          '<div style="color:var(--red);font-size:13px">' + escapeHtml(data.error) + '</div>';
        loadBtn.disabled = false;
        loadBtn.textContent = 'Compare';
        return;
      }

      // Find member name for display
      const memberName = memberSel.options[memberSel.selectedIndex].text;

      // Render comparison using the same structure as the key-import rows
      const importedIds = new Set(Object.keys(data.markings).map(Number));
      const rows = state.wazaData.filter((w) => importedIds.has(w.id));

      if (!rows.length) {
        resultEl.innerHTML =
          '<div style="color:var(--text3);font-size:13px">' +
          escapeHtml(memberName) +
          " hasn't marked any Waza yet.</div>";
        loadBtn.disabled = false;
        loadBtn.textContent = 'Compare';
        return;
      }

      // Labels comparison
      const theirLabels = data.labels || Array(6).fill('');
      const labelsHtml =
        '<div class="dsec2"><h3>Marking Labels — ' +
        escapeHtml(memberName) +
        '</h3>' +
        '<div class="cmp-labels-table">' +
        SHAPES.map((s, i) => {
          const theirLabel = theirLabels[i] || '';
          const myLabel = state.markingLabels[i] || '';
          return (
            '<div class="cmp-labels-row">' +
            '<span class="cmp-labels-marking">' +
            s +
            '</span>' +
            '<div class="cmp-labels-their">' +
            (theirLabel
              ? escapeHtml(theirLabel)
              : '<span class="cmp-labels-unset">Unlabelled</span>') +
            '</div>' +
            '<div class="cmp-labels-mine">' +
            '<span style="font-size:13px;color:var(--text2)">' +
            escapeHtml(myLabel || '(unlabelled)') +
            '</span>' +
            '</div>' +
            '</div>'
          );
        }).join('') +
        '</div></div>';

      // Waza rows
      const colHeaders =
        '<div class="cmp-col-headers"><span>Waza</span><span>' +
        escapeHtml(memberName) +
        '</span><span>Your marks</span></div>';

      const rowsHtml = rows
        .map((w) => {
          const theirMark = data.markings[w.id] || { markings: Array(6).fill(false) };
          const myMarkings = (getP(w.id).markings || Array(6).fill(false)).slice();
          const theirMarkings = theirMark.markings || Array(6).fill(false);
          return (
            '<div class="cmp-row" data-id="' +
            w.id +
            '">' +
            '<div class="cmp-names"><div class="cmp-name-jp">' +
            escapeHtml(w.name_jp || '—') +
            '</div>' +
            '<div class="cmp-name-en">' +
            escapeHtml(dispName(w)) +
            '</div></div>' +
            '<div class="cmp-markings-imported">' +
            markingPips(theirMarkings) +
            '</div>' +
            '<div class="cmp-mark-pill">' +
            SHAPES.map(
              (s, i) =>
                '<button class="cmp-mark-seg' +
                (myMarkings[i] ? ' on' : '') +
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

      resultEl.innerHTML = labelsHtml + colHeaders + rowsHtml;

      // Wire marking toggles
      resultEl.querySelectorAll('.cmp-mark-seg').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wid = +btn.dataset.wid;
          const si = +btn.dataset.si;
          const cur = getP(wid);
          const ns = (cur.markings || Array(6).fill(false)).slice();
          ns[si] = !ns[si];
          btn.classList.toggle('on', ns[si]);
          saveP(wid, { markings: ns });
        });
      });

      // Wire row clicks → browse
      resultEl.querySelectorAll('.cmp-row').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.cmp-mark-pill')) return;
          navigateToBrowse();
          selectWaza(+el.dataset.id);
        });
      });
    } catch (e) {
      console.error('Group compare load failed:', e);
      resultEl.innerHTML =
        '<div style="color:var(--red);font-size:13px">Couldn\'t load this member\'s list.</div>';
    }

    loadBtn.disabled = false;
    loadBtn.textContent = 'Compare';
  });
}

// ── Compare tab ───────────────────────────────────────────────

let compareSelectedKey = null;

/**
 * @brief Renders the compare tab: centralized controls, label editor, and rows.
 *
 * @return {void}
 */
export async function renderDashCompare() {
  const container = document.getElementById('dashCompare');
  container.innerHTML = ''; // clear before rebuild
  await renderGroupCompareSection(container);

  const keys = Object.keys(importedLists);

  if (compareSelectedKey && !importedLists[compareSelectedKey]) compareSelectedKey = null;
  if (!compareSelectedKey && keys.length) compareSelectedKey = keys[0];

  const imp = compareSelectedKey ? importedLists[compareSelectedKey] : null;

  // ── Top controls bar (centralized: picker, remove, import, export) ──
  const headerOpts = keys
    .map(
      (k) =>
        '<option value="' +
        escapeHtml(k) +
        '"' +
        (k === compareSelectedKey ? ' selected' : '') +
        '>' +
        escapeHtml(importedLists[k].name) +
        '</option>',
    )
    .join('');
  const controlsHtml =
    '<div class="cmp-controls">' +
    '<select class="cmp-select" id="cmpSelect">' +
    '<option value="">— select a list —</option>' +
    headerOpts +
    '</select>' +
    (compareSelectedKey
      ? '<button class="btn cmp-ctrl-remove" id="cmpRemoveBtn">Remove</button>'
      : '') +
    '<button class="btn" id="cmpImportBtn">↓ Import List</button>' +
    '<button class="btn" id="cmpExportBtn">↑ Export My List</button>' +
    '</div>';

  // ── Label counts (per side) ──────────────────────────────────
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
      if (importedIds.has(w.id)) {
        const p = getP(w.id);
        if (p.markings)
          p.markings.forEach((on, i) => {
            if (on) myMarkingCounts[i]++;
          });
      }
    });
  } else {
    state.wazaData.forEach((w) => {
      const p = getP(w.id);
      if (p.markings)
        p.markings.forEach((on, i) => {
          if (on) myMarkingCounts[i]++;
        });
    });
  }

  // ── Labels comparison block ──────────────────────────────────
  const saveBtnRow =
    '<div class="cmp-labels-actions">' +
    '<button class="btn" id="cmpSaveLabelsBtn">Save Marking Labels</button>' +
    '</div>';

  let labelsHtml;
  if (imp) {
    labelsHtml =
      '<div class="dsec2"><h3>Marking Labels comparison</h3>' +
      '<div class="cmp-labels-table">' +
      SHAPES.map((s, i) => {
        const impLabel = imp.labels && imp.labels[i] ? imp.labels[i] : '';
        const myLabel = state.markingLabels[i] || '';
        return (
          '<div class="cmp-labels-row">' +
          '<span class="cmp-labels-marking">' +
          s +
          '</span>' +
          '<div class="cmp-labels-their">' +
          (impLabel ? escapeHtml(impLabel) : '<span class="cmp-labels-unset">Unlabelled</span>') +
          '<span class="cmp-labels-count">' +
          impMarkingCounts[i] +
          '</span>' +
          '</div>' +
          '<div class="cmp-labels-mine">' +
          '<input class="cmp-labels-input" data-si="' +
          i +
          '" type="text" maxlength="32" placeholder="Your Marking Label…" value="' +
          myLabel.replace(/"/g, '&quot;') +
          '">' +
          '<span class="cmp-labels-count">' +
          myMarkingCounts[i] +
          '</span>' +
          '</div>' +
          '</div>'
        );
      }).join('') +
      '</div>' +
      saveBtnRow +
      '</div>';
  } else {
    labelsHtml =
      '<div class="dsec2"><h3>My Marking Labels</h3>' +
      '<div class="cmp-labels-table">' +
      SHAPES.map(
        (s, i) =>
          '<div class="cmp-labels-row cmp-labels-row-solo">' +
          '<span class="cmp-labels-marking">' +
          s +
          '</span>' +
          '<div class="cmp-labels-mine">' +
          '<input class="cmp-labels-input" data-si="' +
          i +
          '" type="text" maxlength="32" placeholder="Label this Marking…" value="' +
          state.markingLabels[i].replace(/"/g, '&quot;') +
          '">' +
          '<span class="cmp-labels-count">' +
          myMarkingCounts[i] +
          ' waza</span>' +
          '</div>' +
          '</div>',
      ).join('') +
      '</div>' +
      saveBtnRow +
      '</div>';
  }

  // ── Comparison rows ──────────────────────────────────────────
  let rowsSection;
  if (!keys.length) {
    rowsSection =
      '<div class="cmp-empty">No imported lists yet.<br>Use <b>↓ Import List</b> to add one.</div>';
  } else {
    const importedIds = imp ? new Set(Object.keys(imp.marks).map(Number)) : new Set();
    const rows = state.wazaData.filter((w) => importedIds.has(w.id));
    const colHeaders =
      '<div class="cmp-col-headers"><span>Waza</span><span>Their marks</span><span>Your marks</span></div>';
    const rowsHtml = rows
      .map((w) => {
        const importedMark = imp
          ? imp.marks[w.id] || { markings: Array(6).fill(false) }
          : { markings: Array(6).fill(false) };
        const myMarkings = (getP(w.id).markings || Array(6).fill(false)).slice();
        const impMarkings = importedMark.markings || Array(6).fill(false);
        return (
          '<div class="cmp-row" data-id="' +
          w.id +
          '">' +
          '<div class="cmp-names"><div class="cmp-name-jp">' +
          escapeHtml(w.name_jp || '—') +
          '</div><div class="cmp-name-en">' +
          escapeHtml(dispName(w)) +
          '</div></div>' +
          '<div class="cmp-markings-imported">' +
          markingPips(impMarkings) +
          '</div>' +
          '<div class="cmp-mark-pill">' +
          SHAPES.map(
            (s, i) =>
              '<button class="cmp-mark-seg' +
              (myMarkings[i] ? ' on' : '') +
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
          '</div>' +
          '</div>'
        );
      })
      .join('');
    const empty = !rows.length ? '<div class="cmp-empty">This list has no marks.</div>' : '';
    rowsSection = (rows.length ? colHeaders : '') + rowsHtml + empty;
  }

  container.innerHTML = controlsHtml + labelsHtml + rowsSection;

  // ── Wiring ───────────────────────────────────────────────────
  container.querySelector('#cmpExportBtn')?.addEventListener('click', openExportModal);
  container.querySelector('#cmpImportBtn')?.addEventListener('click', () => openImportModal());

  container.querySelector('#cmpSaveLabelsBtn')?.addEventListener('click', () => {
    container.querySelectorAll('.cmp-labels-input').forEach((inp) => {
      state.markingLabels[+inp.dataset.si] = inp.value;
    });
    saveLabels();
    showToast('Marking Labels saved', 'green');
  });

  container.querySelector('#cmpSelect')?.addEventListener('change', (e) => {
    compareSelectedKey = e.target.value || null;
    renderDashCompare();
  });

  container.querySelector('#cmpRemoveBtn')?.addEventListener('click', () => {
    if (!compareSelectedKey) return;
    const name = importedLists[compareSelectedKey].name;
    if (!confirm('Remove "' + name + '" from your imported lists?')) return;
    delete importedLists[compareSelectedKey];
    saveImported(importedLists);
    compareSelectedKey = null;
    renderDashCompare();
  });

  // Marking toggle — IN PLACE: flip the segment, persist fire-and-forget.
  // No full re-render, so unsaved label edits and scroll position survive.
  container.querySelectorAll('.cmp-mark-seg').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wid = +btn.dataset.wid;
      const si = +btn.dataset.si;
      const cur = getP(wid);
      const ns = (cur.markings || Array(6).fill(false)).slice();
      ns[si] = !ns[si];
      // Reflect immediately in the DOM.
      btn.classList.toggle('on', ns[si]);
      // Persist (saveP handles its own Browse/Detail re-renders; we don't
      // rebuild Compare, so this row's other inputs are untouched).
      saveP(wid, { markings: ns });
    });
  });

  container.querySelectorAll('.cmp-row').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.cmp-mark-pill')) return; // don't navigate when toggling
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });
}
