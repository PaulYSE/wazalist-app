/**
 * @file state/groups-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Shared mutable state for groups feature. Tracks selected group, cached group list, load status, and search query.
 */

// ── Group state ───────────────────────────────────────────────

/**
 * @brief Groups state container.
 *
 * @type {Object}
 */
const groupState = {
  /**
   * The currently selected group ID (for detail panel).
   *
   * @type {number|null}
   */
  groupsSelectedId: null,

  /**
   * Cache of all groups fetched from /api/groups.
   *
   * @type {Object[]}
   */
  groupsData: [],

  /**
   * Whether the group list has been loaded at least once.
   *
   * @type {boolean}
   */
  groupsLoaded: false,

  /**
   * Current search query for filtering the group list.
   *
   * @type {string}
   */
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
 * @param {boolean} loaded - Whether groups are loaded.
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

// ── Reset ─────────────────────────────────────────────────────

export function resetGroupsSelectedId() {
  groupState.groupsSelectedId = null;
}
export function resetGroupsData() {
  groupState.groupsData = [];
}
export function resetGroupsLoaded() {
  groupState.groupsLoaded = false;
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
