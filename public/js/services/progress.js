/* progress.js */

import { state } from '../state/state.js';
import { LS_LABELS, loadLocal, saveLocal } from '../state/localStorage.js';
import { api } from './api.js';
import { renderList } from '../views/browse-list.js';
import { renderDetail } from '../views/waza-detail.js';

// ── Progress helpers ─────────────────────────────────────────

/**
 * @brief Creates an empty progress object for a problem.
 *
 * @return {object} An object with a shapes array of six false values and a null like property.
 */
export var emptyP = function () {
  return { shapes: Array(6).fill(false), like: null };
};

/**
 * @brief Retrieves the progress object for a given problem ID.
 *
 * @param id The problem identifier.
 * @return {object} The progress object from state, or an empty progress object if none exists.
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
 */
export async function saveLabels() {
  // Always save to localStorage (for guest mode and offline access)
  localStorage.setItem(LS_LABELS, JSON.stringify(state.markingLabels));

  // For logged-in users, also save to server
  if (!state.isGuest && state.token) {
    try {
      await api('/api/labels', 'POST', { labels: state.markingLabels });
    } catch (err) {
      console.warn('Failed to save labels to server:', err);
    }
  }
}

/**
 * @brief Saves progress for a specific problem (shapes/like) to local state and persists to storage.
 *
 * Updates the in-memory progress object, then writes to localStorage for guest users
 * or sends an API request for authenticated users. Also updates like/dislike counts on the
 * corresponding waza data and shows a transient "Saved" indicator.
 *
 * @param id The problem identifier.
 * @param patch Partial progress object to merge into existing progress.
 * @see getP
 * @see loadLocal
 * @see saveLocal
 * @see renderList
 * @see renderDetail
 */
export async function saveP(id, patch) {
  state.prog[id] = { ...getP(id), ...patch, updated_at: new Date().toISOString() };
  if (state.isGuest) {
    const l = loadLocal();
    l[id] = state.prog[id];
    saveLocal(l);
    renderList();
    renderDetail();
  } else {
    state.savingIds.add(id);
    renderDetail(); // show spinning state immediately
    try {
      const res = await api('/api/progress', 'POST', {
        waza_id: id,
        markings: JSON.stringify(state.prog[id].markings),
        like: state.prog[id].like,
      });
      if (res.error) {
        console.warn('Progress save failed:', res.error);
      } else if (res.like_count != null) {
        // Apply fresh aggregate counts back to wazaData so cards update immediately
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
    renderList();
    renderDetail();
    // Flash "Saved ✓" indicator
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
      indicator.style.opacity = '1';
      clearTimeout(indicator._t);
      indicator._t = setTimeout(() => {
        indicator.style.opacity = '0';
      }, 1400);
    }
  }
}
