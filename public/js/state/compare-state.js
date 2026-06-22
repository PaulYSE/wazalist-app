/**
 * @file state/compare-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-22
 * @brief Shared mutable state for the Compare tab.
 *
 * Tracks the active accordion, selected imported list key,
 * cached group comparison data, and imported share lists
 * (localStorage-backed). Keeps the compare.js view module
 * focused on rendering and event wiring.
 */

import { LS_IMPORTED } from './localStorage.js';

// ── Compare state container ──────────────────────────────────

/** @type {Object} Compare state container. */
const compareState = {
  /** @type {'group'|'imported'|null} Which accordion is currently open. */
  activeAccordion: null,

  /** @type {string|null} Key of the currently selected imported list. */
  compareSelectedKey: null,

  /** @type {Object|null} Cached data from the last successful group comparison API call. */
  lastGroupData: null,

  /** @type {Object<string, {key: string, name: string, importedAt: string, labels: string[], marks: Object}>} */
  importedLists: {},

  /** @type {Object|null} Import data held between the fetch modal and the name modal. */
  pendingImport: null,
};

// ── localStorage helpers (importedLists) ─────────────────────

/**
 * @brief Loads imported lists from localStorage into memory.
 *
 * Called once at initialization. Safe to call multiple times —
 * subsequent calls overwrite memory with current LS values.
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
 * the other members start at their default values.
 *
 * @return {void}
 */
export function initCompareState() {
  loadImportedFromLS();
}

// ── activeAccordion ──────────────────────────────────────────

/**
 * @brief Accessors for the active accordion.
 *
 * - getCompareAccordion() → {'group'|'imported'|null}
 * - setCompareAccordion(val) → {void}
 * - resetCompareAccordion() → {void}
 */
export function getCompareAccordion() {
  return compareState.activeAccordion;
}
export function setCompareAccordion(val) {
  if (compareState.activeAccordion === val) {
    // Clicking the already-open accordion → close it
    clearCompareData();
    compareState.activeAccordion = null;
  } else {
    // Switching to a different accordion (or opening from null)
    clearCompareData();
    compareState.activeAccordion = val;
  }
}
export function resetCompareAccordion() {
  compareState.activeAccordion = null;
}

// ── compareSelectedKey ───────────────────────────────────────

/**
 * @brief Accessors for the selected imported list key.
 *
 * - getCompareSelectedKey() → {string|null}
 * - setCompareSelectedKey(val) → {void}
 * - resetCompareSelectedKey() → {void}
 */
export function getCompareSelectedKey() {
  return compareState.compareSelectedKey;
}
export function setCompareSelectedKey(val) {
  compareState.compareSelectedKey = val;
}
export function resetCompareSelectedKey() {
  compareState.compareSelectedKey = null;
}

// ── lastGroupData ────────────────────────────────────────────

/**
 * @brief Accessors for the cached group comparison data.
 *
 * - getCompareLastGroupData() → {Object|null}
 * - setCompareLastGroupData(val) → {void}
 * - resetCompareLastGroupData() → {void}
 */
export function getCompareLastGroupData() {
  return compareState.lastGroupData;
}
export function setCompareLastGroupData(val) {
  compareState.lastGroupData = val;
}
export function resetCompareLastGroupData() {
  compareState.lastGroupData = null;
}

// ── importedLists (LS-backed) ────────────────────────────────

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

// ── Derived helpers ──────────────────────────────────────────

/**
 * @brief Whether any imported lists exist.
 *
 * @return {boolean}
 */
export function hasImportedLists() {
  return Object.keys(compareState.importedLists).length > 0;
}

/**
 * @brief Whether group comparison data is available.
 *
 * @return {boolean}
 */
export function hasGroupData() {
  return compareState.lastGroupData !== null;
}

// ── Bulk operations ──────────────────────────────────────────

/**
 * @brief Wipes all active comparison state.
 *
 * Clears the selected key, group data, and accordion state.
 * Does NOT clear importedLists — those persist across sessions.
 * Called when switching accordions or closing them.
 *
 * @return {void}
 */
export function clearCompareData() {
  resetCompareSelectedKey();
  resetCompareLastGroupData();
}

// ── Reset All ─────────────────────────────────────────────────

/**
 * @brief Resets all compare state to initial values.
 *
 * Includes importedLists — use with caution (wipes saved share keys).
 *
 * @return {void}
 */
export function resetCompareState() {
  resetCompareAccordion();
  resetCompareSelectedKey();
  resetCompareLastGroupData();
  resetComparePendingImport();
  resetImportedLists();
}
