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
 * Parses the current URL into a recognized tab and applicable detail parameter.
 *
 * Removes leading and trailing slashes from the pathname and matches the
 * resulting slug against the configured application routes. Unknown slugs
 * fall back to the Browse tab.
 *
 * Query parameters are decoded by URLSearchParams but are not validated or
 * resolved. The Waza parameter is returned only for Browse routes, while the
 * Group parameter is returned only for Groups routes. A missing parameter
 * returns null; an explicitly empty parameter returns an empty string.
 *
 * Does not modify browser history, activate views, select details, or render
 * application content.
 *
 * @return {{
 *   tab: string,
 *   wazaParam: (string|null),
 *   groupParam: (string|null)
 * }} Recognized tab and its applicable decoded detail parameter.
 */
export function parseRoute() {
  const u = new URL(location.href);
  const slug = u.pathname.replace(/^\/+|\/+$/g, '');
  const tab = Object.prototype.hasOwnProperty.call(
    SLUG_TO_TAB,
    slug,
  )
    ? SLUG_TO_TAB[slug]
    : DEFAULT_TAB;
  const wazaParam = tab === 'browse' ? u.searchParams.get('waza') : null;
  const groupParam = tab === 'groups' ? u.searchParams.get('group') : null;
  return { tab, wazaParam, groupParam };
}

// ── URL building ──────────────────────────────────────────────

/**
 * Builds an application-relative URL for a tab and optional detail selection.
 *
 * Normalizes an unrecognized tab to the Browse route. Adds a Waza parameter
 * only when the original tab argument is browse, and adds a Group parameter
 * only when the original tab argument is groups.
 *
 * Detail IDs are included when they are not null or undefined. This function
 * does not validate, encode, or normalize the supplied IDs. It does not
 * preserve unrelated query parameters or URL fragments and does not modify
 * browser history or application UI state.
 *
 * @param {string} tab Requested internal tab key.
 * @param {?number=} wazaId Waza ID to include for an explicitly requested
 *     Browse tab. Defaults to null.
 * @param {?number=} groupId Group ID to include for an explicitly requested
 *     Groups tab. Defaults to null.
 * @return {string} Application-relative path and applicable detail query,
 *     such as "/browse?waza=5" or "/groups?group=3".
 */

export function buildUrl(tab, wazaId = null, groupId = null) {
  const normalizedTab = Object.prototype.hasOwnProperty.call(
    TAB_TO_SLUG,
    tab,
  )
    ? tab
    : DEFAULT_TAB;
  
  const slug = TAB_TO_SLUG[normalizedTab];
  let url = '/' + slug;
  if (tab === 'browse' && wazaId != null) url += '?waza=' + wazaId;
  if (tab === 'groups' && groupId != null) url += '?group=' + groupId;
  return url;
}

// ── History operations ────────────────────────────────────────

/**
 * Pushes a normalized application route onto the browser-history stack.
 *
 * Normalizes an unrecognized tab to Browse and retains only the detail ID
 * applicable to the normalized destination tab. The generated URL and stored
 * history state therefore describe the same route.
 *
 * Creates a new history-state object containing tab, wazaId, and groupId.
 * Does not preserve unrelated properties from the current history state.
 *
 * Does not preserve existing query parameters or URL fragments. Does not
 * activate views, select details, or render application content.
 *
 * @param {string} tab Requested destination tab key.
 * @param {?number=} wazaId Selected Waza ID when the normalized destination
 *     is Browse, or null. Defaults to null.
 * @param {?number=} groupId Selected Group ID when the normalized destination
 *     is Groups, or null. Defaults to null.
 * @return {void}
 */
export function pushRoute(tab, wazaId = null, groupId = null) {
  const normalizedTab = Object.prototype.hasOwnProperty.call(
    TAB_TO_SLUG,
    tab,
  )
    ? tab
    : DEFAULT_TAB;

  const normalizedWazaId =
    normalizedTab === 'browse' && wazaId != null
      ? wazaId
      : null;

  const normalizedGroupId =
    normalizedTab === 'groups' && groupId != null
      ? groupId
      : null;

  history.pushState(
    {
      tab: normalizedTab,
      wazaId: normalizedWazaId,
      groupId: normalizedGroupId,
    },
    '',
    buildUrl(
      normalizedTab,
      normalizedWazaId,
      normalizedGroupId,
    ),
  );
}

/**
 * Replaces the current browser-history entry for an application route.
 *
 * By default, generates the destination with buildUrl(), discarding the
 * current query parameters and fragment.
 *
 * When preserveExtras is true, preserves the current query parameters and
 * fragment, replaces the pathname, and reconciles only the destination
 * tab's detail parameter. Parameters belonging to inactive tabs or other
 * flows remain unchanged.
 *
 * Preserves existing custom history-state properties when history.state is
 * a non-null, non-array object. Always overwrites tab, wazaId, and groupId.
 *
 * Does not activate views, select details, or render application content.
 *
 * @param {string} tab Destination tab key.
 * @param {?number=} wazaId Selected Waza ID for Browse, or null.
 *     Defaults to null.
 * @param {?number=} groupId Selected Group ID for Groups, or null.
 *     Defaults to null.
 * @param {{preserveExtras: (boolean|undefined)}=} opts Configuration.
 *     When preserveExtras is true, retains existing query parameters
 *     and the URL fragment. Defaults to an empty object.
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
