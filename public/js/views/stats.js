/**
 * @file stats.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-09
 * @brief Stats dashboard: always-open Your Progress, plus collapsible Waza Trends / Top Waza Family / Recent Activity sections.
 */

import { state } from '../state/state.js';
import { getP } from '../services/progress.js';
import { dispName } from '../lib/search.js';
import { markingStyle, markingPips } from '../components/render-helpers.js';
import { selectWaza } from './waza-detail.js';
import { navigateToBrowse, setSearchInput } from '../app/shell.js';
import { escapeHtml } from '../lib/escape.js';

// ── Persisted UI state (module scope: survives the re-render each toggle fires) ──
let rankByFamily = false; // false = author, true = family
let showWaza = false; // expand each ranking row into its marked-waza list
let famSort = 'completion'; // 'completed' | 'total' | 'completion'
let famShowZero = false; // show families with 0 marked
let recentLimit = 10; // 10 | 15 | 20

// Independent open/closed state for the three collapsible sections.
const accOpen = { rank: false, family: false, recent: false };

/**
 * @brief Formats an ISO timestamp into a relative time string.
 *
 * @param {string} iso - ISO timestamp string.
 * @return {string} Human-readable relative time (e.g., "2h ago").
 */
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

// Sort key for ordering marked waza by their left-most active marking, then the
// next, etc. Two waza with the same first mark fall back to the second, and so
// on — so the list reads left-to-right by marking column.
function markingOrder(markings) {
  // Index of each active marking, ascending; unmarked sorts last.
  const active = (markings || []).map((on, i) => (on ? i : 99)).filter((i) => i < 99);
  return active.length ? active : [99];
}

// Compare two marking-order arrays lexicographically.
function compareMarkingOrder(a, b) {
  const oa = markingOrder(a),
    ob = markingOrder(b);
  const len = Math.max(oa.length, ob.length);
  for (let i = 0; i < len; i++) {
    const va = oa[i] ?? 99,
      vb = ob[i] ?? 99;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// Animated collapsible section (grid 0fr→1fr), mutually-exclusive open/close.

/**
 * @brief Generates an animated collapsible section with header and body.
 *
 * @param {string} key - Section identifier for state tracking.
 * @param {string} label - Section title.
 * @param {string} controlsHTML - HTML for control buttons inside the header area.
 * @param {string} bodyHTML - HTML for the collapsible body content.
 * @return {string} Accordion section HTML.
 */
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
    '"><div class="acc-body-inner"><div class="acc-body-box">' +
    controlsHTML +
    bodyHTML +
    '</div></div></div></div>'
  );
}

/**
 * @brief Renders the full stats dashboard with overview, Waza Trends, family completion, and recent activity.
 *
 * @return {void}
 */
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

  const AUTHOR_FIELDS = [
    ['author_en0', 'author_jp0'],
    ['author_en1', 'author_jp1'],
  ];
  const PARENT_FIELDS = [
    ['parent_en0', 'parent_jp0'],
    ['parent_en1', 'parent_jp1'],
  ];

  /**
   * @brief Aggregates top entities (authors/families) by personal marks.
   *
   * @param {Array<Array<string>>} fieldPairs - Array of [enField, jpField] pairs.
   * @param {string} metric - Metric to sort by ('marks').
   * @param {number} limit - Maximum number of results.
   * @return {Array<Object>} Sorted array of entity objects with name, marks, wazaIds.
   */
  function topBy(fieldPairs, metric, limit = 10) {
    const acc = {}; // key → { name, marks, wazaIds: [] }
    state.wazaData.forEach((w) => {
      const p = getP(w.id);
      const isMarked = p.markings && p.markings.some(Boolean);
      const names = new Set();
      fieldPairs.forEach(([en, jp]) => {
        const name = (w[en] || w[jp] || '').trim();
        if (name) names.add(name);
      });
      names.forEach((name) => {
        if (!acc[name]) acc[name] = { name, marks: 0, wazaIds: [] };
        if (isMarked) {
          acc[name].marks++;
          acc[name].wazaIds.push(w.id);
        }
      });
    });
    return Object.values(acc)
      .filter((e) => e[metric] > 0)
      .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  // ── Waza Trends (Author | Family) ───────────────────────────
  const rankFields = rankByFamily ? PARENT_FIELDS : AUTHOR_FIELDS;
  const rankScope = rankByFamily ? 'parent' : 'author';
  const rankRows = topBy(rankFields, 'marks', 10);

  const rankControls =
    '<div class="rank-toggles">' +
    // Author/Family — single pill, mutually exclusive.
    '<div class="seg-pill">' +
    '<button class="seg-item' +
    (rankByFamily ? '' : ' on') +
    '" id="rankByAuthorBtn">Author</button>' +
    '<button class="seg-item' +
    (rankByFamily ? ' on' : '') +
    '" id="rankByFamilyBtn">Family</button>' +
    '</div>' +
    '<button class="rank-toggle' +
    (showWaza ? ' on' : '') +
    '" id="rankShowWazaBtn">' +
    (showWaza ? '✓ ' : '') +
    'Show Waza</button>' +
    '</div>';

  const rankHead =
    '<div class="rank-head"><span>#</span><span></span><span title="Your marks">You</span></div>';

  // Marked-waza sublist for one entity, sorted by marking order (left→right).
  const wazaSublist = (ids) =>
    '<div class="rank-sublist">' +
    ids
      .map((id) => state.wazaData.find((w) => w.id === id))
      .filter(Boolean)
      .sort((a, b) => compareMarkingOrder(getP(a.id).markings, getP(b.id).markings))
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
          const row =
            '<div class="rank-row" data-term="' +
            escapeHtml(e.name) +
            '" data-scope="' +
            rankScope +
            '"><span class="rank-pos">' +
            (i + 1) +
            '</span><span class="rank-name">' +
            escapeHtml(e.name) +
            '</span><span class="rank-mine">' +
            e.marks +
            '</span></div>';
          return showWaza ? row + wazaSublist(e.wazaIds) : row;
        })
        .join('')
    : '<div style="color:var(--text3);font-size:13px;padding:8px 0">No data yet.</div>';

  const rankSection = accSection('rank', 'Waza Trends', rankControls, rankHead + rankBody);

  // ── Top Waza Family ─────────────────────────────────────────
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
    if (famSort === 'total') return b[1].total - a[1].total || b[1].touched - a[1].touched;
    if (famSort === 'completed') return b[1].touched - a[1].touched || b[1].total - a[1].total;
    // 'completion' — by completion rate, then by total as tiebreak.
    const pctA = a[1].total ? a[1].touched / a[1].total : 0;
    const pctB = b[1].total ? b[1].touched / b[1].total : 0;
    return pctB - pctA || b[1].total - a[1].total;
  });

  const famControls =
    '<div class="rank-toggles">' +
    '<div class="seg-pill">' +
    '<span class="seg-label">Sort by</span>' +
    '<button class="seg-item' +
    (famSort === 'completed' ? ' on' : '') +
    '" data-famsort="completed">Completed</button>' +
    '<button class="seg-item' +
    (famSort === 'total' ? ' on' : '') +
    '" data-famsort="total">Total</button>' +
    '<button class="seg-item' +
    (famSort === 'completion' ? ' on' : '') +
    '" data-famsort="completion">Completion Rate</button>' +
    '</div>' +
    '<button class="rank-toggle' +
    (famShowZero ? ' on' : '') +
    '" id="famShowZeroBtn">' +
    (famShowZero ? '✓ ' : '') +
    'Show Empty</button>' +
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

  const famSection = accSection('family', 'Top waza family', famControls, covBody);

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
    setSearchInput(query);
    navigateToBrowse();
  };

  // Accordion toggles (mutually exclusive).
  container.querySelectorAll('.stat-acc-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.acc;
      const wasOpen = accOpen[key];
      Object.keys(accOpen).forEach((k) => {
        accOpen[k] = false;
      });
      if (!wasOpen) accOpen[key] = true;
      container.querySelectorAll('.stat-acc-toggle').forEach((t) => {
        const open = accOpen[t.dataset.acc];
        t.classList.toggle('collapsed', !open);
        t.nextElementSibling.classList.toggle('open', open);
      });
    });
  });

  // Waza rows (sublists + recent) open the detail panel.
  container.querySelectorAll('.waza-compact[data-id]').forEach((el) => {
    el.addEventListener('click', () => {
      navigateToBrowse();
      selectWaza(+el.dataset.id);
    });
  });

  // Ranking rows jump to a scoped search.
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
  container.querySelector('#rankShowWazaBtn')?.addEventListener('click', () => {
    showWaza = !showWaza;
    renderDashStats();
  });
  container.querySelectorAll('[data-famsort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      famSort = btn.dataset.famsort;
      renderDashStats();
    });
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
