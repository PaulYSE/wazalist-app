/* core.js — the lifecycle: api() fetch wrapper, guest/login, initApp(),
   and progress saving (saveP/saveLabels). This is where the app boots its data. */

import { state, loadLocal, saveLocal, LS_KEY, LS_LABELS, LS_SORT, LS_VIEW } from './state.js'
import { renderList, renderDetail } from './render.js';
import { renderDashStats } from './stats.js';
import { startWazaPlaceholderRotation } from './ui.js';
import { checkAutoImport } from './share.js'
import { showOnboarding } from './onboarding.js';

const api = async (path, method = 'GET', body = null) => {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...(state.token ? { 'Authorization': 'Bearer ' + state.token } : {}) } };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(path, opts)).json();
};

// ── Auth ─────────────────────────────────────────────────────
document.getElementById('toReg').onclick = () => { document.getElementById('loginBox').style.display = 'none'; document.getElementById('regBox').style.display = ''; };
document.getElementById('toLi').onclick = () => { document.getElementById('regBox').style.display = 'none'; document.getElementById('loginBox').style.display = ''; };

function startGuest() { state.isGuest = true; state.token = ''; Object.entries(loadLocal()).forEach(([id, p]) => { state.prog[+id] = p; }); initApp(); }
document.getElementById('guestBtn').onclick = startGuest;
document.getElementById('guestBtn2').onclick = startGuest;

document.getElementById('li-btn').onclick = async () => {
  const username = document.getElementById('li-username').value.trim(), password = document.getElementById('li-password').value;
  const e = document.getElementById('li-err'); e.textContent = '';
  if (!username || !password) { e.textContent = 'Please fill in both fields.'; return; }
  const res = await api('/api/login', 'POST', { username, password });
  if (res.error) { e.textContent = res.error; return; }
  state.token = res.token; localStorage.setItem('wl_token', state.token);
  state.currentUsername = res.user.username; localStorage.setItem('wl_username', state.currentUsername);
  state.isAdmin = !!res.user.is_admin;
  initApp();
};

document.getElementById('rg-btn').onclick = async () => {
  const username = document.getElementById('rg-username').value.trim(), email = document.getElementById('rg-email').value.trim(), password = document.getElementById('rg-password').value;
  const e = document.getElementById('rg-err'); e.className = 'aerr'; e.textContent = '';
  if (!username || !password) { e.textContent = 'Username and password are required.'; return; }
  const res = await api('/api/register', 'POST', { username, email: email || undefined, password });
  if (res.error) { e.textContent = res.error; return; }
  e.className = 'aok'; e.textContent = 'Account created! Signing you in…';
  const li = await api('/api/login', 'POST', { username, password });
  if (li.token) { state.token = li.token; localStorage.setItem('wl_token', state.token); state.currentUsername = li.user.username; localStorage.setItem('wl_username', state.currentUsername); initApp(); showOnboarding(); }
};

export const doLogout = () => { state.token = ''; state.isGuest = false; state.currentUsername = ''; localStorage.removeItem('wl_token'); localStorage.removeItem('wl_username'); location.reload(); };
document.getElementById('logoutBtn').onclick = doLogout;

// ── Init ─────────────────────────────────────────────────────
export async function initApp() {
  // Stop username placeholder rotation if it's running
  if (typeof stopUsernamePlaceholderRotation === 'function') {
    stopUsernamePlaceholderRotation();
  }
  document.getElementById('authWrap').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('guestBadge').style.display = state.isGuest ? '' : 'none';
  document.getElementById('logoutBtn').textContent = state.isGuest ? 'Sign in' : 'Sign out';
  const mobLogoutBtn = document.getElementById('mobLogoutBtn');
  mobLogoutBtn.innerHTML = state.isGuest
    ? '<span class="mob-menu-item-icon">←</span><span>Sign in</span>'
    : '<span class="mob-menu-item-icon">→</span><span>Sign out</span>';
  const ub = document.getElementById('usernameBadge');
  if (!state.isGuest && state.currentUsername) { ub.textContent = '@' + state.currentUsername; ub.style.display = ''; } else { ub.style.display = 'none'; }
  document.getElementById('adminLink').style.display = 'none';
  document.getElementById('mobAdminLink').style.display = 'none';
  document.getElementById('newWazaBtn').style.display = 'none';
  document.getElementById('mobNewWazaBtn').style.display = 'none';
  document.getElementById('countBar').textContent = 'Loading Waza…';
  const wazaRes = await api('/api/waza');
  state.wazaData = Array.isArray(wazaRes) ? wazaRes : [];
  if (!state.isGuest) {
    try {
      const progRes = await api('/api/progress');
      if (Array.isArray(progRes)) progRes.forEach(p => {
        let markings = Array(6).fill(false);
        try { if (p.markings) markings = JSON.parse(p.markings); } catch { }
        state.prog[p.waza_id] = { markings, like: p.like || null, updated_at: p.updated_at || null };
      });
    } catch (err) { console.warn('Progress load error:', err); }

    // Load marking labels from server for logged-in users
    try {
      const labelsRes = await api('/api/labels');
      if (labelsRes && Array.isArray(labelsRes.labels)) {
        state.markingLabels = labelsRes.labels;
        // Also update localStorage for offline access
        localStorage.setItem(LS_LABELS, JSON.stringify(state.markingLabels));
      }
    } catch (err) { console.warn('Labels load error:', err); }
  }
  renderList(); renderDashStats();

  // Sync sort dropdowns with loaded preferences
  document.getElementById('browseSortField').value = state.browseSortField;
  document.getElementById('browseSortFieldMob').value = state.browseSortField;
  document.getElementById('browseSortOrder').value = state.browseSortOrder;
  document.getElementById('browseSortOrderMob').value = state.browseSortOrder;
  const isDefault = state.browseSortField === 'default';
  document.getElementById('browseSortOrder').disabled = isDefault;
  document.getElementById('browseSortOrderMob').disabled = isDefault;

  // Sync view style dropdowns with loaded preference
  document.getElementById('browseViewSelect').value = state.browseListView;
  document.getElementById('browseViewSelectMob').value = state.browseListView;
  // Sync mobile view style dropdown
  const mobileViewSelect = document.getElementById('viewStyleSelectMobile');
  if (mobileViewSelect) mobileViewSelect.value = state.browseListView;

  // Check for ?waza= in URL (from shared links or back navigation)
  const wazaParam = new URL(location.href).searchParams.get('waza');
  if (wazaParam) {
    // Parse as numeric ID (primary format)
    const id = parseInt(wazaParam);
    if (!isNaN(id) && state.wazaData.some(w => w.id === id)) {
      selectWaza(id);
    } else {
      // Backward compatibility: try matching by Japanese name slug
      const decodedSlug = decodeURIComponent(wazaParam);
      const match = state.wazaData.find(w => w.name_jp && w.name_jp.trim() === decodedSlug);
      if (match) {
        selectWaza(match.id);
      }
    }
  }
  startWazaPlaceholderRotation();
  checkAutoImport();
}
if (state.token) initApp();

// ── Progress helpers ─────────────────────────────────────────
export var emptyP = function () { return { shapes: Array(6).fill(false), like: null }; };
export var getP = function (id) { return state.prog[id] || emptyP(); };

// ── Labels helpers ───────────────────────────────────────────
export async function saveLabels() {
  // Always save to localStorage (for guest mode and offline access)
  localStorage.setItem(LS_LABELS, JSON.stringify(state.markingLabels));

  // For logged-in users, also save to server
  if (!state.isGuest && state.token) {
    try {
      await api('/api/labels', 'POST', { labels: state.markingLabels });
    } catch (err) {
      console.warn('Failed to save labels to server:', err);
    }
  }
}

export async function saveP(id, patch) {
  state.prog[id] = { ...getP(id), ...patch, updated_at: new Date().toISOString() };
  if (state.isGuest) { const l = loadLocal(); l[id] = state.prog[id]; saveLocal(l); renderList(); renderDetail(); renderDashStats(); }
  else {
    state.savingIds.add(id);
    renderDetail(); // show spinning state immediately
    try {
      const res = await api('/api/progress', 'POST', { waza_id: id, markings: JSON.stringify(state.prog[id].markings), like: state.prog[id].like });
      if (res.error) { console.warn('Progress save failed:', res.error); }
      else if (res.like_count != null) {
        // Apply fresh aggregate counts back to wazaData so cards update immediately
        const w = state.wazaData.find(x => x.id === id);
        if (w) { w.like_count = res.like_count; w.dislike_count = res.dislike_count; }
      }
    } catch (err) { console.warn('Progress save error:', err); }
    state.savingIds.delete(id);
    renderList(); renderDetail(); renderDashStats();
    // Flash "Saved ✓" indicator
    const indicator = document.getElementById('saveIndicator');
    if (indicator) { indicator.style.opacity = '1'; clearTimeout(indicator._t); indicator._t = setTimeout(() => { indicator.style.opacity = '0'; }, 1400); }
  }
}

// ── Populate filter dropdowns (removed) ─────────────────────────────────

