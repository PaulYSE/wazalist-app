/**
 * @file router.js
 * @author Paul Yong Shao En
 * @brief Maps the URL (path + ?waza=) to app view state and back. Owns the
 *        slug↔tab mapping and all history writes for tab + waza navigation.
 */

// Internal tab key (data-tab value) ↔ URL slug. "browse" tab → /browse.
const TAB_TO_SLUG = {
  browse: 'browse',
  stats: 'stats',
  compare: 'compare',
  contribute: 'contribute',
  account: 'account',
};
const SLUG_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_SLUG).map(([t, s]) => [s, t]));

const DEFAULT_TAB = 'browse';

/**
 * @brief Parse the current URL into { tab, wazaParam }.
 *        wazaParam is the raw ?waza= string (id or JP-name slug) or null,
 *        and is only meaningful when tab === 'browse'.
 *
 * @return {{tab: string, wazaParam: string|null}}
 */
export function parseRoute() {
  const u = new URL(location.href);
  const slug = u.pathname.replace(/^\/+|\/+$/g, ''); // strip slashes → "stats", ""
  const tab = SLUG_TO_TAB[slug] || DEFAULT_TAB;
  const wazaParam = tab === 'browse' ? u.searchParams.get('waza') : null;
  return { tab, wazaParam };
}

/**
 * @brief Build the URL string for a given view. Waza only encoded on browse.
 *
 * @param {string} tab - Internal tab key.
 * @param {number|null} wazaId - Open waza id, or null.
 * @return {string} Absolute path+query, e.g. "/browse?waza=5" or "/stats".
 */
export function buildUrl(tab, wazaId = null) {
  const slug = TAB_TO_SLUG[tab] || DEFAULT_TAB;
  let url = '/' + slug;
  if (tab === 'browse' && wazaId != null) url += '?waza=' + wazaId;
  return url;
}

/**
 * @brief Push a new history entry for the given view.
 *
 * @param {string} tab
 * @param {number|null} wazaId
 * @return {void}
 */
export function pushRoute(tab, wazaId = null) {
  history.pushState({ tab, wazaId: wazaId ?? null }, '', buildUrl(tab, wazaId));
}

/**
 * @brief Replace the current history entry for the given view (no new entry).
 *
 * @param {string} tab
 * @param {number|null} wazaId
 * @return {void}
 */
export function replaceRoute(tab, wazaId = null) {
  history.replaceState({ tab, wazaId: wazaId ?? null }, '', buildUrl(tab, wazaId));
}
