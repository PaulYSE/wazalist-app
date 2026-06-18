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

// ── Getters ──────────────────────────────────────────────────

/**
 * @brief Gets the currently selected group ID.
 *
 * @return {number|null}
 */
export function getGroupsSelectedId() {
  return groupState.groupsSelectedId;
}

/**
 * @brief Gets the cached groups data.
 *
 * @return {Object[]}
 */
export function getGroupsData() {
  return groupState.groupsData;
}

/**
 * @brief Gets whether groups are loaded.
 *
 * @return {boolean}
 */
export function getGroupsLoaded() {
  return groupState.groupsLoaded;
}

/**
 * @brief Gets the current group search query.
 *
 * @return {string}
 */
export function getGroupsSearchQuery() {
  return groupState.groupsSearchQuery;
}

// ── Setters ──────────────────────────────────────────────────

/**
 * @brief Sets the selected group ID.
 *
 * @param {number|null} id - Group ID to select, or null to clear.
 * @return {void}
 */
export function setGroupsSelectedId(id) {
  groupState.groupsSelectedId = id;
}

/**
 * @brief Updates the groups cache with a fresh list.
 *
 * @param {Object[]} groups - Array of group objects.
 * @return {void}
 */
export function setGroupsData(groups) {
  groupState.groupsData = Array.isArray(groups) ? groups : [];
}

/**
 * @brief Marks the group list as loaded.
 *
 * @return {void}
 */
export function setGroupsLoaded() {
  groupState.groupsLoaded = true;
}

/**
 * @brief Sets the group search query.
 *
 * @param {string} query - Search query string.
 * @return {void}
 */
export function setGroupsSearchQuery(query) {
  groupState.groupsSearchQuery = query;
}

// ── Individual resets ────────────────────────────────────────

/**
 * @brief Resets the selected group ID to null.
 *
 * @return {void}
 */
export function resetGroupsSelectedId() {
  groupState.groupsSelectedId = null;
}

/**
 * @brief Resets the groups data cache to an empty array.
 *
 * @return {void}
 */
export function resetGroupsData() {
  groupState.groupsData = [];
}

/**
 * @brief Resets the groups loaded flag to false.
 *
 * @return {void}
 */
export function resetGroupsLoaded() {
  groupState.groupsLoaded = false;
}

/**
 * @brief Resets the group search query to an empty string.
 *
 * @return {void}
 */
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