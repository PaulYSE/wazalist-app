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
import { isGuest, getToken } from '../state/user-state.js';

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
  if (!isGuest() && getToken()) {
    try {
      await api('/api/labels', 'POST', { labels: state.markingLabels });
    } catch (err) {
      console.warn('Failed to save labels to server:', err);
    }
  }
}

/**
 * Saves progress and returns an explicit result.
 *
 * On failure, restores the previous in-memory progress.
 *
 * @return {Promise<{success: boolean, error?: string}>}
 */
export async function saveP(id, patch, opts = {}) {
  const skipListRender = !!opts.skipListRender;

  // Prevent overlapping saves for the same Waza.
  if (state.savingIds.has(id)) {
    return {
      success: false,
      error: 'A save is already in progress for this Waza.',
    };
  }

  const hadPrevious = Object.prototype.hasOwnProperty.call(state.prog, id);
  const previous = state.prog[id];

  const next = {
    ...getP(id),
    ...patch,
    updated_at: new Date().toISOString(),
  };

  // Keep the request snapshot separate from caller-owned arrays.
  if (Array.isArray(next.markings)) {
    next.markings = next.markings.slice();
  }

  state.savingIds.add(id);
  state.prog[id] = next;

  let result;

  try {
    renderDetail();

    if (isGuest()) {
      const local = loadLocal();
      local[id] = next;
      saveLocal(local);
    } else {
      const res = await api('/api/progress', 'POST', {
        waza_id: id,
        markings: JSON.stringify(next.markings),
        like: next.like,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      // Do not accept an empty or unexpected response as confirmation.
      if (res.success !== true) {
        throw new Error('The server did not confirm the save.');
      }

      const w = state.wazaData.find((x) => x.id === id);

      if (w) {
        if (typeof res.like_count === 'number') {
          w.like_count = res.like_count;
        }
        if (typeof res.dislike_count === 'number') {
          w.dislike_count = res.dislike_count;
        }
      }
    }

    result = { success: true };
  } catch (error) {
    // Restore the exact previous local state.
    if (hadPrevious) {
      state.prog[id] = previous;
    } else {
      delete state.prog[id];
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Could not save your progress.';

    console.warn('Progress save failed:', id, error);
    result = { success: false, error: message };
  } finally {
    state.savingIds.delete(id);

    // On failure, rebuild the list to remove optimistic changes,
    // even when the caller requested the single-row optimization.
    if (!skipListRender || !result?.success) {
      renderList();
    }

    renderDetail();
  }

  if (!result.success) {
    showToast(
      'Save not confirmed. Previous local state restored. ' + result.error,
      'red',
    );
  } else if (!isGuest()) {
    showToast('Saved ✓', 'green');
  }

  return result;
}
