/**
 * @file waza-detail.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-09
 * @brief Renders the detail panel for a selected waza, handles like/dislike, marking toggles, video embedding with oEmbed metadata, collapsible sections, navigation to similar waza, and history API integration.
 */

import {
  platform,
  embedUrl,
  oembedEndpoint,
  prefetchOembeds,
  embedCache,
  oembedCache,
} from '../components/render-helpers.js';
import { state } from '../state/state.js';
import { SHAPES, platLabel, platColor } from '../config/constants.js';
import { escapeHtml } from '../lib/escape.js';
import { dispName } from '../lib/search.js';
import { getP, saveP } from '../services/progress.js';
import { openSuggestEdit, openVideoSuggest } from '../modals/suggest-edit.js';
import { renderList } from './browse-list.js';
import { setSearchInput } from '../app/shell.js';

// Set while reconciling from a popstate event, so selectWaza/closeDetailPanel
// update the UI without writing NEW history entries (which would corrupt the
// back/forward stack).
let isPopping = false;

/**
 * @brief Selects a waza by ID and updates the UI.
 *
 * Stops playing embeds, updates selection highlight, renders detail panel,
 * pushes history state, and scrolls detail panel to top.
 *
 * @param {number} id - Waza ID to select.
 * @return {void}
 */
export function selectWaza(id) {
  // Stop any currently playing embeds before switching
  document.querySelectorAll('.embed-wrap.open iframe').forEach((f) => {
    f.src = '';
  });
  state.selectedId = id;

  // Move the selection highlight in place instead of rebuilding the whole list.
  // A full renderList() resets the browse list's scrollTop, and with
  // content-visibility the position can't be reliably preserved across it.
  const listEl = document.getElementById('wazaList');
  if (listEl) {
    listEl.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    if (id !== null) {
      const row = listEl.querySelector(`[data-id="${id}"]`);
      if (row) row.classList.add('selected');
    }
  }

  renderDetail();
  document.querySelector('.main').classList.toggle('waza-selected', id !== null);

  // Scroll detail panel to top when opening a new waza
  if (id !== null) {
    const detailPanel = document.getElementById('detailPanel');
    if (detailPanel) {
      detailPanel.scrollTop = 0;
    }
  }

  // Push history state so back button closes detail instead of exiting app
  if (id !== null && !isPopping) {
    const url = new URL(location.href);
    url.searchParams.set('waza', id);
    history.pushState({ wazaOpen: true, wazaId: id }, '', url);
  }
}

/**
 * @brief Initializes the mobile back button event listener.
 *
 * @return {void}
 */
export function initWazaDetail() {
  document.getElementById('mobileBack').addEventListener('click', () => {
    closeDetailPanel();
  });
}

// ── Render detail ─────────────────────────────────────────────
// Track collapsed state per section key
const collapsed = { names: true, classif: true, parents: true, creator: true, similar: true };

/**
 * @brief Renders the detail panel for the currently selected waza.
 *
 * Displays waza names, like/dislike pill, marking buttons, video references with oEmbed metadata,
 * collapsible info sections, similar waza chips, and suggest edit button for logged-in users.
 *
 * @return {void}
 */
export function renderDetail() {
  const panel = document.getElementById('detailContent');
  if (state.selectedId === null) {
    panel.innerHTML =
      '<div class="d-empty"><div style="font-size:32px">⛩</div><div>Select a Waza to view details</div></div>';
    return;
  }
  const w = state.wazaData.find((x) => x.id === state.selectedId);
  if (!w) return;
  const p = getP(w.id);
  const markings = p.markings || Array(6).fill(false);

  const vids = [
    w.video0,
    w.video1,
    w.video2,
    w.video3,
    w.video4,
    w.video5,
    w.video6,
    w.video7,
    w.video8,
    w.video9,
  ].filter((v) => v && v.trim() && v !== '0');

  // Resolve embed URLs — use cache if available, otherwise compute locally
  if (!embedCache.has(w.id)) {
    embedCache.set(
      w.id,
      vids.map((v) => ({ url: v, pl: platform(v), eurl: embedUrl(v) })),
    );
  }
  const resolvedVids = embedCache.get(w.id);

  const videoHTML = resolvedVids.length
    ? resolvedVids
        .map((v, i) => {
          const canEmbed = !!v.eurl;
          const hasMeta = oembedEndpoint(v.url) !== null;
          const cached = oembedCache.get(v.url);
          const isLoading = hasMeta && (!cached || cached === 'pending');
          const titleText =
            cached && cached !== 'pending' && cached !== 'failed' && cached.title
              ? cached.title
              : platLabel[v.pl] + ' ' + (i + 1);
          const authorText =
            cached && cached !== 'pending' && cached !== 'failed' && cached.author
              ? cached.author
              : '';
          return (
            '<div class="vlink-item" data-vi="' +
            i +
            '">' +
            '<div class="vlink-row">' +
            '<a href="' +
            v.url +
            '" target="_blank" rel="noopener">' +
            '<div class="vico" style="background:' +
            platColor[v.pl] +
            '">' +
            (i + 1) +
            '</div>' +
            '<div class="vlink-meta">' +
            '<span class="vlink-title' +
            (isLoading ? ' loading' : '') +
            '" data-url="' +
            escapeHtml(v.url) +
            '">' +
            escapeHtml(titleText) +
            '</span>' +
            (authorText
              ? '<span class="vlink-author">' + escapeHtml(authorText) + '</span>'
              : '<span class="vlink-author"></span>') +
            '</div>' +
            '</a>' +
            '<div class="vlink-actions">' +
            (canEmbed
              ? '<button class="play-btn" data-vi="' + i + '">▶ Open In-App Player</button>'
              : '') +
            '<a class="ext-link" href="' +
            v.url +
            '" target="_blank" rel="noopener" title="Open in new tab">↗</a>' +
            '</div>' +
            '</div>' +
            (canEmbed ? '<div class="embed-wrap" data-vi="' + i + '"></div>' : '') +
            '</div>'
          );
        })
        .join('')
    : '<div style="color:var(--text3);font-size:13px">No video references</div>';

  const siblings = state.wazaData.filter(
    (x) =>
      x.id !== w.id &&
      ((w.parent_en0 && (x.parent_en0 === w.parent_en0 || x.parent_en1 === w.parent_en0)) ||
        (w.parent_en1 && (x.parent_en0 === w.parent_en1 || x.parent_en1 === w.parent_en1))),
  );
  const sibHTML = siblings.length
    ? siblings
        .map(
          (s) =>
            '<span class="chip chip-2line" data-id="' +
            s.id +
            '">' +
            '<span class="chip-en">' +
            escapeHtml(dispName(s)) +
            '</span>' +
            '<span class="chip-jp">' +
            escapeHtml(s.name_jp || '') +
            '</span>' +
            '</span>',
        )
        .join('')
    : '<span style="color:var(--text3);font-size:13px">None found</span>';

  // Collapsible section helper (animated open/close, independent per section).
  const sec = (key, label, inner) => {
    const isCollapsed = collapsed[key];
    return (
      '<div class="dsec">' +
      '<div class="dsec-toggle' +
      (isCollapsed ? ' collapsed' : '') +
      '" data-key="' +
      key +
      '">' +
      '<h3>' +
      label +
      '</h3><span class="toggle-arrow">▾</span></div>' +
      '<div class="acc-body' +
      (isCollapsed ? '' : ' open') +
      '"><div class="acc-body-inner"><div class="acc-body-box">' +
      inner +
      '</div></div></div></div>'
    );
  };

  const isSaving = state.savingIds.has(w.id);
  const savingAttr = isSaving ? ' disabled style="opacity:.5;cursor:default"' : '';

  panel.innerHTML =
    '<div class="d-njp">' +
    (w.name_jp || '—') +
    '</div>' +
    '<div class="d-nen">' +
    dispName(w) +
    '</div>' +
    // Like/Dislike pill
    '<div class="dsec">' +
    (isSaving
      ? ' <span style="font-size:10px;color:var(--text3);font-weight:400">syncing…</span>'
      : '') +
    (!state.token || state.isGuest
      ? '<div style="font-size:12px;color:var(--text3);margin-bottom:6px">Sign in to like or dislike</div>'
      : '') +
    '<div class="like-pill-wrap">' +
    '<div class="like-pill">' +
    '<button class="like-pill-half' +
    (p.like === 1 ? ' like-on' : '') +
    '"' +
    (!state.token || state.isGuest || isSaving ? ' disabled' : '') +
    ' id="likeBtn">' +
    '👍 <span class="pill-count">' +
    (w.like_count || 0) +
    '</span></button>' +
    '<button class="like-pill-half' +
    (p.like === -1 ? ' dislike-on' : '') +
    '"' +
    (!state.token || state.isGuest || isSaving ? ' disabled' : '') +
    ' id="dislikeBtn">' +
    '👎 <span class="pill-count">' +
    (w.dislike_count || 0) +
    '</span></button>' +
    '</div>' +
    (() => {
      const lc = w.like_count || 0,
        dc = w.dislike_count || 0,
        tot = lc + dc;
      const pct = tot ? Math.round((lc / tot) * 100) : 0;
      return (
        '<div class="like-ratio-bar"><div class="like-ratio-fill" style="width:' +
        pct +
        '%"></div></div>'
      );
    })() +
    '</div></div>' +
    // Markings — not collapsible
    '<div class="dsec"><h3>Markings</h3>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    SHAPES.map(
      (s, i) =>
        '<button class="marking-btn' +
        (markings[i] ? ' on' : '') +
        '"' +
        savingAttr +
        ' data-si="' +
        i +
        '" title="' +
        (state.markingLabels[i] || 'Marking ' + (i + 1)) +
        '">' +
        s +
        '</button>',
    ).join('') +
    '</div>' +
    '</div>' +
    // Videos — not collapsible
    '<div class="dsec"><h3>Video references</h3><div class="vlinks">' +
    videoHTML +
    '</div>' +
    (!state.isGuest && state.token
      ? '<div class="suggest-video-bar" id="suggestVideoBar">🎥 Suggest a video!</div>'
      : '') +
    '</div>' +
    // Collapsible sections
    sec(
      'names',
      'Names',
      '<div class="dgrid">' +
        '<div class="dfield"><div class="lbl">Japanese</div><div class="val">' +
        (w.name_jp || '—') +
        '</div></div>' +
        '<div class="dfield"><div class="lbl">English</div><div class="val">' +
        (w.name_en || '—') +
        '</div></div>' +
        '<div class="dfield"><div class="lbl">Romaji</div><div class="val">' +
        (w.name_en_literal || '—') +
        '</div></div>' +
        '<div class="dfield"><div class="lbl">Google Translate EN</div><div class="val">' +
        (w.name_en_gtranslate || '—') +
        '</div></div>' +
        '<div class="dfield"><div class="lbl">Google Translate CN</div><div class="val">' +
        (w.name_cn_gtranslate || '—') +
        '</div></div>' +
        '</div>',
    ) +
    (w.tag || w.reference
      ? sec(
          'classif',
          'Classification',
          (w.tag
            ? '<div style="margin-bottom:10px"><span class="chip tag-pill">' +
              escapeHtml(w.tag) +
              '</span></div>'
            : '') +
            (w.reference
              ? '<div class="dgrid"><div class="dfield" style="grid-column:1/-1"><div class="lbl">Reference / lore</div><div class="val">' +
                w.reference +
                '</div></div></div>'
              : ''),
        )
      : '') +
    (w.parent_jp0 || w.parent_en0 || w.parent_jp1 || w.parent_en1
      ? sec(
          'parents',
          'Parent Waza',
          (w.parent_jp0 || w.parent_en0
            ? '<span class="chip chip-2line" data-parent="' +
              escapeHtml(w.parent_en0 || w.parent_jp0 || '') +
              '">' +
              '<span class="chip-en">' +
              escapeHtml(w.parent_en0 || '') +
              '</span>' +
              '<span class="chip-jp">' +
              escapeHtml(w.parent_jp0 || '') +
              '</span>' +
              '</span>'
            : '') +
            (w.parent_jp1 || w.parent_en1
              ? '<span class="chip chip-2line" data-parent="' +
                escapeHtml(w.parent_en1 || w.parent_jp1 || '') +
                '">' +
                '<span class="chip-en">' +
                escapeHtml(w.parent_en1 || '') +
                '</span>' +
                '<span class="chip-jp">' +
                escapeHtml(w.parent_jp1 || '') +
                '</span>' +
                '</span>'
              : ''),
        )
      : '') +
    (w.author_jp0 || w.author_en0 || w.author_jp1 || w.author_en1
      ? sec(
          'creator',
          'Creator',
          '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
            (w.author_jp0 || w.author_en0
              ? '<div class="author-2line author-click" data-author="' +
                escapeHtml(w.author_en0 || w.author_jp0 || '') +
                '">' +
                '<div class="author-en">' +
                escapeHtml(w.author_en0 || '—') +
                '</div>' +
                '<div class="author-jp">' +
                escapeHtml(w.author_jp0 || '') +
                '</div>' +
                '</div>'
              : '') +
            (w.author_jp1 || w.author_en1
              ? '<div class="author-2line author-click" data-author="' +
                escapeHtml(w.author_en1 || w.author_jp1 || '') +
                '">' +
                '<div class="author-en">' +
                escapeHtml(w.author_en1 || '—') +
                '</div>' +
                '<div class="author-jp">' +
                escapeHtml(w.author_jp1 || '') +
                '</div>' +
                '</div>'
              : '') +
            '</div>',
        )
      : '') +
    (siblings.length
      ? sec(
          'similar',
          'Similar Waza',
          '<div style="display:flex;flex-wrap:wrap;gap:4px">' + sibHTML + '</div>',
        )
      : '') +
    (!state.isGuest && state.token
      ? '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)"><button class="suggest-btn" id="suggestEditBtn">✏️ Suggest an edit</button></div>'
      : '');

  panel
    .querySelector('#likeBtn')
    ?.addEventListener('click', () => saveP(w.id, { like: p.like === 1 ? null : 1 }));
  panel
    .querySelector('#dislikeBtn')
    ?.addEventListener('click', () => saveP(w.id, { like: p.like === -1 ? null : -1 }));
  panel.querySelectorAll('.marking-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      const ns = [...markings];
      ns[+btn.dataset.si] = !ns[+btn.dataset.si];
      saveP(w.id, { markings: ns });
    }),
  );

  // ── Play button toggle — lazy-load iframe on first expand ──
  panel.querySelectorAll('.play-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vi = +btn.dataset.vi;
      const wrap = panel.querySelector(`.embed-wrap[data-vi="${vi}"]`);
      const isOpen = wrap.classList.toggle('open');
      btn.classList.toggle('active', isOpen);
      btn.textContent = isOpen ? '■ Close In-App Player' : '▶ Open In-App Player';
      if (isOpen) {
        // Lazy-create iframe on first open; restore src on subsequent opens
        let iframe = wrap.querySelector('iframe');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.allow =
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
          iframe.allowFullscreen = true;
          wrap.appendChild(iframe);
        }
        // Always (re)set src when opening — covers both first open and re-open after close
        iframe.src = resolvedVids[vi].eurl;
      } else {
        // Clear src to stop playback when closing
        const iframe = wrap.querySelector('iframe');
        if (iframe) iframe.src = '';
      }
    });
  });
  // Kick off oEmbed prefetch for all videos (progressive — updates DOM as results arrive)
  prefetchOembeds(resolvedVids);
  // Collapsible toggles (animated; each section independent)
  panel.querySelectorAll('.dsec-toggle').forEach((el) =>
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      collapsed[key] = !collapsed[key];
      el.classList.toggle('collapsed', collapsed[key]);
      el.nextElementSibling.classList.toggle('open', !collapsed[key]);
    }),
  );
  // Search-and-exit: set the search term, then drop back to the list panel.
  const searchAndExit = (term, scope = null) => {
    const query = scope ? `${scope.toUpperCase()}:"${term}"` : term;
    setSearchInput(query);
    state.selectedId = null;
    document.querySelector('.main').classList.remove('waza-selected');
    const url = new URL(location.href);
    url.searchParams.delete('waza');
    history.replaceState(null, '', url);
    renderList();
    renderDetail();
  };
  panel
    .querySelectorAll('.chip[data-parent]')
    .forEach((chip) =>
      chip.addEventListener('click', () => searchAndExit(chip.dataset.parent, 'PARENT')),
    );
  panel
    .querySelectorAll('.author-click[data-author]')
    .forEach((el) =>
      el.addEventListener('click', () => searchAndExit(el.dataset.author, 'AUTHOR')),
    );
  panel
    .querySelectorAll('.chip[data-id]')
    .forEach((chip) => chip.addEventListener('click', () => selectWaza(+chip.dataset.id)));
  panel.querySelector('#suggestEditBtn')?.addEventListener('click', () => openSuggestEdit(w));
  panel.querySelector('#suggestVideoBar')?.addEventListener('click', () => openVideoSuggest(w));
}

// ── History popstate handler to support back button closing detail view ──

/**
 * @brief Closes the detail panel and clears the selected waza.
 *
 * Stops playing embeds, removes selection highlight, renders empty detail,
 * and updates URL to remove ?waza parameter.
 *
 * @return {void}
 */
export function closeDetailPanel() {
  document.querySelectorAll('.embed-wrap.open iframe').forEach((f) => {
    f.src = '';
  });
  state.selectedId = null;

  // Drop the highlight in place; no full re-render (preserves scroll).
  const listEl = document.getElementById('wazaList');
  if (listEl) {
    listEl.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
  }

  renderDetail();
  document.querySelector('.main').classList.remove('waza-selected');

  if (!isPopping) {
    const url = new URL(location.href);
    url.searchParams.delete('waza');
    history.replaceState(null, '', url);
  }
}

// Called by the popstate handler — drive selection/close WITHOUT writing history.

/**
 * @brief Selects a waza from history navigation without pushing a new history entry.
 *
 * @param {number} id - Waza ID to select.
 * @return {void}
 */
export function selectWazaFromHistory(id) {
  isPopping = true;
  try {
    selectWaza(id);
  } finally {
    isPopping = false;
  }
}

/**
 * @brief Closes the detail panel from history navigation without pushing a new history entry.
 *
 * @return {void}
 */
export function closeDetailPanelFromHistory() {
  isPopping = true;
  try {
    closeDetailPanel();
  } finally {
    isPopping = false;
  }
}
