/**
 * @file localStorage.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Constants and helper functions for saving to and loading from localStorage for progress data, marking labels, sort preferences, view style, and imported lists.
 */

// ── Constants ────────────────────────────────────────────────

/**
 * @brief localStorage key for guest user progress data.
 *
 * @type {string}
 */
export const LS_KEY = 'wl_local_prog';

/**
 * @brief localStorage key for marking labels.
 *
 * @type {string}
 */
export const LS_LABELS = 'wl_marking_labels';

/**
 * @brief localStorage key for sort preferences.
 *
 * @type {string}
 */
export const LS_SORT = 'wl_sort_prefs';

/**
 * @brief localStorage key for view style preference.
 *
 * @type {string}
 */
export const LS_VIEW = 'wl_view_style';

/**
 * @brief localStorage key for imported share lists.
 *
 * @type {string}
 */
export const LS_IMPORTED = 'wl_imported_lists';

// ── localStorage helpers ─────────────────────────────────────

/**
 * @brief Loads marking labels from localStorage, validated to exactly six strings.
 *
 * Returns a fresh six-element array of empty strings when the stored value is
 * missing, unparseable, or has the wrong shape. Never throws.
 *
 * @return {string[]} Six validated label strings.
 */
export const loadLabels = () => {
  const fallback = ['', '', '', '', '', ''];
  try {
    const raw = localStorage.getItem(LS_LABELS);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 6) return fallback;
    if (!parsed.every((v) => typeof v === 'string')) return fallback;
    return parsed.slice();
  } catch {
    return fallback;
  }
};

/**
 * @brief Loads progress data from localStorage.
 *
 * @return {Object} Parsed progress object, or an empty object if none exists or parsing fails.
 */
export const loadLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * @brief Saves progress data to localStorage.
 *
 * @param {Object} d The progress object to store.
 * @return {void}
 */
export const saveLocal = (d) => localStorage.setItem(LS_KEY, JSON.stringify(d));
