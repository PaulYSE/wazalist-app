/**
 * @file views/compare-controls.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-24
 * @brief Builds and wires the Compare tab's control bar: the "+ Add to
 *        comparison" button and its popout panel (Group Member / Imported
 *        List source toggle), plus the Import/Export share-key buttons.
 *
 *        This is the only file that mutates compare-state.js's entries[] —
 *        compare.js itself only reads entries[] to build the matrix.
 */

import { api } from '../services/api.js';
import { escapeHtml } from '../lib/escape.js';
import { showToast } from '../components/show-toast.js';
import { openImportModal, openExportModal } from '../features/share-list.js';
import { getCurrentUserId, getMyGroups } from '../state/user-state.js';
import { fetchMemberEntries, importedListToEntry } from '../services/compare-data.js';
import {
  addCompareEntry,
  closeCompareAddPanel,
  getCompareAddPanelGroupId,
  getCompareAddPanelSourceType,
  getImportedList,
  getImportedListKeys,
  hasCompareEntry,
  isCompareAddPanelOpen,
  openCompareAddPanel,
  setCompareAddPanelGroupId,
  setCompareAddPanelSourceType,
} from '../state/compare-state.js';

// ── HTML Builders ─────────────────────────────────────────────

/**
 * @brief Builds the full control bar HTML: Add/Import/Export buttons,
 *        plus the add-panel underneath when it's open.
 *
 * @return {string} HTML string.
 */
export function buildCompareControlsHTML() {
  const panelOpen = isCompareAddPanelOpen();

  let html = '<div class="cmp-controls">';
  html +=
    '<button class="btn' +
    (panelOpen ? ' active' : '') +
    '" id="cmpAddBtn">+ Add to comparison</button>';
  html += '<button class="btn" id="cmpImportBtn">↓ Import List</button>';
  html += '<button class="btn" id="cmpExportBtn">↑ Export My List</button>';
  html += '</div>';

  if (panelOpen) {
    html += buildAddPanelHTML();
  }

  return html;
}

/**
 * @brief Builds the popout panel: source-type toggle + the active tab's content.
 *
 * @return {string} HTML string.
 */
function buildAddPanelHTML() {
  const sourceType = getCompareAddPanelSourceType();

  let html = '<div class="cmp-add-panel dsec2">';
  html +=
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  html += '<div class="seg-pill">';
  html +=
    '<button class="seg-item' +
    (sourceType === 'member' ? ' on' : '') +
    '" id="cmpAddTabMember">Group Member</button>';
  html +=
    '<button class="seg-item' +
    (sourceType === 'imported' ? ' on' : '') +
    '" id="cmpAddTabImported">Imported List</button>';
  html += '</div>';
  html += '<button class="btn" id="cmpAddCancelBtn" style="font-size:12px">✕ Close</button>';
  html += '</div>';

  if (sourceType === 'member') {
    html += buildAddMemberTabHTML();
  } else if (sourceType === 'imported') {
    html += buildAddImportedTabHTML();
  } else {
    html += '<div style="font-size:13px;color:var(--text3)">Choose a source above to begin.</div>';
  }

  html += '</div>';
  return html;
}

/**
 * @brief Builds the Group Member tab: group picker + a placeholder for the
 *        member checkbox list (filled in asynchronously after wiring).
 *
 * @return {string} HTML string.
 */
function buildAddMemberTabHTML() {
  const groups = getMyGroups();
  const groupId = getCompareAddPanelGroupId();

  if (!groups.length) {
    return (
      '<div style="font-size:13px;color:var(--text3)">' +
      'You are not a member of any Groups yet.' +
      '</div>'
    );
  }

  let html = '<div class="cmp-controls" style="margin-bottom:0">';
  html += '<select id="cmpAddGroupSelect" class="cmp-select">';
  html += '<option value="">Select Group</option>';
  html += groups
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
    .join('');
  html += '</select></div>';

  // Filled in by loadMemberCheckboxes() after wiring — either immediately,
  // if a group was already selected before a re-render, or on 'change'.
  html += '<div id="cmpAddMemberArea" style="margin-top:10px"></div>';
  return html;
}

/**
 * @brief Builds the Imported List tab: a picker excluding lists already
 *        in the active comparison, plus an Add button.
 *
 * @return {string} HTML string.
 */
function buildAddImportedTabHTML() {
  const allKeys = getImportedListKeys();
  const availableKeys = allKeys.filter((k) => !hasCompareEntry('imported', k));

  if (!allKeys.length) {
    return (
      '<div style="font-size:13px;color:var(--text3)">' +
      "You haven't imported any lists yet. Use <b>↓ Import List</b> above to add one." +
      '</div>'
    );
  }

  if (!availableKeys.length) {
    return (
      '<div style="font-size:13px;color:var(--text3)">' +
      'All your imported lists are already in the comparison.' +
      '</div>'
    );
  }

  let html = '<div class="cmp-controls" style="margin-bottom:0">';
  html += '<select id="cmpAddListSelect" class="cmp-select">';
  html += '<option value="">Select List</option>';
  html += availableKeys
    .map(
      (k) =>
        '<option value="' +
        escapeHtml(k) +
        '">' +
        escapeHtml(getImportedList(k).name) +
        '</option>',
    )
    .join('');
  html += '</select>';
  html += '<button class="btn" id="cmpAddListBtn" disabled>Add</button>';
  html += '</div>';
  return html;
}

// ── Wiring ──────────────────────────────────────────────────

/**
 * @brief Wires every control in the bar and the add-panel (if open).
 *
 * @param {HTMLElement} container - The element containing the rendered control bar.
 * @param {Function} onEntriesChanged - Called whenever entries[] or the
 *   panel's open/closed state changes, so the caller can re-render the
 *   whole Compare tab. Takes no arguments.
 * @return {void}
 */
export function wireCompareControls(container, onEntriesChanged) {
  container.querySelector('#cmpExportBtn')?.addEventListener('click', openExportModal);
  container.querySelector('#cmpImportBtn')?.addEventListener('click', () => openImportModal());

  container.querySelector('#cmpAddBtn')?.addEventListener('click', () => {
    if (isCompareAddPanelOpen()) {
      closeCompareAddPanel();
    } else {
      openCompareAddPanel();
    }
    onEntriesChanged();
  });

  container.querySelector('#cmpAddCancelBtn')?.addEventListener('click', () => {
    closeCompareAddPanel();
    onEntriesChanged();
  });

  container.querySelector('#cmpAddTabMember')?.addEventListener('click', () => {
    setCompareAddPanelSourceType('member');
    onEntriesChanged();
  });
  container.querySelector('#cmpAddTabImported')?.addEventListener('click', () => {
    setCompareAddPanelSourceType('imported');
    onEntriesChanged();
  });

  wireMemberTab(container, onEntriesChanged);
  wireImportedTab(container, onEntriesChanged);
}

/**
 * @brief Wires the Group Member tab's group picker and restores the member
 *        checkbox list if a group was already selected before this render.
 *
 * @param {HTMLElement} container
 * @param {Function} onEntriesChanged
 * @return {void}
 */
function wireMemberTab(container, onEntriesChanged) {
  const groupSel = container.querySelector('#cmpAddGroupSelect');
  if (!groupSel) return;

  groupSel.addEventListener('change', () => {
    const gid = +groupSel.value || null;
    setCompareAddPanelGroupId(gid);
    const memberArea = container.querySelector('#cmpAddMemberArea');
    if (!gid) {
      if (memberArea) memberArea.innerHTML = '';
      return;
    }
    loadMemberCheckboxes(container, gid, onEntriesChanged);
  });

  // Re-populate checkboxes for a group selected before this re-render
  // happened (e.g. the user switched to the Imported tab and back).
  const existingGroupId = getCompareAddPanelGroupId();
  if (existingGroupId) {
    loadMemberCheckboxes(container, existingGroupId, onEntriesChanged);
  }
}

/**
 * @brief Fetches a group's members, excludes yourself and anyone already
 *        in the comparison, and renders the remaining members as checkboxes
 *        with an "Add Selected" button.
 *
 * @param {HTMLElement} container
 * @param {number} groupId
 * @param {Function} onEntriesChanged
 * @return {Promise<void>}
 */
async function loadMemberCheckboxes(container, groupId, onEntriesChanged) {
  const memberArea = container.querySelector('#cmpAddMemberArea');
  if (!memberArea) return;
  memberArea.innerHTML = '<div style="font-size:13px;color:var(--text3)">Loading members…</div>';

  try {
    const members = await api('/api/groups/' + groupId + '/members');
    const candidates = members.filter(
      (m) => m.user_id !== getCurrentUserId() && !hasCompareEntry('member', m.user_id),
    );

    if (!candidates.length) {
      memberArea.innerHTML =
        '<div style="font-size:13px;color:var(--text3)">' +
        'Every member of this Group is already in the comparison.' +
        '</div>';
      return;
    }

    memberArea.innerHTML =
      candidates
        .map(
          (m) =>
            '<label class="cmp-add-member-label">' +
            '<input type="checkbox" class="cmp-add-member-cb" value="' +
            m.user_id +
            '" data-username="' +
            escapeHtml(m.username) +
            '"> ' +
            escapeHtml(m.username) +
            (m.tag ? ' (' + escapeHtml(m.tag) + ')' : '') +
            '</label>',
        )
        .join('') +
      '<button class="btn" id="cmpAddMembersSubmitBtn" style="margin-top:8px" disabled>Add Selected</button>';

    const submitBtn = memberArea.querySelector('#cmpAddMembersSubmitBtn');

    memberArea.querySelectorAll('.cmp-add-member-cb').forEach((cb) => {
      cb.addEventListener('change', () => {
        const anyChecked = memberArea.querySelectorAll('.cmp-add-member-cb:checked').length > 0;
        submitBtn.disabled = !anyChecked;
      });
    });

    submitBtn.addEventListener('click', async () => {
      const checked = memberArea.querySelectorAll('.cmp-add-member-cb:checked');
      const selected = Array.from(checked).map((cb) => ({
        id: +cb.value,
        username: cb.dataset.username,
      }));
      if (!selected.length) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding…';

      const { entries, error } = await fetchMemberEntries(groupId, selected);
      if (error) {
        showToast(error, 'red');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Selected';
        return;
      }

      entries.forEach((entry) => addCompareEntry(entry));
      closeCompareAddPanel();
      onEntriesChanged();
    });
  } catch {
    memberArea.innerHTML =
      '<div style="font-size:13px;color:var(--red)">Couldn\'t load members. Please try again.</div>';
  }
}

/**
 * @brief Wires the Imported List tab's picker and Add button.
 *
 * @param {HTMLElement} container
 * @param {Function} onEntriesChanged
 * @return {void}
 */
function wireImportedTab(container, onEntriesChanged) {
  const listSel = container.querySelector('#cmpAddListSelect');
  const addListBtn = container.querySelector('#cmpAddListBtn');
  if (!listSel || !addListBtn) return;

  listSel.addEventListener('change', () => {
    addListBtn.disabled = !listSel.value;
  });

  addListBtn.addEventListener('click', () => {
    const key = listSel.value;
    if (!key) return;

    const entry = importedListToEntry(key);
    if (!entry) {
      showToast("Couldn't load that list.", 'red');
      return;
    }

    addCompareEntry(entry);
    closeCompareAddPanel();
    onEntriesChanged();
  });
}
