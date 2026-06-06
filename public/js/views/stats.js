/* stats.js — the Stats dashboard (counts, recently-updated, coverage). */
import { state } from '../state/state.js';
import { getP } from '../services/progress.js';
import { dispName } from '../lib/search.js';
import { markingStyle, markingPips } from '../components/render-helpers.js';
import { selectWaza } from './waza-detail.js';
import { navigateToBrowse } from '../app/shell.js';
import { escapeHtml } from '../lib/escape.js';

// Persisted toggle state for the combined rankings table (survives re-render).
let rankByFamily = false; // false = rank by author, true = rank by family
let compareCommunity = false; // false = your stats only, true = side-by-side with community

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000),
    h = Math.floor(m / 60),
    d = Math.floor(h / 24);
  if (d > 0) return d + 'd ago';
  if (h > 0) return h + 'h ago';
  if (m > 0) return m + 'm ago';
  return 'just now';
}

export function renderDashStats() {
  // ── Overview counts: marked / liked / disliked / total ──────
  let markingd = 0,
    liked = 0,
    disliked = 0;

  state.wazaData.forEach((w) => {
    const p = getP(w.id);
    if (p.markings && p.markings.some(Boolean)) markingd++;
    if (p.like === 1) liked++;
    else if (p.like === -1) disliked++;
  });

  const overviewHTML =
    '<div class="dsec2"><h3>Your Progress</h3>' +
    '<div class="dstats" style="grid-template-columns:repeat(4,1fr)">' +
    '<div class="scard"><div class="n" style="color:var(--accent)">' +
    markingd +
    '</div><div class="l">Marked</div></div>' +
    '<div class="scard"><div class="n" style="color:var(--green)">' +
    liked +
    '</div><div class="l">Liked</div></div>' +
    '<div class="scard"><div class="n" style="color:var(--red)">' +
    disliked +
    '</div><div class="l">Disliked</div></div>' +
    '<div class="scard"><div class="n">' +
    state.wazaData.length +
    '</div><div class="l">Total Waza</div></div>' +
    '</div></div>';

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // ── Generic top-N aggregator over a set of entity fields ────
  // For each waza, reads the given fields (e.g. the two author slots) and
  // accumulates per distinct entity:
  //   marks  = count of MY marked waza crediting that entity (personal)
  //   likes  = sum of like_count across that entity's waza (global community)
  // Keyed by EN name (fallback JP). Returns top `limit` for the chosen metric.
  function topBy(fieldPairs, metric, limit = 5) {
    const acc = {}; // key → { name, marks, likes }
    state.wazaData.forEach((w) => {
      const p = getP(w.id);
      const isMarked = p.markings && p.markings.some(Boolean);
      const likeCount = w.like_count || 0;
      // Collect this waza's distinct entity names from the field pairs.
      const names = new Set();
      fieldPairs.forEach(([en, jp]) => {
        const name = (w[en] || w[jp] || '').trim();
        if (name) names.add(name);
      });
      names.forEach((name) => {
        if (!acc[name]) acc[name] = { name, marks: 0, likes: 0 };
        if (isMarked) acc[name].marks++;
        acc[name].likes += likeCount;
      });
    });
    return Object.values(acc)
      .filter((e) => e[metric] > 0)
      .sort((a, b) => b[metric] - a[metric] || b.marks - a.marks)
      .slice(0, limit);
  }

  const AUTHOR_FIELDS = [
    ['author_en0', 'author_jp0'],
    ['author_en1', 'author_jp1'],
  ];
  const PARENT_FIELDS = [
    ['parent_en0', 'parent_jp0'],
    ['parent_en1', 'parent_jp1'],
  ];

  // ── Combined rankings table (authors | family, toggleable) ──
  const rankFields = rankByFamily ? PARENT_FIELDS : AUTHOR_FIELDS;
  const rankScope = rankByFamily ? 'parent' : 'author';
  const rankRows = topBy(rankFields, 'marks');

  const rankToggles =
    '<div class="rank-toggles">' +
    '<button class="rank-toggle' +
    (rankByFamily ? '' : ' on') +
    '" id="rankByAuthorBtn">By author</button>' +
    '<button class="rank-toggle' +
    (rankByFamily ? ' on' : '') +
    '" id="rankByFamilyBtn">By family</button>' +
    '<button class="rank-toggle rank-toggle-compare' +
    (compareCommunity ? ' on' : '') +
    '" id="rankCompareBtn">' +
    (compareCommunity ? '✓ ' : '') +
    'Compare to community</button>' +
    '</div>';

  // Column header adapts to compare mode.
  const rankHead = compareCommunity
    ? '<div class="rank-head rank-head-compare"><span>#</span><span></span>' +
      '<span title="Your marks">You</span><span title="Community likes">Likes</span></div>'
    : '<div class="rank-head"><span>#</span><span></span><span title="Your marks">You</span></div>';

  const rankBody = rankRows.length
    ? rankRows
        .map((e, i) => {
          const cells = compareCommunity
            ? '<span class="rank-mine">' +
              e.marks +
              '</span>' +
              '<span class="rank-comm">' +
              e.likes +
              '</span>'
            : '<span class="rank-mine">' + e.marks + '</span>';
          return (
            '<div class="rank-row' +
            (compareCommunity ? ' rank-row-compare' : '') +
            '" data-term="' +
            escapeHtml(e.name) +
            '" data-scope="' +
            rankScope +
            '">' +
            '<span class="rank-pos">' +
            (i + 1) +
            '</span>' +
            '<span class="rank-name">' +
            escapeHtml(e.name) +
            '</span>' +
            cells +
            '</div>'
          );
        })
        .join('')
    : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No data yet.</div>';

  const rankHTML =
    '<div class="dsec2"><h3>' +
    (rankByFamily ? 'Top waza family' : 'Top waza authors') +
    '</h3>' +
    rankToggles +
    rankHead +
    rankBody +
    '</div>';

  // ── Recently updated (past month) ───────────────────────────
  const historyRange = now - 30 * DAY;
  const recent = state.wazaData
    .filter((w) => {
      const p = state.prog[w.id];
      if (!p || !p.updated_at) return false;
      return new Date(p.updated_at).getTime() >= historyRange;
    })
    .sort((a, b) => new Date(state.prog[b.id].updated_at) - new Date(state.prog[a.id].updated_at))
    .slice(0, 30);

  const recentHTML =
    '<div class="dsec2"><h3>Recent activity (past month)</h3>' +
    (recent.length
      ? recent
          .map((w) => {
            const p = getP(w.id);
            const markings = p.markings || Array(6).fill(false);
            const _ms4 = markingStyle(markings);
            return (
              '<div class="waza-compact ' +
              _ms4.cls +
              '" data-id="' +
              w.id +
              '" style="' +
              _ms4.style +
              '">' +
              '<span class="drn">' +
              escapeHtml(w.name_jp || '—') +
              '</span>' +
              '<span class="drs">' +
              escapeHtml(dispName(w)) +
              '</span>' +
              '<div class="markings-row" style="flex-shrink:0">' +
              markingPips(markings) +
              '</div>' +
              '<span class="recent-time">' +
              timeAgo(p.updated_at) +
              '</span>' +
              '</div>'
            );
          })
          .join('')
      : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No activity in the past month.</div>') +
    '</div>';

  // ── Coverage by family (≥3 members, sorted by % completion) ─
  const families = {};
  state.wazaData.forEach((w) => {
    [w.parent_en0, w.parent_en1].filter(Boolean).forEach((fam) => {
      if (!families[fam]) families[fam] = { total: 0, touched: 0 };
      families[fam].total++;
      const p = getP(w.id);
      if (p.markings && p.markings.some(Boolean)) families[fam].touched++;
    });
  });

  // Exclude small families (≤2 members), then sort by % then size.
  const famEntries = Object.entries(families)
    .filter(([, { total }]) => total > 2)
    .sort((a, b) => {
      const pctA = a[1].total ? a[1].touched / a[1].total : 0;
      const pctB = b[1].total ? b[1].touched / b[1].total : 0;
      if (pctB !== pctA) return pctB - pctA;
      return b[1].total - a[1].total;
    });

  const covHTML =
    '<div class="dsec2"><h3>Top family completion (3+ members)</h3>' +
    (famEntries.length
      ? famEntries
          .map(([fam, { total, touched }]) => {
            const pct = total ? Math.round((touched / total) * 100) : 0;
            return (
              '<div class="cov-row' +
              (touched === 0 ? ' cov-row-zero' : '') +
              '">' +
              '<div class="cov-label"><span>' +
              escapeHtml(fam) +
              '</span>' +
              '<span style="color:var(--text3)">' +
              touched +
              ' / ' +
              total +
              '</span></div>' +
              '<div class="cov-track"><div class="cov-fill" style="width:' +
              pct +
              '%"></div></div>' +
              '</div>'
            );
          })
          .join('')
      : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No families with 3+ members yet.</div>') +
    '</div>';

  // ── Assemble ────────────────────────────────────────────────
  const container = document.getElementById('dashStats');
  container.innerHTML = overviewHTML + rankHTML + covHTML + recentHTML;

  // Search-and-exit from Stats: set a scoped exact search, jump to Browse.
  const searchAndExit = (term, scope) => {
    const query = scope ? `${scope.toUpperCase()}:"${term}"` : term;
    state.filters.search = query;
    document.getElementById('searchInput').value = query;
    navigateToBrowse();
  };

  container.querySelectorAll('.waza-compact').forEach((el) => {
    el.addEventListener('click', () => {
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });

  container.querySelectorAll('.rank-row[data-term]').forEach((el) => {
    el.addEventListener('click', () => searchAndExit(el.dataset.term, el.dataset.scope));
  });

  container.querySelector('#rankByAuthorBtn')?.addEventListener('click', () => {
    rankByFamily = false;
    renderDashStats();
  });
  container.querySelector('#rankByFamilyBtn')?.addEventListener('click', () => {
    rankByFamily = true;
    renderDashStats();
  });
  container.querySelector('#rankCompareBtn')?.addEventListener('click', () => {
    compareCommunity = !compareCommunity;
    renderDashStats();
  });
}
