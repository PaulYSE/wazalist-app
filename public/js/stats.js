/* stats.js — the Stats dashboard (counts, recently-updated, coverage). */
import { state } from './state.js';
import { getP } from './core.js';
import { dispName } from './search.js';
import {markingStyle, markingPips} from './render-helpers.js';

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d + 'd ago';
  if (h > 0) return h + 'h ago';
  if (m > 0) return m + 'm ago';
  return 'just now';
}

export function renderDashStats() {
  let markingd = 0;
  state.wazaData.forEach(w => {
    const p = getP(w.id);
    if (p.markings && p.markings.some(Boolean)) markingd++;
  });

  // ── Overview cards (only marked and total) ────────────────
  const overviewHTML =
    '<div class="dstats" style="grid-template-columns:repeat(2,1fr)">'
    + '<div class="scard"><div class="n" style="color:var(--accent)">' + markingd + '</div><div class="l">Marked</div></div>'
    + '<div class="scard"><div class="n">' + state.wazaData.length + '</div><div class="l">Total Waza</div></div>'
    + '</div>';

  // ── Recently updated (past year) ──────────────────────────
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
  const recent = state.wazaData
    .filter(w => {
      const p = state.prog[w.id];
      if (!p || !p.updated_at) return false;
      const updatedTime = new Date(p.updated_at).getTime();
      return updatedTime >= oneYearAgo;
    })
    .sort((a, b) => new Date(state.prog[b.id].updated_at) - new Date(state.prog[a.id].updated_at));

  const recentHTML = '<div class="dsec2"><h3>Recent activity (past year)</h3>'
    + (recent.length
      ? recent.map(w => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const _ms4 = markingStyle(markings); return '<div class="recent-row ' + _ms4.cls + '" data-id="' + w.id + '" style="' + _ms4.style + '">'
          + '<span class="drn">' + (w.name_jp || '—') + '</span>'
          + '<span class="drs">' + dispName(w) + '</span>'
          + '<span style="margin-left:auto;display:flex;gap:2px">' + markingPips(markings) + '</span>'
          + '<span class="recent-time">' + timeAgo(p.updated_at) + '</span>'
          + '</div>';
      }).join('')
      : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No activity in the past year.</div>')
    + '</div>';

  // ── Coverage by family (sorted by % completion) ───────────
  const families = {};
  state.wazaData.forEach(w => {
    [w.parent_en0, w.parent_en1].filter(Boolean).forEach(fam => {
      if (!families[fam]) families[fam] = { total: 0, touched: 0 };
      families[fam].total++;
      const p = getP(w.id);
      if (p.markings && p.markings.some(Boolean)) families[fam].touched++;
    });
  });
  const noFamily = state.wazaData.filter(w => !w.parent_en0 && !w.parent_en1);
  if (noFamily.length) {
    families['Uncategorised'] = { total: noFamily.length, touched: noFamily.filter(w => { const p = getP(w.id); return p.markings && p.markings.some(Boolean); }).length };
  }

  // Sort by coverage percentage (descending), then by total count
  const famEntries = Object.entries(families).sort((a, b) => {
    const pctA = a[1].total ? (a[1].touched / a[1].total) : 0;
    const pctB = b[1].total ? (b[1].touched / b[1].total) : 0;
    if (pctB !== pctA) return pctB - pctA; // Higher % first
    return b[1].total - a[1].total; // Then by total count
  });

  const covHTML = '<div class="dsec2"><h3>Coverage by family</h3>'
    + famEntries.map(([fam, { total, touched }]) => {
      const pct = total ? Math.round(touched / total * 100) : 0;
      const hasZeroCoverage = touched === 0;
      return '<div class="cov-row' + (hasZeroCoverage ? ' cov-row-zero' : '') + '">'
        + '<div class="cov-label"><span>' + fam + '</span><span style="color:var(--text3)">' + touched + ' / ' + total + '</span></div>'
        + '<div class="cov-track"><div class="cov-fill" style="width:' + pct + '%"></div></div>'
        + '</div>';
    }).join('')
    + '</div>';

  const container = document.getElementById('dashStats');
  container.innerHTML = overviewHTML + recentHTML + covHTML;

  container.querySelectorAll('.recent-row').forEach(el => {
    el.addEventListener('click', () => {
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });
}

// ── Rotating username placeholder ───────────────────────────────
