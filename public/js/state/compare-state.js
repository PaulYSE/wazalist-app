/**
 * @file state/compare-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-24
 * @brief Shared mutable state for the unified Compare tab.
 *
 * Replaces the old split group/imported/bulk state modules. The Compare tab
 * now has exactly one comparison surface: a list of "entries" the user has
 * added, where each entry is either a Group member's progress or a saved
 * Imported List — both stored in the same shape so the matrix builder never
 * needs to know which kind of entry it's rendering.
 *
 * Also retains the persistent (localStorage-backed) library of imported
 * share-list keys — that library is independent of which lists are
 * currently active in the comparison.
 */

import { LS_IMPORTED } from './localStorage.js';

// ── Compare state container ──────────────────────────────────

/** @type {Object} Compare state container. */
const compareState = {
  /**
   * @type {Array<{
   *   sourceType: 'member'|'imported',
   *   sourceId: number|string,
   *   username: string,
   *   markings: Object<number, boolean[]>,
   *   labels: string[]
   * }>}
   * Active comparison entries. 'member' entries use a numeric user_id as
   * sourceId; 'imported' entries use the list's hex share-key as sourceId.
   * "You" are never stored here — the matrix builder always adds your own
   * column separately, last, and always editable.
   */
  entries: [],

  /** @type {boolean} Whether the "+ Add to comparison" panel is open. */
  addPanelOpen: false,

  /** @type {'member'|'imported'|null} Which tab is selected inside the open add panel. */
  addPanelSourceType: null,

  /** @type {number|null} Group currently selected inside the add panel (member tab only). */
  addPanelGroupId: null,

  /**
   * @type {'both'|'jp'|'en'} Waza name display mode for the matrix.
   * @todo Extend to support primary/secondary language pairs (e.g. JP+CN,
   *       EN+CN) once that feature is built — currently only 'both' (JP+EN),
   *       'jp', and 'en' are implemented.
   */
  wazaNameDisplay: 'both',

  /** @type {Object<string, {key, name, importedAt, labels, marks}>} Persistent saved share-list library. */
  importedLists: {},

  /** @type {Object|null} Import data held between the fetch modal and the name modal. */
  pendingImport: null,
};

// ── localStorage helpers (importedLists) ─────────────────────

/**
 * @brief Loads imported lists from localStorage into memory.
 *
 * @return {void}
 */
function loadImportedFromLS() {
  try {
    compareState.importedLists = JSON.parse(localStorage.getItem(LS_IMPORTED) || '{}');
  } catch {
    compareState.importedLists = {};
  }
}

/**
 * @brief Persists the current imported lists to localStorage.
 *
 * @return {void}
 */
function saveImportedToLS() {
  localStorage.setItem(LS_IMPORTED, JSON.stringify(compareState.importedLists));
}

// ── Init ─────────────────────────────────────────────────────

/**
 * @brief Hydrates compare state from localStorage.
 *
 * Call once at application boot. Only importedLists needs hydration —
 * the active comparison (entries, add panel, display mode) always starts
 * fresh each session by design; a saved comparison would be confusing
 * since group memberships and imported lists can change between visits.
 *
 * @return {void}
 */
export function initCompareState() {
  loadImportedFromLS();
}

// ── entries (the active comparison) ──────────────────────────

/**
 * @brief Accessors for the active comparison entries.
 *
 * - getCompareEntries() → {Object[]}
 * - setCompareEntries(val) → {void}
 * - resetCompareEntries() → {void}
 */
export function getCompareEntries() {
  return compareState.entries;
}
export function setCompareEntries(val) {
  compareState.entries = Array.isArray(val) ? val : [];
}
export function resetCompareEntries() {
  compareState.entries = [];
}

/**
 * @brief Adds (or replaces, if already present) one entry in the comparison.
 *
 * Upserts by (sourceType, sourceId) rather than blindly pushing, so a
 * duplicate add — which the UI should prevent anyway by filtering already-
 * added items out of its pickers — can never produce two columns for the
 * same member or list.
 *
 * @param {Object} entry - { sourceType, sourceId, username, markings, labels }.
 * @return {void}
 */
export function addCompareEntry(entry) {
  const idx = compareState.entries.findIndex(
    (e) => e.sourceType === entry.sourceType && e.sourceId === entry.sourceId,
  );
  if (idx === -1) {
    compareState.entries.push(entry);
  } else {
    compareState.entries[idx] = entry;
  }
}

/**
 * @brief Removes one entry from the comparison by its source identity.
 *
 * @param {'member'|'imported'} sourceType
 * @param {number|string} sourceId
 * @return {void}
 */
export function removeCompareEntry(sourceType, sourceId) {
  compareState.entries = compareState.entries.filter(
    (e) => !(e.sourceType === sourceType && e.sourceId === sourceId),
  );
}

/**
 * @brief Looks up a single entry by its source identity.
 *
 * @param {'member'|'imported'} sourceType
 * @param {number|string} sourceId
 * @return {Object|undefined}
 */
export function getCompareEntry(sourceType, sourceId) {
  return compareState.entries.find((e) => e.sourceType === sourceType && e.sourceId === sourceId);
}

/**
 * @brief Whether an entry with this source identity is already in the comparison.
 *
 * Used by the add-panel pickers to exclude already-added members/lists
 * from their dropdowns, so the same source can't be added twice.
 *
 * @param {'member'|'imported'} sourceType
 * @param {number|string} sourceId
 * @return {boolean}
 */
export function hasCompareEntry(sourceType, sourceId) {
  return getCompareEntry(sourceType, sourceId) !== undefined;
}

/**
 * @brief Whether the comparison currently has at least one entry.
 *
 * @return {boolean}
 */
export function hasAnyCompareEntries() {
  return compareState.entries.length > 0;
}

// ── Add panel (transient UI state) ───────────────────────────

/**
 * @brief Accessors for whether the "+ Add to comparison" panel is open.
 *
 * - isCompareAddPanelOpen() → {boolean}
 * - openCompareAddPanel() → {void}
 * - closeCompareAddPanel() → {void} (also clears the panel's own picker state)
 */
export function isCompareAddPanelOpen() {
  return compareState.addPanelOpen;
}
export function openCompareAddPanel() {
  compareState.addPanelOpen = true;
}
export function closeCompareAddPanel() {
  compareState.addPanelOpen = false;
  compareState.addPanelSourceType = null;
  compareState.addPanelGroupId = null;
}

/**
 * @brief Accessors for which tab ('member' | 'imported') is active inside the add panel.
 *
 * - getCompareAddPanelSourceType() → {'member'|'imported'|null}
 * - setCompareAddPanelSourceType(val) → {void}
 */
export function getCompareAddPanelSourceType() {
  return compareState.addPanelSourceType;
}
export function setCompareAddPanelSourceType(val) {
  compareState.addPanelSourceType = val === 'member' || val === 'imported' ? val : null;
}

/**
 * @brief Accessors for the group currently selected inside the add panel.
 *
 * Only meaningful while addPanelSourceType === 'member'; remembers which
 * group's member checkboxes are being shown before "Add Selected" is clicked.
 *
 * - getCompareAddPanelGroupId() → {number|null}
 * - setCompareAddPanelGroupId(val) → {void}
 */
export function getCompareAddPanelGroupId() {
  return compareState.addPanelGroupId;
}
export function setCompareAddPanelGroupId(val) {
  compareState.addPanelGroupId = val || null;
}

// ── wazaNameDisplay ──────────────────────────────────────────

/**
 * @brief Accessors for the waza name display mode.
 *
 * - getCompareWazaNameDisplay() → {'both'|'jp'|'en'}
 * - setCompareWazaNameDisplay(val) → {void}
 * - resetCompareWazaNameDisplay() → {void}
 */
export function getCompareWazaNameDisplay() {
  return compareState.wazaNameDisplay;
}
export function setCompareWazaNameDisplay(val) {
  compareState.wazaNameDisplay = val === 'jp' || val === 'en' ? val : 'both';
}
export function resetCompareWazaNameDisplay() {
  compareState.wazaNameDisplay = 'both';
}

// ── importedLists (LS-backed, persistent library) ────────────

/**
 * @brief Accessors for the full imported lists object.
 *
 * - getImportedLists() → {Object<string, Object>}
 * - setImportedLists(val) → {void}
 * - resetImportedLists() → {void}
 */
export function getImportedLists() {
  return compareState.importedLists;
}
export function setImportedLists(val) {
  compareState.importedLists = val || {};
  saveImportedToLS();
}
export function resetImportedLists() {
  compareState.importedLists = {};
  saveImportedToLS();
}

/**
 * @brief Accessors for a single imported list by key.
 *
 * - getImportedList(key) → {Object|undefined}
 * - setImportedList(key, val) → {void}
 * - removeImportedList(key) → {void}
 * - hasImportedList(key) → {boolean}
 */
export function getImportedList(key) {
  return compareState.importedLists[key];
}
export function setImportedList(key, val) {
  compareState.importedLists[key] = val;
  saveImportedToLS();
}
export function removeImportedList(key) {
  delete compareState.importedLists[key];
  saveImportedToLS();
  // Also drop it from the active comparison, if it was in there —
  // a removed-from-library list shouldn't linger as a stale column.
  removeCompareEntry('imported', key);
}
export function hasImportedList(key) {
  return compareState.importedLists[key] !== undefined;
}

/**
 * @brief Returns an array of keys for all imported lists.
 *
 * @return {string[]}
 */
export function getImportedListKeys() {
  return Object.keys(compareState.importedLists);
}

/**
 * @brief Whether any imported lists exist in the saved library.
 *
 * @return {boolean}
 */
export function hasImportedLists() {
  return Object.keys(compareState.importedLists).length > 0;
}

// ── pendingImport ────────────────────────────────────────────

/**
 * @brief Accessors for the pending import data.
 *
 * Held between the fetch modal (paste key) and the name modal
 * (give the list a name before saving).
 *
 * - getComparePendingImport() → {Object|null}
 * - setComparePendingImport(val) → {void}
 * - resetComparePendingImport() → {void}
 */
export function getComparePendingImport() {
  return compareState.pendingImport;
}
export function setComparePendingImport(val) {
  compareState.pendingImport = val;
}
export function resetComparePendingImport() {
  compareState.pendingImport = null;
}

// ── Reset All ─────────────────────────────────────────────────

/**
 * @brief Resets all compare state to initial values, including the saved
 *        imported-lists library.
 *
 * Use with caution — this wipes saved share keys, not just the active
 * comparison. For just clearing the current comparison, use
 * resetCompareEntries() instead.
 *
 * @return {void}
 */
export function resetCompareState() {
  resetCompareEntries();
  closeCompareAddPanel();
  resetCompareWazaNameDisplay();
  resetComparePendingImport();
  resetImportedLists();
}
