/**
 * @file init.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Application initialization module. Sets up UI, loads user session, waza data, progress, labels, and handles URL parameters.
 */

import { api } from '../services/api.js';
import { state } from '../state/state.js';
import { LS_LABELS } from '../state/localStorage.js';
import {
  renderList,
  syncBrowseViewControls,
  syncBrowseSortControls,
} from '../views/browse-list.js';
import { selectWaza } from '../views/waza-detail.js';
import { renderDashStats } from '../views/stats.js';
import { startWazaPlaceholderRotation } from './shell.js';
import { checkAutoImport } from '../features/share-list.js';

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
  document.getElementById('authWrap').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('guestBadge').style.display = state.isGuest ? '' : 'none';
  document.getElementById('logoutBtn').textContent = state.isGuest ? 'Sign in' : 'Sign out';
  const mobLogoutBtn = document.getElementById('mobLogoutBtn');
  mobLogoutBtn.innerHTML = state.isGuest
    ? '<span class="mob-menu-item-icon">←</span><span>Sign in</span>'
    : '<span class="mob-menu-item-icon">→</span><span>Sign out</span>';
  const ub = document.getElementById('usernameBadge');
  if (!state.isGuest && state.currentUsername) {
    ub.textContent = '@' + state.currentUsername;
    ub.style.display = '';
  } else {
    ub.style.display = 'none';
  }
  document.getElementById('adminLink').style.display = 'none';
  document.getElementById('mobAdminLink').style.display = 'none';
  document.getElementById('newWazaBtn').style.display = 'none';
  document.getElementById('mobNewWazaBtn').style.display = 'none';
  document.getElementById('countBar').textContent = 'Loading Waza…';
  const wazaRes = await api('/api/waza');
  state.wazaData = Array.isArray(wazaRes) ? wazaRes : [];
  if (!state.isGuest) {
    // Re-derive identity (incl. admin status) from the session token.
    // This is what fixes admin status vanishing on refresh.
    try {
      const meRes = await api('/api/me');
      if (meRes && meRes.user) {
        state.isAdmin = !!meRes.user.is_admin;
        state.currentUsername = meRes.user.username;
      }
    } catch (err) {
      console.warn('Session restore error:', err);
    }
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
  renderList();
  renderDashStats();

  // Show admin-only chrome now that isAdmin is known from the session.
  if (state.isAdmin) {
    document.getElementById('adminLink').style.display = '';
    document.getElementById('mobAdminLink').style.display = '';
  }

  // Sync sort dropdowns with loaded preferences
  syncBrowseSortControls();

  // Sync view style dropdowns with loaded preference
  syncBrowseViewControls();

  // Check for ?waza= in URL (from shared links or back navigation)
  const wazaParam = new URL(location.href).searchParams.get('waza');
  if (wazaParam) {
    // Parse as numeric ID (primary format)
    const id = parseInt(wazaParam);
    if (!isNaN(id) && state.wazaData.some((w) => w.id === id)) {
      selectWaza(id);
    } else {
      // Backward compatibility: try matching by Japanese name slug
      const decodedSlug = decodeURIComponent(wazaParam);
      const match = state.wazaData.find((w) => w.name_jp && w.name_jp.trim() === decodedSlug);
      if (match) {
        selectWaza(match.id);
      }
    }
  }
  startWazaPlaceholderRotation();
  checkAutoImport();
}
