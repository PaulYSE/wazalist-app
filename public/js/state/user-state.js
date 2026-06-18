/**
 * @file state/user-state.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-18
 * @brief User-specific application state: identity, authentication, and memberships.
 *
 * Every state member has a get(), set(), and reset() function.
 * resetAll() calls all individual reset functions to return to initial values.
 */

// ── User state ───────────────────────────────────────────────

/** @type {Object} User state container. */
const userState = {
  /** @type {number|null} The current user's database ID. */
  currentUserId: null,

  /** @type {string} The current user's username. */
  currentUsername: '',

  /** @type {string} The current user's session token. */
  token: '',

  /** @type {boolean} Whether the user is in guest mode. */
  isGuest: false,

  /** @type {boolean} Whether the user has admin privileges. */
  isAdmin: false,

  /** @type {Object[]} Groups the current user is a member of. */
  myGroups: [],

  /** @type {boolean} Whether the user's groups have been loaded. */
  myGroupsLoaded: false,
};

// ── currentUserId ────────────────────────────────────────────

/**
 * @brief Accessors for the current user's database ID.
 *
 * - getCurrentUserId() → {number|null}
 * - setCurrentUserId(id) → {void}
 * - resetCurrentUserId() → {void}
 */
export function getCurrentUserId() {
  return userState.currentUserId;
}
export function setCurrentUserId(id) {
  userState.currentUserId = id;
}
export function resetCurrentUserId() {
  userState.currentUserId = null;
}

// ── currentUsername ──────────────────────────────────────────

/**
 * @brief Accessors for the current user's username.
 *
 * - getCurrentUsername() → {string}
 * - setCurrentUsername(name) → {void} (also persists to localStorage)
 * - resetCurrentUsername() → {void} (also removes from localStorage)
 */
export function getCurrentUsername() {
  return userState.currentUsername;
}
export function setCurrentUsername(name) {
  userState.currentUsername = name;
  localStorage.setItem('wl_username', name);
}
export function resetCurrentUsername() {
  userState.currentUsername = '';
  localStorage.removeItem('wl_username');
}

// ── token ────────────────────────────────────────────────────

/**
 * @brief Accessors for the user's session token.
 *
 * - getToken() → {string}
 * - setToken(token) → {void} (also persists to localStorage)
 * - resetToken() → {void} (also removes from localStorage)
 */
export function getToken() {
  return userState.token;
}
export function setToken(token) {
  userState.token = token;
  localStorage.setItem('wl_token', token);
}
export function resetToken() {
  userState.token = '';
  localStorage.removeItem('wl_token');
}

// ── isGuest ──────────────────────────────────────────────────

/**
 * @brief Accessors for the guest mode flag.
 *
 * - getIsGuest() → {boolean}
 * - setIsGuest(val) → {void}
 * - resetIsGuest() → {void}
 */
export function getIsGuest() {
  return userState.isGuest;
}
export function setIsGuest() {
  userState.isGuest = true;
}
export function resetIsGuest() {
  userState.isGuest = false;
}

// ── isAdmin ──────────────────────────────────────────────────

/**
 * @brief Accessors for the admin flag.
 *
 * - getIsAdmin() → {boolean}
 * - setIsAdmin(val) → {void}
 * - resetIsAdmin() → {void}
 */
export function getIsAdmin() {
  return userState.isAdmin;
}
export function setIsAdmin(val) {
  userState.isAdmin = !!val;
}
export function resetIsAdmin() {
  userState.isAdmin = false;
}

// ── myGroups ─────────────────────────────────────────────────

/**
 * @brief Accessors for the user's group memberships.
 *
 * - getMyGroups() → {Object[]}
 * - setMyGroups(groups) → {void}
 * - resetMyGroups() → {void}
 */
export function getMyGroups() {
  return userState.myGroups;
}
export function setMyGroups(groups) {
  userState.myGroups = Array.isArray(groups) ? groups : [];
}
export function resetMyGroups() {
  userState.myGroups = [];
}

// ── myGroupsLoaded ───────────────────────────────────────────

/**
 * @brief Accessors for the myGroups loaded flag.
 *
 * - getMyGroupsLoaded() → {boolean}
 * - setMyGroupsLoaded(loaded) → {void}
 * - resetMyGroupsLoaded() → {void}
 */
export function getMyGroupsLoaded() {
  return userState.myGroupsLoaded;
}
export function setMyGroupsLoaded() {
  userState.myGroupsLoaded = true;
}
export function resetMyGroupsLoaded() {
  userState.myGroupsLoaded = false;
}

// ── Derived helpers ──────────────────────────────────────────

/**
 * @brief Whether the user is authenticated (not a guest and has a token).
 *
 * @return {boolean}
 */
export function isLoggedIn() {
  return !userState.isGuest && !!userState.token;
}

// ── Reset multiple ───────────────────────────────────────────

/**
 * @brief Resets all user state to initial values.
 *
 * Clears identity, authentication, and memberships.
 * Does NOT clear localStorage — individual reset functions handle that.
 *
 * @return {void}
 */
export function resetUserState() {
  resetCurrentUserId();
  resetCurrentUsername();
  resetToken();
  resetIsGuest();
  resetIsAdmin();
  resetMyGroups();
  resetMyGroupsLoaded();
}
