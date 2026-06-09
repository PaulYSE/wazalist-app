/**
 * @file stats.js
 * @author Paul Yong Shao En
 * @brief Stats dashboard: always-open Your Progress, plus collapsible
 *        Top Waza / Top Family / Recent Activity sections with their controls.
 */

import { state } from '../state/state.js';
import { getP } from '../services/progress.js';
import { dispName } from '../lib/search.js';
import { markingStyle, markingPips } from '../components/render-helpers.js';
import { selectWaza } from './waza-detail.js';
import { navigateToBrowse } from '../app/shell.js';
import { escapeHtml } from '../lib/escape.js';

// ── Persisted UI state (module scope: survives the re-render each toggle fires) ──
let rankByFamily = false; // false = author, true = family
let compareCommunity = false; // side-by-side community likes
let showWaza = false; // expand each ranking row into its marked-waza list
let famSort = 'completion'; // 'completion' | 'total'
let famShowZero = false; // show families with 0 marked
let recentLimit = 10; // 10 | 15 | 20
// Independent open/closed state for the three collapsible sections.
const accOpen = { rank: true, family: false, recent: false };

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

// Animated collapsible section (grid 0fr→1fr), independent open/close.
function accSection(key, label, controlsHTML, bodyHTML) {
  const open = accOpen[key];
  return (
    '<div class="dsec2">' +
    '<div class="dsec-toggle stat-acc-toggle' +
    (open ? '' : ' collapsed') +
    '" data-acc="' +
    key +
    '"><h3 style="margin-bottom:0;border-bottom:none;padding-bottom:0">' +
    label +
    '</h3><span class="toggle-arrow">▾</span></div>' +
    '<div class="acc-body' +
    (open ? ' open' : '') +
    '"><div class="acc-body-inner">' +
    controlsHTML +
    bodyHTML +
    '</div></div></div>'
  );
}

export function renderDashStats() {
  // ── Overview (always open, outside the accordion) ───────────
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

  const AUTHOR_FIELDS = [
    ['author_en0', 'author_jp0'],
    ['author_en1', 'author_jp1'],
  ];
  const PARENT_FIELDS = [
    ['parent_en0', 'parent_jp0'],
    ['parent_en1', 'parent_jp1'],
  ];

  // Aggregate per entity, also tracking the marked waza ids (for "show waza").
  function topBy(fieldPairs, metric, limit = 5) {
    const acc = {}; // key → { name, marks, likes, wazaIds: [] }
    state.wazaData.forEach((w) => {
      const p = getP(w.id);
      const isMarked = p.markings && p.markings.some(Boolean);
      const likeCount = w.like_count || 0;
      const names = new Set();
      fieldPairs.forEach(([en, jp]) => {
        const name = (w[en] || w[jp] || '').trim();
        if (name) names.add(name);
      });
      names.forEach((name) => {
        if (!acc[name]) acc[name] = { name, marks: 0, likes: 0, wazaIds: [] };
        acc[name].likes += likeCount;
        if (isMarked) {
          acc[name].marks++;
          acc[name].wazaIds.push(w.id);
        }
      });
    });
    return Object.values(acc)
      .filter((e) => e[metric] > 0)
      .sort((a, b) => b[metric] - a[metric] || b.marks - a.marks)
      .slice(0, limit);
  }

  // ── Top Waza (authors | family) ─────────────────────────────
  const rankFields = rankByFamily ? PARENT_FIELDS : AUTHOR_FIELDS;
  const rankScope = rankByFamily ? 'parent' : 'author';
  const rankRows = topBy(rankFields, 'marks');

  const rankControls =
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
    '<button class="rank-toggle' +
    (showWaza ? ' on' : '') +
    '" id="rankShowWazaBtn">' +
    (showWaza ? '✓ ' : '') +
    'Show waza</button>' +
    '</div>';

  const rankHead = compareCommunity
    ? '<div class="rank-head rank-head-compare"><span>#</span><span></span>' +
      '<span title="Your marks">You</span><span title="Community likes">Likes</span></div>'
    : '<div class="rank-head"><span>#</span><span></span><span title="Your marks">You</span></div>';

  // Build the expandable marked-waza sublist for one entity (only when showWaza).
  const wazaSublist = (ids) =>
    '<div class="rank-sublist">' +
    ids
      .map((id) => state.wazaData.find((w) => w.id === id))
      .filter(Boolean)
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const ms = markingStyle(markings);
        return (
          '<div class="waza-compact ' +
          ms.cls +
          '" data-id="' +
          w.id +
          '" style="' +
          ms.style +
          '">' +
          '<span class="drn">' +
          escapeHtml(w.name_jp || '—') +
          '</span>' +
          '<span class="drs">' +
          escapeHtml(dispName(w)) +
          '</span>' +
          '<div class="markings-row" style="flex-shrink:0">' +
          markingPips(markings) +
          '</div></div>'
        );
      })
      .join('') +
    '</div>';

  const rankBody = rankRows.length
    ? rankRows
        .map((e, i) => {
          const cells = compareCommunity
            ? '<span class="rank-mine">' +
              e.marks +
              '</span><span class="rank-comm">' +
              e.likes +
              '</span>'
            : '<span class="rank-mine">' + e.marks + '</span>';
          const row =
            '<div class="rank-row' +
            (compareCommunity ? ' rank-row-compare' : '') +
            '" data-term="' +
            escapeHtml(e.name) +
            '" data-scope="' +
            rankScope +
            '"><span class="rank-pos">' +
            (i + 1) +
            '</span><span class="rank-name">' +
            escapeHtml(e.name) +
            '</span>' +
            cells +
            '</div>';
          return showWaza ? row + wazaSublist(e.wazaIds) : row;
        })
        .join('')
    : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No data yet.</div>';

  const rankSection = accSection(
    'rank',
    rankByFamily ? 'Top waza family' : 'Top waza authors',
    rankControls,
    rankHead + rankBody,
  );

  // ── Top Family completion ───────────────────────────────────
  const families = {};
  state.wazaData.forEach((w) => {
    [w.parent_en0, w.parent_en1].filter(Boolean).forEach((fam) => {
      if (!families[fam]) families[fam] = { total: 0, touched: 0 };
      families[fam].total++;
      const p = getP(w.id);
      if (p.markings && p.markings.some(Boolean)) families[fam].touched++;
    });
  });

  let famEntries = Object.entries(families).filter(([, { total }]) => total > 2);
  if (!famShowZero) famEntries = famEntries.filter(([, { touched }]) => touched > 0);
  famEntries.sort((a, b) => {
    if (famSort === 'total') return b[1].total - a[1].total;
    const pctA = a[1].total ? a[1].touched / a[1].total : 0;
    const pctB = b[1].total ? b[1].touched / b[1].total : 0;
    return pctB - pctA || b[1].total - a[1].total;
  });

  const famControls =
    '<div class="rank-toggles">' +
    '<button class="rank-toggle' +
    (famSort === 'completion' ? ' on' : '') +
    '" id="famSortCompletionBtn">Sort by completion</button>' +
    '<button class="rank-toggle' +
    (famSort === 'total' ? ' on' : '') +
    '" id="famSortTotalBtn">Sort by family total</button>' +
    '<button class="rank-toggle rank-toggle-compare' +
    (famShowZero ? ' on' : '') +
    '" id="famShowZeroBtn">' +
    (famShowZero ? '✓ ' : '') +
    'Show empty families</button>' +
    '</div>';

  const covBody = famEntries.length
    ? famEntries
        .map(([fam, { total, touched }]) => {
          const pct = total ? Math.round((touched / total) * 100) : 0;
          return (
            '<div class="cov-row' +
            (touched === 0 ? ' cov-row-zero' : '') +
            '"><div class="cov-label"><span>' +
            escapeHtml(fam) +
            '</span><span style="color:var(--text3)">' +
            touched +
            ' / ' +
            total +
            '</span></div><div class="cov-track"><div class="cov-fill" style="width:' +
            pct +
            '%"></div></div></div>'
          );
        })
        .join('')
    : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No families to show.</div>';

  const famSection = accSection('family', 'Top family completion (3+ members)', famControls, covBody);

  // ── Recent Activity (selectable count) ──────────────────────
  const recent = state.wazaData
    .filter((w) => {
      const p = state.prog[w.id];
      return p && p.updated_at;
    })
    .sort((a, b) => new Date(state.prog[b.id].updated_at) - new Date(state.prog[a.id].updated_at))
    .slice(0, recentLimit);

  const recentControls =
    '<div class="rank-toggles">' +
    [10, 15, 20]
      .map(
        (n) =>
          '<button class="rank-toggle' +
          (recentLimit === n ? ' on' : '') +
          '" data-recent="' +
          n +
          '">' +
          n +
          '</button>',
      )
      .join('') +
    '</div>';

  // The "that's all" sentinel row, styled as a waza-compact, when under the limit.
  const sentinelRow =
    '<div class="waza-compact" style="cursor:default;opacity:0.7">' +
    '<span class="drn">That\'s all!</span>' +
    '<span class="drs">Add more Wazas to your list!</span></div>';

  const recentBody =
    (recent.length
      ? recent
          .map((w) => {
            const p = getP(w.id);
            const markings = p.markings || Array(6).fill(false);
            const ms = markingStyle(markings);
            return (
              '<div class="waza-compact ' +
              ms.cls +
              '" data-id="' +
              w.id +
              '" style="' +
              ms.style +
              '"><span class="drn">' +
              escapeHtml(w.name_jp || '—') +
              '</span><span class="drs">' +
              escapeHtml(dispName(w)) +
              '</span><div class="markings-row" style="flex-shrink:0">' +
              markingPips(markings) +
              '</div><span class="recent-time">' +
              timeAgo(p.updated_at) +
              '</span></div>'
            );
          })
          .join('')
      : '') + (recent.length < recentLimit ? sentinelRow : '');

  const recentSection = accSection('recent', 'Recent activity', recentControls, recentBody);

  // ── Assemble ────────────────────────────────────────────────
  const container = document.getElementById('dashStats');
  container.innerHTML = overviewHTML + rankSection + famSection + recentSection;

  // ── Wiring ──────────────────────────────────────────────────
  const searchAndExit = (term, scope) => {
    const query = scope ? `${scope.toUpperCase()}:"${term}"` : term;
    state.filters.search = query;
    document.getElementById('searchInput').value = query;
    navigateToBrowse();
  };

  // Accordion toggles (independent open/close).
  container.querySelectorAll('.stat-acc-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.acc;
      accOpen[key] = !accOpen[key];
      el.classList.toggle('collapsed', !accOpen[key]);
      el.nextElementSibling.classList.toggle('open', accOpen[key]);
    });
  });

  // Waza rows (sublists + recent) open the detail panel.
  container.querySelectorAll('.waza-compact[data-id]').forEach((el) => {
    el.addEventListener('click', () => {
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });

  // Ranking rows jump to a scoped search — but only the row itself, not its
  // sublist (the sublist rows have their own data-id click above).
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
  container.querySelector('#rankShowWazaBtn')?.addEventListener('click', () => {
    showWaza = !showWaza;
    renderDashStats();
  });
  container.querySelector('#famSortCompletionBtn')?.addEventListener('click', () => {
    famSort = 'completion';
    renderDashStats();
  });
  container.querySelector('#famSortTotalBtn')?.addEventListener('click', () => {
    famSort = 'total';
    renderDashStats();
  });
  container.querySelector('#famShowZeroBtn')?.addEventListener('click', () => {
    famShowZero = !famShowZero;
    renderDashStats();
  });
  container.querySelectorAll('[data-recent]').forEach((btn) => {
    btn.addEventListener('click', () => {
      recentLimit = +btn.dataset.recent;
      renderDashStats();
    });
  });
}