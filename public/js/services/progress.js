import { state } from '../state/state.js';
import { LS_LABELS, loadLocal, saveLocal } from '../state/localStorage.js';
import { api } from './api.js';
import { renderList } from '../views/browse-list.js';
import { renderDetail } from '../views/waza-detail.js';

// ── Progress helpers ─────────────────────────────────────────
export var emptyP = function () {
  return { shapes: Array(6).fill(false), like: null };
};
export var getP = function (id) {
  return state.prog[id] || emptyP();
};

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
  if (state.isGuest) {
    const l = loadLocal();
    l[id] = state.prog[id];
    saveLocal(l);
    renderList();
    renderDetail();
  } else {
    state.savingIds.add(id);
    renderDetail(); // show spinning state immediately
    try {
      const res = await api('/api/progress', 'POST', {
        waza_id: id,
        markings: JSON.stringify(state.prog[id].markings),
        like: state.prog[id].like,
      });
      if (res.error) {
        console.warn('Progress save failed:', res.error);
      } else if (res.like_count != null) {
        // Apply fresh aggregate counts back to wazaData so cards update immediately
        const w = state.wazaData.find((x) => x.id === id);
        if (w) {
          w.like_count = res.like_count;
          w.dislike_count = res.dislike_count;
        }
      }
    } catch (err) {
      console.warn('Progress save error:', err);
    }
    state.savingIds.delete(id);
    renderList();
    renderDetail();
    // Flash "Saved ✓" indicator
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
      indicator.style.opacity = '1';
      clearTimeout(indicator._t);
      indicator._t = setTimeout(() => {
        indicator.style.opacity = '0';
      }, 1400);
    }
  }
}
