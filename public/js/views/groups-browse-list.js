/**
 * @file views/groups-browse-list.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-28
 * @brief Groups browse list view. Renders the left-panel group list with search, filtering, and selection.
 */

import { api } from '../services/api.js';
import { requireApiArray } from '../lib/api-response.js';
import { escapeHtml } from '../lib/escape.js';
import { openCreateGroup } from '../modals/group-new.js';
import { POLICY_LABEL, POLICY_CLASS } from '../config/groups-config.js';
import { renderGroupDetail, invalidateGroupDetailRequests } from './groups-detail.js';
import {
  getGroupsSelectedId,
  setGroupsSelectedId,
  getGroupsData,
  setGroupsData,
  resetGroupsData,
  getGroupsLoaded,
  setGroupsLoaded,
  resetGroupsLoaded,
  getGroupsSearchQuery,
  resetGroupsSearchQuery,
  setGroupsSearchQuery,
} from '../state/groups-state.js';
import {
  isGuest,
  getToken,
  isLoggedIn,
  resetMyGroups,
  resetMyGroupsLoaded,
  getMyGroups,
  setMyGroups,
  setMyGroupsLoaded,
  isAdmin,
} from '../state/user-state.js';
import { parseRoute, pushRoute, replaceRoute } from '../app/router.js';

let isPopping = false;

// Session-only record of confirmed deletions.
// Prevents older history entries from reopening these groups.
const deletedGroupIds = new Set();

export function isGroupDeleted(id) {
  return deletedGroupIds.has(id);
}

function removeDeletedGroupFromCurrentRoute(id) {
  const { tab, groupParam } = parseRoute();

  // Do not rewrite another group's URL or another tab.
  if (
    tab === 'groups' &&
    groupParam !== null &&
    groupParam !== undefined &&
    Number(groupParam) === id
  ) {
    replaceRoute('groups', null, null);
  }
}

export function handleConfirmedGroupDeletion(id) {
  deletedGroupIds.add(id);

  // Remove the confirmed deletion from cached lists immediately.
  setGroupsData(
    getGroupsData().filter((group) => group.id !== id),
  );

  setMyGroups(
    getMyGroups().filter((group) => group.id !== id),
  );

  resetGroupsLoaded();
  resetMyGroupsLoaded();

  // Only close the detail if the deleted group is still selected.
  if (getGroupsSelectedId() === id) {
    closeGroupDetailNoHistory();
  } else {
    renderGroupList();
  }

  removeDeletedGroupFromCurrentRoute(id);
}

let groupsLoadError = '';
let myGroupsLoadError = '';

export function getMyGroupsLoadError() {
  return myGroupsLoadError;
}

/**
 * @brief Selects a group by ID, renders its detail panel, and (unless
 *        reconciling from history) pushes a new history entry.
 *
 * @param {number} id - Group ID to select.
 * @return {void}
 */
function selectGroup(id) {
  if (isGroupDeleted(id)) {
    closeGroupDetailNoHistory();
    removeDeletedGroupFromCurrentRoute(id);
    return;
  }
  setGroupsSelectedId(id);
  renderGroupList();
  renderGroupDetail(id);
  document.querySelector('#groupsView .main').classList.add('waza-selected');

  if (!isPopping) {
    pushRoute('groups', null, id);
  }
}

/**
 * @brief Closes the group detail panel back to the list-only view, and
 *        (unless reconciling from history) replaces the current history
 *        entry so the URL drops its ?group= param.
 *
 * @return {void}
 */
function closeGroupDetail() {
  invalidateGroupDetailRequests();
  
  setGroupsSelectedId(null);
  document.querySelector('#groupsView .main').classList.remove('waza-selected');
  renderGroupList();
  document.getElementById('groupDetailContent').innerHTML =
    '<div class="d-empty"><div style="font-size:32px">👥</div><div>Select a Group to view details</div></div>';

  if (!isPopping) {
    replaceRoute('groups', null, null);
  }
}

/**
 * @brief Selects a group from history navigation (back/forward) without
 *        pushing a new history entry.
 *
 * @param {number} id - Group ID to select.
 * @return {void}
 */
export function selectGroupFromHistory(id) {
  isPopping = true;
  try {
    selectGroup(id);
  } finally {
    isPopping = false;
  }
}

/**
 * @brief Closes the group detail panel from history navigation without
 *        pushing a new history entry.
 *
 * @return {void}
 */
export function closeGroupDetailFromHistory() {
  isPopping = true;
  try {
    closeGroupDetail();
  } finally {
    isPopping = false;
  }
}

/**
 * @brief Closes the group detail panel without writing a history entry.
 *
 * Used when a tab switch is about to push its own history entry (the
 * destination tab), avoiding a separate "close group" entry in the
 * navigation stack. Mirrors closeDetailNoHistory() in waza-detail.js.
 *
 * @return {void}
 */
export function closeGroupDetailNoHistory() {
  isPopping = true;
  try {
    closeGroupDetail();
  } finally {
    isPopping = false;
  }
}

// ── Search input ──────────────────────────────────────────────

/**
 * @brief Filters the groups cache by the current search query.
 *
 * Matches against group name only. Case-insensitive partial match.
 *
 * @return {Object[]} Filtered array of group objects.
 */
function filterGroups() {
  if (!getGroupsSearchQuery()) return getGroupsData();
  const q = getGroupsSearchQuery().toLowerCase();
  return getGroupsData().filter((g) => g.name.toLowerCase().includes(q));
}

/**
 * @brief Wires the group search input and clear button.
 *
 * Listens for input to filter the group list, and clears the search
 * when the clear button is clicked. Updates renderGroupList on change.
 *
 * @return {void}
 */
function wireGroupSearchInput() {
  const searchInput = document.getElementById('groupSearchInput');
  const searchClear = document.getElementById('groupSearchClear');

  searchInput?.addEventListener('input', (e) => {
    setGroupsSearchQuery(e.target.value.trim());
    renderGroupList();
  });

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    resetGroupsSearchQuery();
    searchInput.focus();
    renderGroupList();
  });

  // Show/hide clear button based on input value
  searchInput?.addEventListener('input', (e) => {
    searchInput.closest('.search-wrap')?.classList.toggle('has-value', !!e.target.value);
  });
}

// ── Entry point ───────────────────────────────────────────────

/**
 * @brief Renders the Groups tab. Fetches group list on first open, then renders.
 *
 * @return {Promise<void>}
 */
export async function renderGroups() {
  if (!getGroupsLoaded()) {
    await refreshGroups();
  } else {
    renderGroupList();
    if (getGroupsSelectedId()) renderGroupDetail(getGroupsSelectedId());
  }
}

/**
 * @brief Forces a fresh fetch of all groups and re-renders the list.
 *
 * @return {Promise<void>}
 */
export async function refreshGroups() {
  const countBar = document.getElementById('groupCountBar');

  if (countBar) countBar.textContent = 'Loading…';

  groupsLoadError = '';

  try {
    const res = await api('/api/groups');
    const groups = requireApiArray(
      res,
      'The server returned an invalid Groups list.',
    );

    // Commit cache and loaded state only after validation.
    setGroupsData(
      groups.filter((group) => !isGroupDeleted(group.id)),
    );
    setGroupsLoaded();
  } catch (error) {
    console.error('Failed to load groups:', error);

    groupsLoadError =
      error instanceof Error
        ? error.message
        : 'Could not load Groups.';

    // Preserve the previous cache, but allow a future retry.
    resetGroupsLoaded();
    renderGroupList();

    return {
      success: false,
      error: groupsLoadError,
    };
  }

  // Membership failure must not invalidate a successful public list.
  await refreshMyGroups();

  renderGroupList();

  const selectedId = getGroupsSelectedId();

  if (selectedId !== null) {
    renderGroupDetail(selectedId);
  }

  return { success: true };
}

/**
 * @brief Fetches the current user's group memberships into state.myGroups.
 *
 * @return {Promise<void>}
 */
export async function refreshMyGroups() {
  myGroupsLoadError = '';

  if (isGuest() || !getToken()) {
    resetMyGroups();
    setMyGroupsLoaded();

    return { success: true };
  }

  try {
    const res = await api('/api/groups/mine');
    const groups = requireApiArray(
      res,
      'The server returned an invalid membership list.',
    );

    setMyGroups(
      groups.filter((group) => !isGroupDeleted(group.id)),
    );
    setMyGroupsLoaded();

    return { success: true };
  } catch (error) {
    console.error('Failed to load my groups:', error);

    myGroupsLoadError =
      error instanceof Error
        ? error.message
        : 'Could not load your Group memberships.';

    // Keep any previous cache, but do not treat it as a fresh success.
    resetMyGroupsLoaded();

    return {
      success: false,
      error: myGroupsLoadError,
    };
  }
}

// ── Group list panel ──────────────────────────────────────────

/**
 * @brief Generates HTML for the "Create Group" button if the user is logged in.
 *
 * @param {string} id - DOM ID for the button.
 * @param {string} style - Inline style string.
 * @param {string} text - Button text.
 * @return {string} HTML string or empty string.
 */
function makeCreateGroupBtn(id, style, text) {
  if (isGuest() || !getToken()) return '';
  return '<button class="btn" id="' + id + '" style="' + style + '">' + text + '</button>';
}

/**
 * @brief Wires the "Create Group" button click handler.
 *
 * @param {string} id - DOM ID of the button.
 * @return {void}
 */
function wireCreateGroupBtn(id) {
  document.getElementById(id)?.addEventListener('click', () => {
    openCreateGroup(async () => {
      resetGroupsLoaded();
      await refreshGroups();
    });
  });
}

/**
 * @brief Renders the left-panel group list.
 *
 * @return {void}
 */
function renderGroupList() {
  const countBar = document.getElementById('groupCountBar');
  const listEl = document.getElementById('groupList');
  if (!countBar || !listEl) return;

  if (groupsLoadError) {
    countBar.textContent = 'Groups could not be loaded';
  
    listEl.innerHTML =
      '<div style="padding:24px 20px;text-align:center">' +
      '<div style="color:var(--red);font-size:13px">' +
      escapeHtml(groupsLoadError) +
      '</div>' +
      '<button class="btn" id="retryGroupsBtn" ' +
      'style="margin-top:12px">Retry</button>' +
      '</div>';
  
    listEl.querySelector('#retryGroupsBtn')
      ?.addEventListener('click', () => {
        refreshGroups();
      });
  
    return;
  }

  const filtered = filterGroups();
  const loggedIn = isLoggedIn();

  countBar.innerHTML =
    '<span>' + filtered.length + ' Group' + (filtered.length !== 1 ? 's' : '') + '</span>';

  if (!filtered.length) {
    listEl.innerHTML =
      '<div style="padding:24px 20px;text-align:center;color:var(--text3);font-size:13px">' +
      '<div style="font-size:14px;color:var(--text2)">No Group found</div>' +
      '<div style="margin-top:10px;font-size:13px">Can\'t find the Group you\'re looking for?</div>' +
      (loggedIn
        ? makeCreateGroupBtn('groupNoResultAddBtn', 'margin-top:12px', '+ Create a Group!')
        : '<div style="margin-top:6px;font-size:12px">Sign in to help add it to the database.</div>') +
      '</div>';
    wireCreateGroupBtn('groupNoResultAddBtn');
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (g) =>
        '<div class="waza-list' +
        (getGroupsSelectedId() === g.id ? ' selected' : '') +
        '" data-gid="' +
        g.id +
        '">' +
        '<div class="njp">' +
        escapeHtml(g.name) +
        '</div>' +
        '<div class="badges" style="margin-top:5px;display:flex;gap:4px;align-items:center">' +
        '<span class="badge ' +
        (POLICY_CLASS[g.join_policy] || 'b-tag') +
        '">' +
        (POLICY_LABEL[g.join_policy] || g.join_policy) +
        '</span>' +
        '<span class="badge b-tag">' +
        (g.member_count || 0) +
        ' member' +
        ((g.member_count || 0) !== 1 ? 's' : '') +
        '</span>' +
        '</div>' +
        '</div>',
    )
    .join('');

  listEl.querySelectorAll('[data-gid]').forEach((el) => {
    el.addEventListener('click', () => {
      selectGroup(+el.dataset.gid);
    });
  });
}

/**
 * @brief Initialises the Groups tab mobile back button and search.
 *
 * @return {void}
 */
export function initGroups() {
  wireGroupSearchInput();
  wireCreateGroupBtn();
  document.getElementById('groupMobileBack')?.addEventListener('click', () => {
    closeGroupDetail();
  });
  refreshMyGroups();
}
