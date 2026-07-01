/**
 * @file features/group-join-link.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-24
 * @brief Handles the ?groupJoinKey= deep-link join flow.
 *
 * When a user opens a join link (built by the Copy Link button in the
 * Edit Group modal), this module:
 *   1. Reads and strips ?groupJoinKey= from the URL at boot.
 *   2. Resolves the group name via the public by-key lookup route.
 *   3. If the user is already logged in: fires the join immediately.
 *   4. If not: shows a dismissible banner on the auth screen, then
 *      fires the join automatically once login or registration completes.
 *
 * The key is held in memory only (never localStorage) — it's a one-time
 * action that should not survive a closed tab or a different login.
 */

import { api } from '../services/api.js';
import { showToast } from '../components/show-toast.js';

// ── Module-level state ────────────────────────────────────────
// These are intentionally plain variables, not exported state accessors.
// Nothing outside this module should read or write them directly.

/** @type {string|null} The raw hex key extracted from ?groupJoinKey= */
let _pendingKey = null;

/** @type {string|null} The group name resolved from the key, for the banner. */
let _pendingGroupName = null;

// ── Public API ────────────────────────────────────────────────

/**
 * @brief Reads ?groupJoinKey= from the current URL, strips it so a page
 *        refresh doesn't retrigger the join, and resolves the group name.
 *
 * Call this ONCE, early in initApp(), before replaceRoute() has a chance
 * to overwrite the URL. Returns without doing anything if the param is
 * absent or malformed.
 *
 * @return {Promise<void>}
 */
export async function checkForGroupJoinKey() {
  const params = new URL(location.href).searchParams;
  const key = params.get('groupJoinKey');

  // Validate: must be a 64-character lowercase hex string.
  // Anything else is either not our param or corrupted — ignore it.
  if (!key || !/^[0-9a-f]{64}$/.test(key)) return;

  // Strip the param from the URL immediately.
  // We use replaceState (not pushState) — stripping a query param
  // should NOT add a new back-button entry. The user pressed a join
  // link; pressing back should take them wherever they came from,
  // not back to the same join URL.
  const cleanUrl = location.pathname;
  history.replaceState({}, '', cleanUrl);

  // Fetch the group name so we can show it in the banner.
  // This is the public GET /api/groups/by-key/:key route from Phase 2a.
  // We do this even if the user is already logged in, because we need
  // the group name for the "Joined X!" toast regardless.
  try {
    const res = await fetch('/api/groups/by-key/' + key);
    const data = await res.json();

    if (!res.ok || data.error) {
      // Key is invalid or the group was deleted — show a toast and stop.
      // Don't show the banner; there's nothing to join.
      showToast('This join link is invalid or has expired.', 'red');
      return;
    }

    // Key is valid — stash both pieces of state for later use.
    _pendingKey = key;
    _pendingGroupName = data.name;
  } catch {
    // Network failure — fail silently. The user can still use the app
    // normally; we just won't auto-join them.
    console.warn('[group-join-link] Failed to resolve group name from key');
  }
}

/**
 * @brief Whether a valid pending join key is currently stashed.
 *
 * Used by init.js to decide whether to fire immediately (logged-in path)
 * or hand off to the auth screen (logged-out path).
 *
 * @return {boolean}
 */
export function hasPendingGroupJoin() {
  return _pendingKey !== null;
}

/**
 * @brief Fires the pending join immediately, for an already-logged-in user.
 *
 * Calls POST /api/groups/join-by-key, shows a toast, then navigates to
 * the Groups tab and selects the newly-joined group.
 *
 * @param {Function} navigateToGroup - Callback: navigateToGroup(groupId)
 *   Opens the Groups tab and selects the given group. Provided by the
 *   caller so this module doesn't need to import shell.js or groups.js
 *   directly (keeps the dependency tree clean).
 * @return {Promise<void>}
 */
export async function firePendingGroupJoin(navigateToGroup) {
  if (!_pendingKey) return;

  const key = _pendingKey;
  const groupName = _pendingGroupName || 'the Group';

  // Clear state immediately — even if the API call fails, we don't want
  // a broken key being retried on the next login attempt in this session.
  _pendingKey = null;
  _pendingGroupName = null;

  try {
    const res = await api('/api/groups/join-by-key', 'POST', { key });

    if (res.error) {
      showToast(res.error, 'red');
      return;
    }

    if (res.status === 'already_member') {
      showToast('You are already a member of ' + groupName + '.', 'amber');
    } else {
      showToast('Joined ' + groupName + '!', 'green');
    }

    // Navigate to the Groups tab and open this specific group's detail.
    if (typeof navigateToGroup === 'function') {
      navigateToGroup(res.group_id);
    }
  } catch {
    showToast('Failed to complete the group join. Please try again.', 'red');
  }
}

/**
 * @brief Cancels the pending join — called when the user clicks ✕ on
 *        the auth-screen banner.
 *
 * Clears the stashed key and name, and removes the banner from the DOM.
 *
 * @return {void}
 */
export function dismissPendingJoin() {
  _pendingKey = null;
  _pendingGroupName = null;
  document.getElementById('groupJoinBanner')?.remove();
}

/**
 * @brief Returns the stashed group name, or null if no join is pending.
 *
 * Used by showPendingJoinBanner() to display the group's name in the
 * "Sign in to join [Group Name]" text.
 *
 * @return {string|null}
 */
export function getPendingGroupName() {
  return _pendingGroupName;
}

/**
 * @brief Shows the "Sign in to join [Group Name]" banner on the auth screen.
 *
 * Call this from the logged-out path in main.js (i.e., when the app
 * detects a pending join but the user hasn't authenticated yet).
 * Does nothing if no pending join exists.
 *
 * @return {void}
 */
export function showPendingJoinBanner() {
  if (!_pendingKey || !_pendingGroupName) return;

  const banner = document.getElementById('groupJoinBanner');
  const nameEl = document.getElementById('groupJoinBannerName');
  const dismissBtn = document.getElementById('groupJoinBannerDismiss');

  if (!banner || !nameEl) return;

  nameEl.textContent = _pendingGroupName;
  banner.style.display = 'flex';

  dismissBtn?.addEventListener('click', () => {
    dismissPendingJoin();
  });
}
