/**
 * @file progress.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Progress management for waza markings and likes. Handles local state, localStorage persistence for guests, and API sync for authenticated users.
 */

import { state } from '../state/state.js';
import { LS_LABELS, loadLocal, saveLocal } from '../state/localStorage.js';
import { api } from './api.js';
import { renderList } from '../views/waza-browse-list.js';
import { renderDetail } from '../views/waza-detail.js';
import { showToast } from '../components/show-toast.js';
import { getIsGuest, getToken } from '../state/user-state.js';

// ── Progress helpers ─────────────────────────────────────────

/**
 * @brief Creates an empty progress object for a waza.
 *
 * @return {Object} An object with a markings array of six false values and a null like property.
 */
export var emptyP = function () {
  return { markings: Array(6).fill(false), like: null };
};

/**
 * @brief Retrieves the progress object for a given waza ID.
 *
 * @param {number} id The waza identifier.
 * @return {Object} The progress object from state, or an empty progress object if none exists.
 * @see emptyP
 */
export var getP = function (id) {
  return state.prog[id] || emptyP();
};

// ── Labels helpers ───────────────────────────────────────────

/**
 * @brief Persists marking labels to localStorage and, if the user is logged in, to the server via API.
 *
 * @see api
 * @return {Promise<void>}
 */
export async function saveLabels() {
  // Always save to localStorage (for guest mode and offline access)
  localStorage.setItem(LS_LABELS, JSON.stringify(state.markingLabels));

  // For logged-in users, also save to server
  if (!getIsGuest() && getToken()) {
    try {
      await api('/api/labels', 'POST', { labels: state.markingLabels });
    } catch (err) {
      console.warn('Failed to save labels to server:', err);
    }
  }
}

/**
 * @brief Saves progress for a specific waza (markings/like) to local state and persists to storage.
 *
 * Updates the in-memory progress object, then writes to localStorage for guest users
 * or sends an API request for authenticated users. Also updates like/dislike counts on the
 * corresponding waza data and shows a transient "Saved" indicator.
 *
 * @param {number} id - The waza identifier.
 * @param {Object} patch - Partial progress object to merge into existing progress.
 * @param {Object} [opts={}] - Options object.
 * @param {boolean} [opts.skipListRender=false] - If true, skips re-rendering the browse list after save.
 * @see getP
 * @see loadLocal
 * @see saveLocal
 * @see renderList
 * @see renderDetail
 * @return {Promise<void>}
 */
export async function saveP(id, patch, opts = {}) {
  const skipListRender = !!opts.skipListRender;
  state.prog[id] = { ...getP(id), ...patch, updated_at: new Date().toISOString() };
  if (getIsGuest()) {
    const l = loadLocal();
    l[id] = state.prog[id];
    saveLocal(l);
    if (!skipListRender) renderList();
    renderDetail();
  } else {
    state.savingIds.add(id);
    renderDetail();
    try {
      const res = await api('/api/progress', 'POST', {
        waza_id: id,
        markings: JSON.stringify(state.prog[id].markings),
        like: state.prog[id].like,
      });
      if (res.error) {
        console.warn('Progress save failed:', res.error);
      } else if (res.like_count != null) {
        const w = state.wazaData.find((x) => x.id === id);
        if (w) {
          w.like_count = res.like_count;
          w.dislike_count = res.dislike_count;
        }
      }
    } catch (err) {
      console.warn('Progress save error:', err);
    }
    state.savingIds.delete(id);
    if (!skipListRender) renderList();
    renderDetail();
    showToast('Saved ✓', 'green');
  }
}
