/**
 * @file state/compare-bulk-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-23
 * @brief Shared mutable state for the Bulk Compare feature within the Compare tab.
 *
 * Tracks source type, selected group members and imported lists, API response data,
 * edit mode, waza name display preference, and column sizing.
 */

// ── Bulk Compare state container ─────────────────────────────

/** @type {Object} Bulk compare state container. */
const compareBulkState = {
  /** @type {'group'|'imported'|null} Which source type is active. */
  sourceType: null,

  /** @type {number|null} Group ID when sourceType is 'group'. */
  groupId: null,

  /** @type {number[]} Ordered array of user IDs to compare (group members). */
  selectedUserIds: [],

  /** @type {string[]} Ordered array of imported list keys to compare. */
  selectedListKeys: [],

  /** @type {Object|null} API response: { [userId]: { markings, labels } }. */
  data: null,

  /** @type {boolean} Whether edit mode is active. */
  editMode: false,

  /** @type {'both'|'jp'|'en'} Waza name display mode. */
  wazaNameDisplay: 'both',

  /** @type {number|null} Fixed width in px for waza name column, null = autofit. */
  wazaColWidth: null,
};

// ── sourceType ───────────────────────────────────────────────

/** @return {'group'|'imported'|null} */
export function getBulkCompareSourceType() {
  return compareBulkState.sourceType;
}
/** @param {'group'|'imported'|null} val */
export function setBulkCompareSourceType(val) {
  compareBulkState.sourceType = val;
}
/** @return {void} */
export function resetBulkCompareSourceType() {
  compareBulkState.sourceType = null;
}

// ── groupId ──────────────────────────────────────────────────

/** @return {number|null} */
export function getBulkCompareGroupId() {
  return compareBulkState.groupId;
}
/** @param {number|null} val */
export function setBulkCompareGroupId(val) {
  compareBulkState.groupId = val;
}
/** @return {void} */
export function resetBulkCompareGroupId() {
  compareBulkState.groupId = null;
}

// ── selectedUserIds ──────────────────────────────────────────

/** @return {number[]} */
export function getBulkCompareSelectedUserIds() {
  return compareBulkState.selectedUserIds;
}
/** @param {number[]} val */
export function setBulkCompareSelectedUserIds(val) {
  compareBulkState.selectedUserIds = Array.isArray(val) ? val : [];
}
/** @return {void} */
export function resetBulkCompareSelectedUserIds() {
  compareBulkState.selectedUserIds = [];
}

// ── selectedListKeys ─────────────────────────────────────────

/** @return {string[]} */
export function getBulkCompareSelectedListKeys() {
  return compareBulkState.selectedListKeys;
}
/** @param {string[]} val */
export function setBulkCompareSelectedListKeys(val) {
  compareBulkState.selectedListKeys = Array.isArray(val) ? val : [];
}
/** @return {void} */
export function resetBulkCompareSelectedListKeys() {
  compareBulkState.selectedListKeys = [];
}

// ── data ─────────────────────────────────────────────────────

/** @return {Object|null} */
export function getBulkCompareData() {
  return compareBulkState.data;
}
/** @param {Object|null} val */
export function setBulkCompareData(val) {
  compareBulkState.data = val;
}
/** @return {void} */
export function resetBulkCompareData() {
  compareBulkState.data = null;
}

// ── editMode ─────────────────────────────────────────────────

/** @return {boolean} */
export function isBulkCompareEditMode() {
  return compareBulkState.editMode;
}
/** @param {boolean} val */
export function setBulkCompareEditMode(val) {
  compareBulkState.editMode = !!val;
}
/** @return {void} */
export function resetBulkCompareEditMode() {
  compareBulkState.editMode = false;
}

// ── wazaNameDisplay ──────────────────────────────────────────

/** @return {'both'|'jp'|'en'} */
export function getBulkCompareWazaNameDisplay() {
  return compareBulkState.wazaNameDisplay;
}
/** @param {'both'|'jp'|'en'} val */
export function setBulkCompareWazaNameDisplay(val) {
  if (val === 'jp' || val === 'en') compareBulkState.wazaNameDisplay = val;
  else compareBulkState.wazaNameDisplay = 'both';
}
/** @return {void} */
export function resetBulkCompareWazaNameDisplay() {
  compareBulkState.wazaNameDisplay = 'both';
}

// ── wazaColWidth ─────────────────────────────────────────────

/** @return {number|null} */
export function getBulkCompareWazaColWidth() {
  return compareBulkState.wazaColWidth;
}
/** @param {number|null} val */
export function setBulkCompareWazaColWidth(val) {
  compareBulkState.wazaColWidth = val;
}
/** @return {void} */
export function resetBulkCompareWazaColWidth() {
  compareBulkState.wazaColWidth = null;
}

// ── Derived helpers ──────────────────────────────────────────

/**
 * @brief Whether at least one user or imported list has been selected.
 * @return {boolean}
 */
export function hasBulkCompareSelection() {
  return (
    compareBulkState.selectedUserIds.length > 0 || compareBulkState.selectedListKeys.length > 0
  );
}

/**
 * @brief Total number of comparison columns (excluding waza name column).
 * @return {number}
 */
export function getBulkCompareColumnCount() {
  return compareBulkState.selectedUserIds.length + compareBulkState.selectedListKeys.length + 1; // +1 for "You"
}

// ── Reset All ─────────────────────────────────────────────────

/**
 * @brief Resets all bulk compare state to initial values.
 * @return {void}
 */
export function resetBulkCompareState() {
  resetBulkCompareSourceType();
  resetBulkCompareGroupId();
  resetBulkCompareSelectedUserIds();
  resetBulkCompareSelectedListKeys();
  resetBulkCompareData();
  resetBulkCompareEditMode();
  resetBulkCompareWazaNameDisplay();
  resetBulkCompareWazaColWidth();
}
