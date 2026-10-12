/**
 * @file app/router.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-28
 * @brief Maps the URL (path + ?waza= or ?group=) to app view state and back. Owns the slug↔tab mapping and all history writes for tab, waza, and group navigation.
 */

// ── Constants ──────────────────────────────────────────────────

/**
 * @brief Internal tab key (data-tab value) → URL slug mapping.
 *
 * @type {Object<string, string>}
 */
const TAB_TO_SLUG = {
  browse: 'browse',
  stats: 'stats',
  compare: 'compare',
  groups: 'groups',
  contribute: 'contribute',
  account: 'account',
};

/**
 * @brief URL slug → internal tab key mapping (inverse of TAB_TO_SLUG).
 *
 * @type {Object<string, string>}
 */
const SLUG_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_SLUG).map(([t, s]) => [s, t]));

/** @type {string} Default tab when no valid slug is present. */
const DEFAULT_TAB = 'browse';

// ── Route parsing ─────────────────────────────────────────────

/**
 * @brief Parse the current URL into { tab, wazaParam, groupParam }.
 *
 * wazaParam is the raw ?waza= string (id or JP-name slug) or null,
 * and is only meaningful when tab === 'browse'.
 * groupParam is the raw ?group= string (numeric id) or null,
 * and is only meaningful when tab === 'groups'.
 *
 * @return {{tab: string, wazaParam: string|null, groupParam: string|null}}
 */
export function parseRoute() {
  const u = new URL(location.href);
  const slug = u.pathname.replace(/^\/+|\/+$/g, '');
  const tab = SLUG_TO_TAB[slug] || DEFAULT_TAB;
  const wazaParam = tab === 'browse' ? u.searchParams.get('waza') : null;
  const groupParam = tab === 'groups' ? u.searchParams.get('group') : null;
  return { tab, wazaParam, groupParam };
}

// ── URL building ──────────────────────────────────────────────

/**
 * @brief Build the URL string for a given view.
 *
 * @param {string} tab - Internal tab key.
 * @param {number|null} wazaId - Open waza id, or null (browse only).
 * @param {number|null} groupId - Open group id, or null (groups only).
 * @return {string} Absolute path+query, e.g. "/browse?waza=5" or "/groups?group=3".
 */
export function buildUrl(tab, wazaId = null, groupId = null) {
  const slug = TAB_TO_SLUG[tab] || DEFAULT_TAB;
  let url = '/' + slug;
  if (tab === 'browse' && wazaId != null) url += '?waza=' + wazaId;
  if (tab === 'groups' && groupId != null) url += '?group=' + groupId;
  return url;
}

// ── History operations ────────────────────────────────────────

/**
 * @brief Push a new history entry for the given view.
 *
 * @param {string} tab
 * @param {number|null} wazaId
 * @param {number|null} groupId
 * @return {void}
 */
export function pushRoute(tab, wazaId = null, groupId = null) {
  history.pushState(
    { tab, wazaId: wazaId ?? null, groupId: groupId ?? null },
    '',
    buildUrl(tab, wazaId, groupId),
  );
}

/**
 * @brief Replace the current history entry for the given view (no new entry).
 *
 * @param {string} tab
 * @param {number|null} wazaId
 * @param {number|null} groupId
 * @return {void}
 */
export function replaceRoute(
  tab,
  wazaId = null,
  groupId = null,
  opts = {},
) {
  let destination = buildUrl(tab, wazaId, groupId);

  if (opts.preserveExtras) {
    const current = new URL(location.href);
    const canonical = new URL(destination, location.origin);

    current.pathname = canonical.pathname;

    // Reconcile only the active tab's detail parameter.
    // Preserve parameters belonging to other flows.
    if (tab === 'browse') {
      if (wazaId === null) {
        current.searchParams.delete('waza');
      } else {
        current.searchParams.set('waza', String(wazaId));
      }
    }

    if (tab === 'groups') {
      if (groupId === null) {
        current.searchParams.delete('group');
      } else {
        current.searchParams.set('group', String(groupId));
      }
    }

    destination = current.pathname + current.search + current.hash;
  }

  const existingState =
    history.state !== null &&
    typeof history.state === 'object' &&
    !Array.isArray(history.state)
      ? history.state
      : {};

  history.replaceState(
    {
      ...existingState,
      tab,
      wazaId: wazaId ?? null,
      groupId: groupId ?? null,
    },
    '',
    destination,
  );
}
