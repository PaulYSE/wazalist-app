/**
 * @file auth.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Authentication module handling guest mode, login, registration, and logout. Manages UI event binding and session state transitions.
 */

import { state } from '../state/state.js';
import { loadLocal } from '../state/localStorage.js';
import { api } from '../services/api.js';
import { initApp } from '../app/init.js';
import { showOnboarding } from '../features/onboarding.js';
import {
  resetToken,
  resetUserState,
  setCurrentUserId,
  setCurrentUsername,
  setIsAdmin,
  setIsGuest,
  setToken,
} from '../state/user-state.js';
import { activateTab } from '../app/shell.js';
import { selectGroupFromHistory } from '../views/groups-browse-list.js';
import { firePendingGroupJoin, hasPendingGroupJoin } from '../features/group-join-link.js';

// ── Auth actions ──────────────────────────────────────────────

/**
 * @brief Initializes the application in guest mode without authentication.
 *
 * Loads locally stored progress data and starts the app with guest privileges.
 *
 * @see loadLocal
 * @see initApp
 * @return {void}
 */
function startGuest() {
  setIsGuest();
  resetToken();
  Object.entries(loadLocal()).forEach(([id, p]) => {
    state.prog[+id] = p;
  });
  initApp();
}

/**
 * @brief Logs the user out by clearing authentication state and local storage, then reloads the page.
 *
 * @return {void}
 */
export const doLogout = () => {
  resetUserState();
  location.reload();
};

/**
 * @brief Authenticates a user with username and password via the login API.
 *
 * Retrieves credentials from login form fields, sends them to the backend,
 * and stores the returned authentication token in state and local storage upon success.
 *
 * @see api
 * @see initApp
 * @return {Promise<void>}
 */
async function doLogin() {
  const username = document.getElementById('li-username').value.trim(),
    password = document.getElementById('li-password').value;
  const e = document.getElementById('li-err');
  e.textContent = '';
  if (!username || !password) {
    e.textContent = 'Please fill in both fields.';
    return;
  }
  const res = await api('/api/login', 'POST', { username, password });
  if (res.error) {
    e.textContent = res.error;
    return;
  }
  setToken(res.token);
  setCurrentUsername(res.user.username);
  setIsAdmin(res.user.is_admin);
  setCurrentUserId(res.user.id);
  await initApp();

  if (hasPendingGroupJoin()) {
    await firePendingGroupJoin((groupId) => {
      activateTab('groups');
      selectGroupFromHistory(groupId);
    });
  }
}

/**
 * @brief Registers a new user account and automatically logs them in upon success.
 *
 * Validates username and password, sends registration data to the API,
 * then authenticates the newly created account and initializes the app.
 *
 * @see api
 * @see initApp
 * @see showOnboarding
 * @return {Promise<void>}
 */
async function doRegister() {
  const username = document.getElementById('rg-username').value.trim(),
    email = document.getElementById('rg-email').value.trim(),
    password = document.getElementById('rg-password').value;
  const e = document.getElementById('rg-err');
  e.className = 'aerr';
  e.textContent = '';
  if (!username || !password) {
    e.textContent = 'Username and password are required.';
    return;
  }
  const res = await api('/api/register', 'POST', {
    username,
    email: email || undefined,
    password,
  });
  if (res.error) {
    e.textContent = res.error;
    return;
  }
  e.className = 'aok';
  e.textContent = 'Account created! Signing you in…';
  const li = await api('/api/login', 'POST', { username, password });
  if (li.token) {
    setToken(li.token);
    setCurrentUsername(li.user.username);
    setCurrentUserId(li.user.id);
    await initApp();
    showOnboarding();

    if (hasPendingGroupJoin()) {
      await firePendingGroupJoin((groupId) => {
        activateTab('groups');
        selectGroupFromHistory(groupId);
      });
    }
  }
}

// ── Wiring ────────────────────────────────────────────────────

/**
 * @brief Initializes authentication UI event handlers for login, registration, guest access, and logout.
 *
 * Sets up click and enter-key listeners for authentication forms, toggles between login and registration panels,
 * and binds the guest and logout buttons to their respective functions.
 *
 * @see startGuest
 * @see doLogin
 * @see doRegister
 * @see doLogout
 * @return {void}
 */
export function initAuth() {
  document.getElementById('toReg').onclick = () => {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('regBox').style.display = '';
  };
  document.getElementById('toLi').onclick = () => {
    document.getElementById('regBox').style.display = 'none';
    document.getElementById('loginBox').style.display = '';
  };

  document.getElementById('guestBtn').onclick = startGuest;
  document.getElementById('guestBtn2').onclick = startGuest;

  document.getElementById('li-btn').onclick = doLogin;
  ['li-username', 'li-password'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') doLogin();
    });
  });

  document.getElementById('rg-btn').onclick = doRegister;
  ['rg-username', 'rg-email', 'rg-password'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') doRegister();
    });
  });

  document.getElementById('logoutBtn').onclick = doLogout;
}
