/**
 * @file services/compare-data.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-24
 * @brief Pure data layer for the Compare tab. Converts raw API responses and
 *        locally-saved Imported Lists into the unified entry shape used by
 *        the comparison matrix:
 *
 *          { sourceType, sourceId, username, markings, labels }
 *
 *        where markings is always { [wazaId]: boolean[6] } regardless of
 *        which backend endpoint or local source the data came from.
 *
 *        No DOM access in this file — only fetching and shaping. Keeping
 *        this separate from the rendering layer means the shaping logic can
 *        be unit-tested or swapped without touching any UI code.
 */

import { api } from './api.js';
import { state } from '../state/state.js';
import { getCurrentUserId } from '../state/user-state.js';
import { getImportedList } from '../state/compare-state.js';

// ── Your own entry (no network request — already in local state) ──

/**
 * @brief Builds the "You" entry from local state.
 *
 * Only waza with at least one active marking are included — an all-false
 * progress row carries no information worth a comparison row.
 *
 * @return {Object} { sourceType: 'self', sourceId, username: 'You', markings, labels }.
 */
export function buildYourEntry() {
  const markings = {};
  Object.entries(state.prog).forEach(([wazaId, p]) => {
    if (p.markings && p.markings.some(Boolean)) {
      markings[+wazaId] = p.markings;
    }
  });
  return {
    sourceType: 'self',
    sourceId: getCurrentUserId(),
    username: 'You',
    markings,
    labels: state.markingLabels,
  };
}

// ── Group member entries (network) ───────────────────────────

/**
 * @brief Fetches one Group member's progress and shapes it into an entry.
 *
 * Uses the single-member endpoint, which wraps each waza's markings as
 * { markings, like } — only the markings array is kept; `like` isn't part
 * of the comparison entry shape.
 *
 * @param {number} groupId
 * @param {number} userId
 * @param {string} username - Display name, already known from the member list (avoids a second lookup just for a name).
 * @return {Promise<{entry: Object|null, error: string|null}>}
 */
export async function fetchMemberEntry(groupId, userId, username) {
  try {
    const res = await api('/api/groups/' + groupId + '/members/' + userId + '/progress');
    if (res.error) return { entry: null, error: res.error };

    const markings = {};
    for (const [wazaId, mark] of Object.entries(res.markings || {})) {
      markings[+wazaId] = mark.markings || Array(6).fill(false);
    }

    return {
      entry: {
        sourceType: 'member',
        sourceId: userId,
        username,
        markings,
        labels: res.labels || Array(6).fill(''),
      },
      error: null,
    };
  } catch {
    return { entry: null, error: "Couldn't load this member's list." };
  }
}

/**
 * @brief Fetches multiple Group members' progress in a single request and
 *        shapes each into an entry.
 *
 * Uses POST /api/groups/:id/bulk-progress (server caps this at 10 users per
 * call) instead of one /progress request per member. Note this endpoint
 * returns markings UNWRAPPED — { [wazaId]: boolean[] } directly, with no
 * `like` field at all — unlike the single-member endpoint above. Both are
 * normalized to the same entry shape here either way.
 *
 * @param {number} groupId
 * @param {Array<{id: number, username: string}>} members - Members to fetch, with display names already known.
 * @return {Promise<{entries: Object[], error: string|null}>}
 */
export async function fetchMemberEntries(groupId, members) {
  if (!members.length) return { entries: [], error: null };

  try {
    const userIds = members.map((m) => m.id);
    const res = await api('/api/groups/' + groupId + '/bulk-progress', 'POST', {
      user_ids: userIds,
    });
    if (res.error) return { entries: [], error: res.error };

    const entries = members.map((m) => {
      const memberData = res[m.id] || { markings: {}, labels: Array(6).fill('') };
      const markings = {};
      // Bulk endpoint already returns flat boolean[] per waza — no unwrap needed here.
      for (const [wazaId, marks] of Object.entries(memberData.markings || {})) {
        markings[+wazaId] = marks;
      }
      return {
        sourceType: 'member',
        sourceId: m.id,
        username: m.username,
        markings,
        labels: memberData.labels || Array(6).fill(''),
      };
    });

    return { entries, error: null };
  } catch {
    return { entries: [], error: "Couldn't load the selected members' lists." };
  }
}

// ── Imported List entries (local — no network request) ──────

/**
 * @brief Converts a saved Imported List (from the local library) into an entry.
 *
 * Purely local — the list's full data is already in localStorage via
 * compare-state.js. Returns null if the key isn't found (e.g. it was
 * removed from the library between render and the user's click).
 *
 * @param {string} key - The imported list's share key.
 * @return {Object|null}
 */
export function importedListToEntry(key) {
  const list = getImportedList(key);
  if (!list) return null;

  const markings = {};
  if (list.marks) {
    for (const [wazaId, mark] of Object.entries(list.marks)) {
      markings[+wazaId] = mark.markings || Array(6).fill(false);
    }
  }

  return {
    sourceType: 'imported',
    sourceId: key,
    username: list.name || 'Imported List',
    markings,
    labels: list.labels || Array(6).fill(''),
  };
}
