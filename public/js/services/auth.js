/* auth.js */

import { state } from '../state/state.js';
import { loadLocal } from '../state/localStorage.js';
import { api } from '../services/api.js';
import { initApp } from '../app/init.js';
import { showOnboarding } from '../features/onboarding.js';

// ── Auth actions ──────────────────────────────────────────────
function startGuest() {
  state.isGuest = true;
  state.token = '';
  Object.entries(loadLocal()).forEach(([id, p]) => {
    state.prog[+id] = p;
  });
  initApp();
}

export const doLogout = () => {
  state.token = '';
  state.isGuest = false;
  state.currentUsername = '';
  localStorage.removeItem('wl_token');
  localStorage.removeItem('wl_username');
  location.reload();
};

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
  state.token = res.token;
  localStorage.setItem('wl_token', state.token);
  state.currentUsername = res.user.username;
  localStorage.setItem('wl_username', state.currentUsername);
  state.isAdmin = !!res.user.is_admin;
  initApp();
}

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
    state.token = li.token;
    localStorage.setItem('wl_token', state.token);
    state.currentUsername = li.user.username;
    localStorage.setItem('wl_username', state.currentUsername);
    initApp();
    showOnboarding();
  }
}

// ── Wiring ────────────────────────────────────────────────────
// Wire up the auth screen (login/register/guest/logout). Called once from main.js.
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