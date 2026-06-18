/**
 * @file state/groups-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-18
 * @brief Shared mutable state for groups feature. Tracks selected group, cached group list, load status, and search query.
 */

// ── Group state ───────────────────────────────────────────────

/** @type {Object} Groups state container. */
const groupState = {
  /** @type {number|null} The currently selected group ID (for detail panel). */
  groupsSelectedId: null,

  /** @type {Object[]} Cache of all groups fetched from /api/groups. */
  groupsData: [],

  /** @type {boolean} Whether the group list has been loaded at least once. */
  groupsLoaded: false,

  /** @type {string} Current search query for filtering the group list. */
  groupsSearchQuery: '',
};

// ── Selected ID ──────────────────────────────────────────────

/**
 * @brief Accessors for the currently selected group ID.
 *
 * - getGroupsSelectedId() → {number|null}
 * - setGroupsSelectedId(id) → {void}
 * - resetGroupsSelectedId() → {void}
 */
export function getGroupsSelectedId() {
  return groupState.groupsSelectedId;
}
export function setGroupsSelectedId(id) {
  groupState.groupsSelectedId = id;
}
export function resetGroupsSelectedId() {
  groupState.groupsSelectedId = null;
}

// ── Groups Data ──────────────────────────────────────────────

/**
 * @brief Accessors for the cached groups data.
 *
 * - getGroupsData() → {Object[]}
 * - setGroupsData(groups) → {void}
 * - resetGroupsData() → {void}
 */
export function getGroupsData() {
  return groupState.groupsData;
}
export function setGroupsData(groups) {
  groupState.groupsData = Array.isArray(groups) ? groups : [];
}
export function resetGroupsData() {
  groupState.groupsData = [];
}

// ── Loaded Flag ──────────────────────────────────────────────

/**
 * @brief Accessors for the groups loaded flag.
 *
 * - getGroupsLoaded() → {boolean}
 * - setGroupsLoaded() → {void}
 * - resetGroupsLoaded() → {void}
 */
export function getGroupsLoaded() {
  return groupState.groupsLoaded;
}
export function setGroupsLoaded() {
  groupState.groupsLoaded = true;
}
export function resetGroupsLoaded() {
  groupState.groupsLoaded = false;
}

// ── Search Query ─────────────────────────────────────────────

/**
 * @brief Accessors for the group search query.
 *
 * - getGroupsSearchQuery() → {string}
 * - setGroupsSearchQuery(query) → {void}
 * - resetGroupsSearchQuery() → {void}
 */
export function getGroupsSearchQuery() {
  return groupState.groupsSearchQuery;
}
export function setGroupsSearchQuery(query) {
  groupState.groupsSearchQuery = query;
}
export function resetGroupsSearchQuery() {
  groupState.groupsSearchQuery = '';
}

// ── Reset All ─────────────────────────────────────────────────

/**
 * @brief Resets all group state to initial values.
 *
 * @return {void}
 */
export function resetGroupState() {
  groupState.groupsSelectedId = null;
  groupState.groupsData = [];
  groupState.groupsLoaded = false;
  groupState.groupsSearchQuery = '';
}
