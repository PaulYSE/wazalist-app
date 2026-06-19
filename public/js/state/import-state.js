/**
 * @file state/import-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-19
 * @brief Shared mutable state for the import-from-text feature.
 *
 * Tracks found labels, auto-mapping, unmatched lines, preview mode,
 * and Excel color mappings across the multi-phase parsing process.
 * This keeps the import-ui.js module focused on DOM and user interaction,
 * while the parsing logic lives in import-from-text.js.
 */

// ── Import state container ───────────────────────────────────

/** @type {Object} Import state container. */
export const importState = {
  /** @type {Array<{waza: Object, rawLine: string, category: string, manualMarkings: boolean[]}>} */
  matched: [],

  /** @type {string[]} Raw lines that couldn't be matched to any waza. */
  unmatched: [],

  /** @type {boolean} Whether the text has been parsed. */
  parsed: false,

  /** @type {'text'|'excel'} Whether the import is from text or Excel. */
  parsedMode: 'text',

  /** @type {string[]} Ordered unique label strings found in the pasted text. */
  foundLabels: [],

  /** @type {Object<string, number>} Maps label string → marking index (-1 = none). */
  autoMapping: {},

  /** @type {Object<string, string>} Maps label string → user-editable display name. */
  labelNames: {},

  /** @type {boolean} True when auto-labels have been applied as a preview to manualMarkings. */
  previewMode: false,

  /** @type {Object<string, string[]>} Maps color hex → array of waza names. */
  excelColors: {},

  /** @type {Object<string, number>} Maps color hex → marking index. */
  colorMapping: {},

  /** @type {Object<string, string>} Maps color hex → user-assigned label name. */
  excelColorLabels: {},
};

// ── matched ──────────────────────────────────────────────────

/**
 * @brief Accessors for the matched waza list.
 *
 * - getImportMatched() → {Object[]}
 * - setImportMatched(val) → {void}
 * - pushImportMatched(item) → {void}
 * - resetImportMatched() → {void}
 */
export function getImportMatched() {
  return importState.matched;
}
export function setImportMatched(val) {
  importState.matched = Array.isArray(val) ? val : [];
}
export function pushImportMatched(item) {
  importState.matched.push(item);
}
export function resetImportMatched() {
  importState.matched = [];
}

// ── matched markings ─────────────────────────────────────────

/**
 * @brief Accessors and mutators for matched item markings.
 *
 * - toggleImportMatchedMarking(idx, si) → {boolean} (returns new state)
 * - clearImportMatchedMarkings(idx) → {void}
 * - clearAllImportMatchedMarkings() → {void}
 */
export function toggleImportMatchedMarking(idx, si) {
  const current = importState.matched[idx].manualMarkings[si];
  importState.matched[idx].manualMarkings[si] = !current;
  return !current;
}
export function clearImportMatchedMarkings(idx) {
  importState.matched[idx].manualMarkings = Array(6).fill(false);
}
export function clearAllImportMatchedMarkings() {
  importState.matched.forEach((item) => {
    item.manualMarkings = Array(6).fill(false);
  });
}

// ── unmatched ────────────────────────────────────────────────

/**
 * @brief Accessors for the unmatched lines list.
 *
 * - getImportUnmatched() → {string[]}
 * - setImportUnmatched(val) → {void}
 * - pushImportUnmatched(item) → {void}
 * - resetImportUnmatched() → {void}
 */
export function getImportUnmatched() {
  return importState.unmatched;
}
export function setImportUnmatched(val) {
  importState.unmatched = Array.isArray(val) ? val : [];
}
export function pushImportUnmatched(item) {
  importState.unmatched.push(item);
}
export function resetImportUnmatched() {
  importState.unmatched = [];
}

// ── parsed ───────────────────────────────────────────────────

/**
 * @brief Accessors for the parsed flag.
 *
 * - isImportParsed() → {boolean}
 * - setImportParsed() → {void}
 * - resetImportParsed() → {void}
 */
export function isImportParsed() {
  return importState.parsed;
}
export function setImportParsed() {
  importState.parsed = true;
}
export function resetImportParsed() {
  importState.parsed = false;
}

// ── parsedMode ───────────────────────────────────────────────

/**
 * @brief Accessors for the parsed mode flag.
 *
 * - getImportParsedMode() → {'text'|'excel'}
 * - setImportParsedMode(val) → {void}
 * - resetImportParsedMode() → {void}
 */
export function getImportParsedMode() {
  return importState.parsedMode;
}
export function setImportParsedMode(val) {
  importState.parsedMode = String(val).toLowerCase() === 'excel' ? 'excel' : 'text';
}
export function resetImportParsedMode() {
  importState.parsedMode = 'text';
}

// ── foundLabels ──────────────────────────────────────────────

/**
 * @brief Accessors for the found labels list.
 *
 * - getImportFoundLabels() → {string[]}
 * - setImportFoundLabels(val) → {void}
 * - resetImportFoundLabels() → {void}
 */
export function getImportFoundLabels() {
  return importState.foundLabels;
}
export function setImportFoundLabels(val) {
  importState.foundLabels = Array.isArray(val) ? val : [];
}
export function resetImportFoundLabels() {
  importState.foundLabels = [];
}

// ── autoMapping ──────────────────────────────────────────────

/**
 * @brief Accessors for the label-to-marking auto-mapping.
 *
 * - getImportAutoMapping() → {Object<string, number>}
 * - getImportAutoMappingKey(key) → {number|undefined}
 * - setImportAutoMapping(val) → {void}
 * - setImportAutoMappingKey(key, value) → {void}
 * - resetImportAutoMapping() → {void}
 */
export function getImportAutoMapping() {
  return importState.autoMapping;
}
export function getImportAutoMappingKey(key) {
  return importState.autoMapping[key];
}
export function setImportAutoMapping(val) {
  importState.autoMapping = val || {};
}
export function setImportAutoMappingKey(key, value) {
  importState.autoMapping[key] = value;
}
export function resetImportAutoMapping() {
  importState.autoMapping = {};
}

// ── labelNames ───────────────────────────────────────────────

/**
 * @brief Accessors for the label display names.
 *
 * - getImportLabelNames() → {Object<string, string>}
 * - getImportLabelNameKey(key) → {string|undefined}
 * - setImportLabelNames(val) → {void}
 * - setImportLabelNameKey(key, value) → {void}
 * - resetImportLabelNames() → {void}
 */
export function getImportLabelNames() {
  return importState.labelNames;
}
export function getImportLabelNameKey(key) {
  return importState.labelNames[key];
}
export function setImportLabelNames(val) {
  importState.labelNames = val || {};
}
export function setImportLabelNameKey(key, value) {
  importState.labelNames[key] = value;
}
export function resetImportLabelNames() {
  importState.labelNames = {};
}

// ── previewMode ──────────────────────────────────────────────

/**
 * @brief Accessors for the preview mode flag.
 *
 * - isImportPreviewMode() → {boolean}
 * - setImportPreviewMode() → {void}
 * - resetImportPreviewMode() → {void}
 */
export function isImportPreviewMode() {
  return importState.previewMode;
}
export function setImportPreviewMode() {
  importState.previewMode = true;
}
export function resetImportPreviewMode() {
  importState.previewMode = false;
}

// ── excelColors ──────────────────────────────────────────────

/**
 * @brief Accessors for the Excel color-to-waza mapping.
 *
 * - getImportExcelColors() → {Object<string, string[]>}
 * - setImportExcelColors(val) → {void}
 * - pushImportExcelColorItem(color, wazaName) → {void}
 * - hasImportExcelColorItem(color) → {boolean}
 * - resetImportExcelColors() → {void}
 */
export function getImportExcelColors() {
  return importState.excelColors;
}
export function setImportExcelColors(val) {
  importState.excelColors = val || {};
}
export function pushImportExcelColorItem(color, wazaName) {
  if (!importState.excelColors[color]) {
    importState.excelColors[color] = [];
  }
  importState.excelColors[color].push(wazaName);
}
export function hasImportExcelColorItem(color) {
  return importState.excelColors[color] !== undefined;
}
export function resetImportExcelColors() {
  importState.excelColors = {};
}

// ── colorMapping ─────────────────────────────────────────────

/**
 * @brief Accessors for the Excel color-to-marking mapping.
 *
 * - getImportColorMapping() → {Object<string, number>}
 * - getImportColorMappingKey(color) → {number|undefined}
 * - setImportColorMapping(val) → {void}
 * - setImportColorMappingKey(color, markingIdx) → {void}
 * - resetImportColorMapping() → {void}
 */
export function getImportColorMapping() {
  return importState.colorMapping;
}
export function getImportColorMappingKey(color) {
  return importState.colorMapping[color];
}
export function setImportColorMapping(val) {
  importState.colorMapping = val || {};
}
export function setImportColorMappingKey(color, markingIdx) {
  importState.colorMapping[color] = markingIdx;
}
export function resetImportColorMapping() {
  importState.colorMapping = {};
}

// ── excelColorLabels ─────────────────────────────────────────

/**
 * @brief Accessors for the Excel color label names.
 *
 * - getImportExcelColorLabels() → {Object<string, string>}
 * - getImportExcelColorLabelKey(color) → {string|undefined}
 * - setImportExcelColorLabels(val) → {void}
 * - setImportExcelColorLabelKey(color, labelName) → {void}
 * - resetImportExcelColorLabels() → {void}
 */
export function getImportExcelColorLabels() {
  return importState.excelColorLabels;
}
export function getImportExcelColorLabelKey(color) {
  return importState.excelColorLabels[color];
}
export function setImportExcelColorLabels(val) {
  importState.excelColorLabels = val || {};
}
export function setImportExcelColorLabelKey(color, labelName) {
  importState.excelColorLabels[color] = labelName;
}
export function resetImportExcelColorLabels() {
  importState.excelColorLabels = {};
}

// ── Reset All ─────────────────────────────────────────────────

/**
 * @brief Resets all import state to initial values.
 *
 * @return {void}
 */
export function resetImportStateAll() {
  resetImportMatched();
  resetImportUnmatched();
  resetImportParsed();
  resetImportParsedMode();
  resetImportFoundLabels();
  resetImportAutoMapping();
  resetImportLabelNames();
  resetImportPreviewMode();
  resetImportExcelColors();
  resetImportColorMapping();
  resetImportExcelColorLabels();
}
