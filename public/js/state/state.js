/**
 * @file state/state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-21
 * @brief Manages global mutable application state.
 */

import { LS_LABELS } from './localStorage.js';

// ── Shared mutable state ─────────────────────────────────────

/** @type {Object} Global application state object. */
export const state = {
  /** @type {Object[]} Array of all waza data loaded from the server. */
  wazaData: [],

  /** @type {Object<number, {markings: boolean[], like: number|null, updated_at: string|null}>} */
  prog: {},

  /** @type {number|null} ID of the currently selected waza for detail view. */
  selectedId: null,

  /** @type {Set<number>} Set of waza IDs currently being saved. */
  savingIds: new Set(),

  /** @type {string[]} Custom labels for each of the 6 marking shapes. */
  markingLabels: JSON.parse(localStorage.getItem(LS_LABELS) || '["","","","","",""]'),
};
