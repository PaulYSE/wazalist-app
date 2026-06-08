/* api.js */

import { state } from '../state/state.js';

/**
 * @brief Performs an authenticated API request to the backend.
 *
 * @param path The endpoint path (e.g., "/api/user").
 * @param method HTTP method (GET, POST, PUT, DELETE, etc.). Defaults to "GET".
 * @param body Optional request body payload (object). Will be JSON-stringified.
 *
 * @return Promise<object> Parsed JSON response from the server.
 *
 * @throws Will silently return empty object if response body is not valid JSON.
 * @throws Session expiry triggers global handleSessionExpired() on 401 with "Authentication required".
 */
export const api = async (path, method = 'GET', body = null) => {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));

  if (
    res.status === 401 &&
    data?.error === 'Authentication required' &&
    state.token &&
    !state.isGuest
  ) {
    handleSessionExpired();
  }

  return data;
};

/**
 * @brief Handles global session expiration by clearing local storage and reloading the page.
 *
 * @note Uses a module-level flag to ensure the session expiry routine runs only once per page load.
 * @see api function where this handler is invoked on 401 "Authentication required" responses.
 */
let sessionExpiryHandled = false;
function handleSessionExpired() {
  if (sessionExpiryHandled) return;
  sessionExpiryHandled = true;
  localStorage.removeItem('wl_token');
  localStorage.removeItem('wl_username');
  // Brief, so the user isn't confused by a silent jump.
  alert('Your session has expired. Please sign in again.');
  location.reload();
}
