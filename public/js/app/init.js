/**
 * @file app/init.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-21
 * @brief Application initialization module. Sets up UI, loads user session, waza data, progress, labels, and handles URL parameters.
 */

import { api } from '../services/api.js';
import { state } from '../state/state.js';
import { LS_LABELS } from '../state/localStorage.js';
import {
  renderList,
  syncBrowseViewControls,
  syncBrowseSortControls,
} from '../views/waza-browse-list.js';
import { selectWazaFromHistory, renderDetail } from '../views/waza-detail.js';
import { renderDashStats } from '../views/stats.js';
import { activateTab, startWazaPlaceholderRotation } from './shell.js';
import { checkAutoImport } from '../features/share-list.js';
import { parseRoute, replaceRoute } from './router.js';
import {
  getCurrentUsername,
  getIsAdmin,
  getIsGuest,
  setCurrentUserId,
  setCurrentUsername,
  setIsAdmin,
} from '../state/user-state.js';

// ── Initialization entry point ─────────────────────────────────────

/**
 * @brief Initializes the entire application.
 *
 * Hides auth UI, shows main app, applies guest/admin chrome, loads waza data,
 * fetches user progress and labels (if authenticated), renders browse list and stats,
 * syncs sort/view controls, handles waza URL parameters, starts placeholder rotation,
 * and checks for auto-import from share links.
 *
 * @return {Promise<void>}
 */
export async function initApp() {
  // ── UI shell setup ──────────────────────────────────────────
  document.getElementById('authWrap').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('guestBadge').style.display = getIsGuest() ? '' : 'none';
  document.getElementById('logoutBtn').textContent = getIsGuest() ? 'Sign in' : 'Sign out';
  const mobLogoutBtn = document.getElementById('mobLogoutBtn');
  mobLogoutBtn.innerHTML = getIsGuest()
    ? '<span class="mob-menu-item-icon">←</span><span>Sign in</span>'
    : '<span class="mob-menu-item-icon">→</span><span>Sign out</span>';

  // Hide admin/new-waza buttons until user identity is confirmed.
  document.getElementById('adminLink').style.display = 'none';
  document.getElementById('mobAdminLink').style.display = 'none';
  document.getElementById('newWazaBtn').style.display = 'none';
  document.getElementById('mobNewWazaBtn').style.display = 'none';
  document.getElementById('countBar').textContent = 'Loading Waza…';

  // ── Load waza data ─────────────────────────────────────────
  const wazaRes = await api('/api/waza');
  state.wazaData = Array.isArray(wazaRes) ? wazaRes : [];

  // ── Load user-specific data (if logged in) ─────────────────
  if (!getIsGuest()) {
    // Re-derive identity (incl. admin status) from the session token.
    // This is what fixes admin status vanishing on refresh.
    try {
      const meRes = await api('/api/me');
      if (meRes && meRes.user) {
        setIsAdmin(meRes.user.is_admin);
        setCurrentUsername(meRes.user.username);
        setCurrentUserId(meRes.user.id);
      }
    } catch (err) {
      console.warn('Session restore error:', err);
    }

    // Load progress
    try {
      const progRes = await api('/api/progress');
      if (Array.isArray(progRes))
        progRes.forEach((p) => {
          let markings = Array(6).fill(false);
          try {
            if (p.markings) markings = JSON.parse(p.markings);
          } catch {
            // malformed markings JSON from the server — keep the empty default
          }
          state.prog[p.waza_id] = {
            markings,
            like: p.like || null,
            updated_at: p.updated_at || null,
          };
        });
    } catch (err) {
      console.warn('Progress load error:', err);
    }

    // Load marking labels from server for logged-in users
    try {
      const labelsRes = await api('/api/labels');
      if (labelsRes && Array.isArray(labelsRes.labels)) {
        state.markingLabels = labelsRes.labels;
        // Also update localStorage for offline access
        localStorage.setItem(LS_LABELS, JSON.stringify(state.markingLabels));
      }
    } catch (err) {
      console.warn('Labels load error:', err);
    }
  }

  // ── Username badge ─────────────────────────────────────────
  const ub = document.getElementById('usernameBadge');
  if (!getIsGuest() && getCurrentUsername()) {
    ub.textContent = '@' + getCurrentUsername();
    ub.style.display = '';
  } else {
    ub.style.display = 'none';
  }

  // ── Render views ────────────────────────────────────────────
  renderList();
  renderDetail();
  renderDashStats();

  // ── Admin-only chrome ──────────────────────────────────────
  if (getIsAdmin()) {
    document.getElementById('adminLink').style.display = '';
    document.getElementById('mobAdminLink').style.display = '';
  }

  // ── Sync UI controls ───────────────────────────────────────
  syncBrowseSortControls();
  syncBrowseViewControls();

  // ── Background tasks ───────────────────────────────────────
  startWazaPlaceholderRotation();
  checkAutoImport();

  // ── Route reconciliation ──────────────────────────────────
  // Boot into whatever view the URL describes (tab + optional waza).
  const { tab, wazaParam } = parseRoute();
  if (tab !== 'browse') {
    activateTab(tab); // visual switch into the deep-linked tab
  }

  // Normalize the initial entry so it carries state + a clean slug URL
  // (e.g. "/" becomes "/browse"). replaceRoute — don't add a history entry.
  if (wazaParam && tab === 'browse') {
    const target = (() => {
      const id = parseInt(wazaParam);
      if (!isNaN(id) && state.wazaData.some((w) => w.id === id)) return id;
      const decoded = decodeURIComponent(wazaParam);
      const m = state.wazaData.find((w) => w.name_jp && w.name_jp.trim() === decoded);
      return m ? m.id : null;
    })();
    if (target != null) {
      selectWazaFromHistory(target); // open without pushing
      replaceRoute('browse', target); // normalize URL to numeric id
    } else {
      replaceRoute('browse', null);
    }
  } else {
    replaceRoute(tab, null);
  }
}
