/**
 * @file groups-browse-list.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-14
 * @brief Groups tab view. Two-panel browse/detail layout for discovering, joining,
 *        and managing Wotagei Groups.
 */

import { api } from '../services/api.js';
import { escapeHtml } from '../lib/escape.js';
import { openCreateGroup } from '../modals/group-new.js';
import { POLICY_LABEL, POLICY_CLASS } from '../config/groups-config.js';
import { renderGroupDetail } from './groups-detail.js';
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
  setMyGroups,
  setMyGroupsLoaded,
  isAdmin,
} from '../state/user-state.js';

// ── TEMPORARY: BLOCK START ────────────────────────────────────
// ── Admin-only access during development ──────────────────────
// TODO: Remove this block when Groups feature is ready for all users.

/**
 * @brief Hides the Groups tab from non-admin users.
 *
 * Call this manually from the dev console after login:
 *   enableGroupsForAdmins()
 *
 * @return {void}
 */
function enableGroupsForAdmins() {
  const admin = isAdmin();
  document.querySelector('.ntab[data-tab="groups"]').style.display = admin ? '' : 'none';
  document.querySelector('.mob-menu-item[data-menu-tab="groups"]').style.display = isAdmin
    ? ''
    : 'none';
  document.getElementById('groupsView').style.display = admin ? '' : 'none';
}
enableGroupsForAdmins();

// Expose globally for dev-console access
window.enableGroupsForAdmins = enableGroupsForAdmins;

// ── TEMPORARY: BLOCK END ──────────────────────────────────────

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
  document.getElementById('groupCountBar').textContent = 'Loading…';
  try {
    const res = await api('/api/groups');
    setGroupsData(Array.isArray(res) ? res : []);
    setGroupsLoaded();

    // Also refresh state.myGroups for Compare dropdown
    await refreshMyGroups();
  } catch (e) {
    console.error('Failed to load groups:', e);
    resetGroupsData();
  }
  renderGroupList();
  if (getGroupsSelectedId()) renderGroupDetail(getGroupsSelectedId());
}

/**
 * @brief Fetches the current user's group memberships into state.myGroups.
 *
 * @return {Promise<void>}
 */
export async function refreshMyGroups() {
  if (isGuest() || !getToken()) {
    resetMyGroups();
    setMyGroupsLoaded();
    return;
  }
  try {
    const res = await api('/api/groups/mine');
    setMyGroups(res);
    setMyGroupsLoaded();
  } catch (e) {
    console.error('Failed to load my groups:', e);
    resetMyGroups();
    resetMyGroupsLoaded();
  }
}

// ── Group list panel ──────────────────────────────────────────
function makeCreateGroupBtn(id, style, text) {
  if (isGuest() || !getToken()) return '';

  return '<button class="btn" id="' + id + '" style="' + style + '">' + text + '</button>';
}
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
      setGroupsSelectedId(+el.dataset.gid);
      renderGroupList();
      renderGroupDetail(getGroupsSelectedId());
      document.querySelector('#groupsView .main').classList.add('waza-selected');
    });
  });
}

/**
 * @brief Initialises the Groups tab mobile back button.
 *
 * @return {void}
 */
export function initGroups() {
  wireGroupSearchInput();
  wireCreateGroupBtn();
  document.getElementById('groupMobileBack')?.addEventListener('click', () => {
    setGroupsSelectedId(null);
    document.querySelector('#groupsView .main').classList.remove('waza-selected');
    renderGroupList();
    document.getElementById('groupDetailContent').innerHTML =
      '<div class="d-empty"><div style="font-size:32px">👥</div><div>Select a Group to view details</div></div>';
  });
  refreshMyGroups();
}
