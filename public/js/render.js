/* render.js — the two main views: renderList() (browse) and
   renderDetail()/selectWaza() (the single-waza panel). */
import {
  markingStyle,       // used in renderList() for all 3 view modes
  markingPips,        // used in renderList() and renderDetail()
  cardLikePill,       // used in renderList()
  videoButtons,       // used in renderList() expanded view
  platform,           // used in renderDetail()
  embedUrl,           // used in renderDetail()
  oembedEndpoint,     // used in renderDetail()
  prefetchOembeds,    // used in renderDetail()
  embedCache,         // used in renderDetail() — needs export added
  oembedCache,        // used in renderDetail() — needs export added
} from './render-helpers.js'
import { state } from './state/state.js';
import { SHAPES, platLabel, platColor } from './config/constants.js';
import { filterWaza } from './features/search.js';
import { escapeHtml } from './ui.js';
import { getP, saveP } from './core.js';
import { dispName } from './features/search.js';
import { openSuggestEdit } from './contribute-modals.js';

export function renderList() {
  const filtered = filterWaza();
  document.getElementById('countBar').textContent = filtered.length + ' of ' + state.wazaData.length + ' Waza';
  const list = document.getElementById('wazaList');
  if (!filtered.length) { list.innerHTML = '<div style="padding:20px;text-align:center;color:#6a6880;font-size:14px">No Waza found</div>'; return; }

  if (state.browseListView === 'expanded') {
    list.innerHTML = filtered.map(w => {
      const p = getP(w.id);
      const markings = p.markings || Array(6).fill(false);
      const pill = cardLikePill(w, p);
      const bottomRow = '<div class="card-bottom-row">'
        + '<div class="markings-row wce-markings">' + markingPips(markings) + '</div>'
        + pill + '</div>';
      const _ms1 = markingStyle(markings); return '<div class="waza-card ' + _ms1.cls + (state.selectedId === w.id ? ' selected' : '') + '" data-id="' + w.id + '" style="' + _ms1.style + '">'
        + '<div class="wce-header">'
        + '<div class="njp">' + (w.name_jp || '—') + '</div>'
        + '<div class="nen">' + dispName(w) + '</div>'
        + bottomRow + '</div>'
        + videoButtons(w)
        + '</div>';
    }).join('');
    list.querySelectorAll('.waza-card').forEach(el => el.addEventListener('click', () => selectWaza(+el.dataset.id)));

  } else if (state.browseListView === 'list') {
    list.innerHTML = filtered.map(w => {
      const p = getP(w.id);
      const markings = p.markings || Array(6).fill(false);
      const pill = cardLikePill(w, p);
      const bottomRow = '<div class="card-bottom-row">'
        + '<div class="markings-row wce-markings">' + markingPips(markings) + '</div>'
        + pill + '</div>';
      const _ms2 = markingStyle(markings); return '<div class="waza-list ' + _ms2.cls + (state.selectedId === w.id ? ' selected' : '') + '" data-id="' + w.id + '" style="' + _ms2.style + '">'
        + '<div class="njp">' + (w.name_jp || '—') + '</div>'
        + '<div class="nen">' + dispName(w) + '</div>'
        + bottomRow + '</div>';
    }).join('');
    list.querySelectorAll('.waza-list').forEach(el => el.addEventListener('click', () => selectWaza(+el.dataset.id)));

  } else {
    // Compact — no likes, equal truncating names
    list.innerHTML = filtered.map(w => {
      const p = getP(w.id);
      const markings = p.markings || Array(6).fill(false);
      const _ms3 = markingStyle(markings); return '<div class="waza-compact ' + _ms3.cls + (state.selectedId === w.id ? ' selected' : '') + '" data-id="' + w.id + '" style="' + _ms3.style + '">'
        + '<span class="drn">' + (w.name_jp || '—') + '</span>'
        + '<span class="drs">' + dispName(w) + '</span>'
        + '<div class="markings-row" style="flex-shrink:0">' + markingPips(markings) + '</div>'
        + '</div>';
    }).join('');
    list.querySelectorAll('.waza-compact').forEach(el => el.addEventListener('click', () => selectWaza(+el.dataset.id)));
  }
}

export function selectWaza(id) {
  // Stop any currently playing embeds before switching
  document.querySelectorAll('.embed-wrap.open iframe').forEach(f => { f.src = ''; });
  state.selectedId = id;
  renderList(); renderDetail();
  document.querySelector('.main').classList.toggle('waza-selected', id !== null);

  // Scroll detail panel to top when opening a new waza
  if (id !== null) {
    const detailPanel = document.getElementById('detailPanel');
    if (detailPanel) {
      detailPanel.scrollTop = 0;
    }
  }

  // Push history state so back button closes detail instead of exiting app
  if (id !== null) {
    const url = new URL(location.href);
    url.searchParams.set('waza', id); // Use ID directly as slug
    history.pushState({ wazaOpen: true, wazaId: id }, '', url);
  }
}
export function initRender() {
  document.getElementById('mobileBack').addEventListener('click', () => {
    closeDetailPanel();
  });

  // ── Browse view toggle group ──────────────────────────────────
  document.getElementById('browseViewSelect').addEventListener('change', e => {
    state.browseListView = e.target.value;
    // Save to localStorage
    localStorage.setItem('wl_view_style', state.browseListView);
    renderList();
  });

  // ── Mobile view style dropdown ─────────────────────────────────
  document.getElementById('viewStyleSelectMobile')?.addEventListener('change', e => {
    state.browseListView = e.target.value;
    // Save to localStorage
    localStorage.setItem('wl_view_style', state.browseListView);
    // Sync with desktop and mobile filter sheet selects
    document.getElementById('browseViewSelect').value = state.browseListView;
    document.getElementById('browseViewSelectMob').value = state.browseListView;
    renderList();
  });
}

// ── Render detail ─────────────────────────────────────────────
// Track collapsed state per section key
const collapsed = { names: false, classif: false, parents: false, creator: false };

export function renderDetail() {
  const panel = document.getElementById('detailContent');
  if (state.selectedId === null) { panel.innerHTML = '<div class="d-empty"><div style="font-size:32px">⛩</div><div>Select a Waza to view details</div></div>'; return; }
  const w = state.wazaData.find(x => x.id === state.selectedId); if (!w) return;
  const p = getP(w.id);
  const markings = p.markings || Array(6).fill(false);

  const vids = [w.video0, w.video1, w.video2, w.video3, w.video4, w.video5, w.video6, w.video7, w.video8, w.video9].filter(v => v && v.trim() && v !== '0');

  // Resolve embed URLs — use cache if available, otherwise compute locally
  if (!embedCache.has(w.id)) {
    embedCache.set(w.id, vids.map(v => ({ url: v, pl: platform(v), eurl: embedUrl(v) })));
  }
  const resolvedVids = embedCache.get(w.id);

  const videoHTML = resolvedVids.length
    ? resolvedVids.map((v, i) => {
      const canEmbed = !!v.eurl;
      const hasMeta = oembedEndpoint(v.url) !== null;
      const cached = oembedCache.get(v.url);
      const isLoading = hasMeta && (!cached || cached === 'pending');
      const titleText = (cached && cached !== 'pending' && cached !== 'failed' && cached.title)
        ? cached.title
        : platLabel[v.pl] + ' ' + (i + 1);
      const authorText = (cached && cached !== 'pending' && cached !== 'failed' && cached.author)
        ? cached.author : '';
      return '<div class="vlink-item" data-vi="' + i + '">'
        + '<div class="vlink-row">'
        + '<a href="' + v.url + '" target="_blank" rel="noopener">'
        + '<div class="vico" style="background:' + platColor[v.pl] + '">' + (i + 1) + '</div>'
        + '<div class="vlink-meta">'
        + '<span class="vlink-title' + (isLoading ? ' loading' : '') + '" data-url="' + escapeHtml(v.url) + '">' + escapeHtml(titleText) + '</span>'
        + (authorText ? '<span class="vlink-author">' + escapeHtml(authorText) + '</span>' : '<span class="vlink-author"></span>')
        + '</div>'
        + '</a>'
        + '<div class="vlink-actions">'  // ← New wrapper
        + (canEmbed ? '<button class="play-btn" data-vi="' + i + '">▶ Open In-App Player</button>' : '')
        + '<a class="ext-link" href="' + v.url + '" target="_blank" rel="noopener" title="Open in new tab">↗</a>'
        + '</div>'
        + '</div>'
        + (canEmbed ? '<div class="embed-wrap" data-vi="' + i + '"></div>' : '')
        + '</div>';
    }).join('')
    : '<div style="color:var(--text3);font-size:13px">No video references</div>';

  const siblings = state.wazaData.filter(x => x.id !== w.id && ((w.parent_en0 && (x.parent_en0 === w.parent_en0 || x.parent_en1 === w.parent_en0)) || (w.parent_en1 && (x.parent_en0 === w.parent_en1 || x.parent_en1 === w.parent_en1)))).slice(0, 12);
  const sibHTML = siblings.length ? siblings.map(s => '<span class="chip" data-id="' + s.id + '">' + (s.name_jp || dispName(s)) + '</span>').join('') : '<span style="color:var(--text3);font-size:13px">None found</span>';

  // Collapsible section helper
  const sec = (key, label, inner) => {
    const isCollapsed = collapsed[key];
    return '<div class="dsec">'
      + '<div class="dsec-toggle' + (isCollapsed ? ' collapsed' : '') + '" data-key="' + key + '">'
      + '<h3>' + label + '</h3><span class="toggle-arrow">▾</span></div>'
      + '<div class="dsec-body" style="' + (isCollapsed ? 'display:none' : '') + '">'
      + inner + '</div></div>';
  };

  const isSaving = state.savingIds.has(w.id);
  const savingAttr = isSaving ? ' disabled style="opacity:.5;cursor:default"' : '';

  panel.innerHTML =
    '<div class="d-njp">' + (w.name_jp || '—') + '</div>'
    + '<div class="d-nen">' + dispName(w) + '</div>'

    // Like/Dislike pill
    + '<div class="dsec"><h3>Community' + (isSaving ? ' <span style="font-size:10px;color:var(--text3);font-weight:400">syncing…</span>' : '') + '</h3>'
    + ((!state.token || state.isGuest) ? '<div style="font-size:12px;color:var(--text3);margin-bottom:6px">Sign in to like or dislike</div>' : '')
    + '<div class="like-pill-wrap">'
    + '<div class="like-pill">'
    + '<button class="like-pill-half' + (p.like === 1 ? ' like-on' : '') + '"' + ((!state.token || state.isGuest) || isSaving ? ' disabled' : '') + ' id="likeBtn">'
    + '👍 <span class="pill-count">' + (w.like_count || 0) + '</span></button>'
    + '<button class="like-pill-half' + (p.like === -1 ? ' dislike-on' : '') + '"' + ((!state.token || state.isGuest) || isSaving ? ' disabled' : '') + ' id="dislikeBtn">'
    + '👎 <span class="pill-count">' + (w.dislike_count || 0) + '</span></button>'
    + '</div>'
    + (() => {
      const lc = w.like_count || 0, dc = w.dislike_count || 0, tot = lc + dc; const pct = tot ? Math.round(lc / tot * 100) : 0;
      return '<div class="like-ratio-bar"><div class="like-ratio-fill" style="width:' + pct + '%"></div></div>';
    })()
    + '</div></div>'

    // Markings — not collapsible
    + '<div class="dsec"><h3>Markings</h3>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + SHAPES.map((s, i) => '<button class="marking-btn' + (markings[i] ? ' on' : '') + '"' + savingAttr + ' data-si="' + i + '" title="' + (state.markingLabels[i] || 'Marking ' + (i + 1)) + '">' + s + '</button>').join('') + '</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-top:6px">Toggle any combination of markings — meaning is up to you.</div></div>'

    // Videos — not collapsible
    + '<div class="dsec"><h3>Video references</h3><div class="vlinks">' + videoHTML + '</div></div>'

    // Collapsible sections
    + sec('names', 'Names',
      '<div class="dgrid">'
      + '<div class="dfield"><div class="lbl">Japanese</div><div class="val">' + (w.name_jp || '—') + '</div></div>'
      + '<div class="dfield"><div class="lbl">English</div><div class="val">' + (w.name_en || '—') + '</div></div>'
      + '<div class="dfield"><div class="lbl">Literal</div><div class="val">' + (w.name_en_literal || '—') + '</div></div>'
      + '<div class="dfield"><div class="lbl">Google translate</div><div class="val">' + (w.name_en_gtranslate || '—') + '</div></div>'
      + '</div>')

    + ((w.tag || w.reference) ? sec('classif', 'Classification',
      '<div class="dgrid">'
      + (w.tag ? '<div class="dfield"><div class="lbl">Skill level</div><div class="val">' + w.tag + '</div></div>' : '')
      + (w.reference ? '<div class="dfield" style="grid-column:1/-1"><div class="lbl">Reference / lore</div><div class="val">' + w.reference + '</div></div>' : '')
      + '</div>') : '')

    + ((w.parent_jp0 || w.parent_en0 || w.parent_jp1 || w.parent_en1) ? sec('parents', 'Parent techniques (prerequisites)',
      (w.parent_jp0 || w.parent_en0 ? (() => {
        const parent = state.wazaData.find(x => (w.parent_en0 && (x.name_en === w.parent_en0 || x.name_en_literal === w.parent_en0)) || (w.parent_jp0 && x.name_jp === w.parent_jp0));
        return '<span class="chip" ' + (parent ? 'data-id="' + parent.id + '"' : 'data-parent="' + w.parent_en0 + '"') + '>' + (w.parent_jp0 ? w.parent_jp0 : '') + (w.parent_en0 ? ' (' + w.parent_en0 + ')' : '') + '</span>';
      })() : '')
      + (w.parent_jp1 || w.parent_en1 ? (() => {
        const parent = state.wazaData.find(x => (w.parent_en1 && (x.name_en === w.parent_en1 || x.name_en_literal === w.parent_en1)) || (w.parent_jp1 && x.name_jp === w.parent_jp1));
        return '<span class="chip" ' + (parent ? 'data-id="' + parent.id + '"' : 'data-parent="' + w.parent_en1 + '"') + '>' + (w.parent_jp1 ? w.parent_jp1 : '') + (w.parent_en1 ? ' (' + w.parent_en1 + ')' : '') + '</span>';
      })() : '')) : ''
    )

    + ((w.author_jp0 || w.author_en0 || w.author_jp1 || w.author_en1) ? sec('creator', 'Creator',
      '<div class="dgrid">'
      + (w.author_jp0 || w.author_en0 ? '<div class="dfield"><div class="lbl">Author 0</div><div class="val">' + (w.author_jp0 || '') + (w.author_en0 ? ' / ' + w.author_en0 : '') + '</div></div>' : '')
      + (w.author_jp1 || w.author_en1 ? '<div class="dfield"><div class="lbl">Author 1</div><div class="val">' + (w.author_jp1 || '') + (w.author_en1 ? ' / ' + w.author_en1 : '') + '</div></div>' : '')
      + '</div>') : '')

    + '<div class="dsec"><h3>Related Waza (same family)</h3><div style="display:flex;flex-wrap:wrap;gap:4px">' + sibHTML + '</div></div>'
    + (!state.isGuest && state.token ? '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)"><button class="suggest-btn" id="suggestEditBtn">✏️ Suggest an edit</button></div>' : '');

  panel.querySelector('#likeBtn')?.addEventListener('click', () => saveP(w.id, { like: p.like === 1 ? null : 1 }));
  panel.querySelector('#dislikeBtn')?.addEventListener('click', () => saveP(w.id, { like: p.like === -1 ? null : -1 }));
  panel.querySelectorAll('.marking-btn').forEach(btn => btn.addEventListener('click', () => {
    const ns = [...markings]; ns[+btn.dataset.si] = !ns[+btn.dataset.si]; saveP(w.id, { markings: ns });
  }));

  // ── Play button toggle — lazy-load iframe on first expand ──
  panel.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
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
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
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
  // Collapsible toggles
  panel.querySelectorAll('.dsec-toggle').forEach(el => el.addEventListener('click', () => {
    const key = el.dataset.key;
    collapsed[key] = !collapsed[key];
    el.classList.toggle('collapsed', collapsed[key]);
    el.nextElementSibling.style.display = collapsed[key] ? 'none' : '';
  }));
  panel.querySelectorAll('.chip[data-parent]').forEach(chip => chip.addEventListener('click', () => { state.filters.search = chip.dataset.parent; document.getElementById('searchInput').value = chip.dataset.parent; renderList(); }));
  panel.querySelectorAll('.chip[data-id]').forEach(chip => chip.addEventListener('click', () => selectWaza(+chip.dataset.id)));
  panel.querySelector('#suggestEditBtn')?.addEventListener('click', () => openSuggestEdit(w));
}

// ── History popstate handler to support back button closing detail view ──
export function closeDetailPanel() {
  // Stop any playing embeds
  document.querySelectorAll('.embed-wrap.open iframe').forEach(f => { f.src = ''; });
  state.selectedId = null;
  renderList(); renderDetail();
  document.querySelector('.main').classList.remove('waza-selected');

  // Clean up URL without creating history entry
  const url = new URL(location.href);
  url.searchParams.delete('waza');
  history.replaceState(null, '', url);
}

// ── Navigation helper ─────────────────────────────────────────
export function navigateToBrowse() {
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="browse"]').classList.add('active');
  document.getElementById('browseView').style.display = 'flex';
  document.getElementById('statsView').style.display = 'none';
  document.getElementById('compareView').style.display = 'none';
  document.getElementById('accountView').style.display = 'none';
  document.getElementById('contributeView').style.display = 'none';
}

// ── Contribute tab ────────────────────────────────────────────
