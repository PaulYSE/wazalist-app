/* render-helpers.js — small pure-ish helpers shared by the renderers:
   marking styles/pips and video/oEmbed handling. */
// const SHAPE_HUES = [200, 45, 123, 280, 80, 330];
export const SHAPE_HUES = [4, 28, 54, 118, 212, 272];

// Returns { cls, style } — cls is 'sh-active' if any markings on, style is the inline color string.
// Uses circular (vector) mean of hues so blends wrap correctly across 0°/360°.
export function markingStyle(markings) {
  const active = (markings || []).map((on, i) => on ? i : -1).filter(i => i >= 0);
  if (!active.length) return { cls: '', style: '' };
  let sinSum = 0, cosSum = 0;
  active.forEach(i => {
    const rad = SHAPE_HUES[i] * Math.PI / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  });
  const hue = Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
  const count = active.length;
  const t = Math.pow((count - 1) / 5, 0.65); // 0 at count=1, 1 at count=6, front-weighted
  const sat = Math.round(38 + t * 57);  // 38% → 95%
  const bgL = Math.round(7.5 + t * 9);  // 7.5% → 16.5%
  const bdL = Math.round(42 + t * 44);  // 42% → 86%
  return {
    cls: 'sh-active',
    style: 'background:hsl(' + hue + ',' + sat + '%,' + bgL + '%);border-left-color:hsl(' + hue + ',70%,' + bdL + '%)'
  };
}
export const markingPips = markings => SHAPES.map((s, i) => '<span class="marking-pip' + (markings[i] ? ' on' : '') + '" title="' + (markingLabels[i] || 'Marking ' + (i + 1)) + '">' + s + '</span>').join('');

export function platform(url) {
  if (!url) return 'other';
  if (/youtu\.be|youtube\.com/.test(url)) return 'yt';
  if (/bilibili\.com|b23\.tv/.test(url)) return 'bili';
  if (/twitter\.com|x\.com/.test(url)) return 'tw';
  if (/nicovideo\.jp|nico\.ms/.test(url)) return 'nico';
  if (/facebook\.com|fb\.com/.test(url)) return 'fb';
  return 'other';
}

// Helper: extract timestamp from URL (handles ?t=90, &t=90, #t=1m30s)
export function extractTimestamp(url) {
  // Seconds format: ?t=90 or &t=90s
  let m = url.match(/(?:\?|&)t=(\d+)s?/);
  if (m) return parseInt(m[1]);

  // Minutes:seconds format: ?t=1m30s or &t=2m
  m = url.match(/(?:\?|&)t=(?:(\d+)m)?(\d+)s?/);
  if (m) {
    const min = m[1] ? parseInt(m[1]) : 0;
    const sec = m[2] ? parseInt(m[2]) : 0;
    return min * 60 + sec;
  }
  return null;
}

// Embed URL resolver — returns null for platforms with no iframe support
export function embedUrl(url) {
  if (!url) return null;

  // Handle timestamp for URLs that support it (YouTube, Bilibili)
  const timestamp = extractTimestamp(url);

  // YouTube
  let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/);
  if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0&modestbranding=1' + (timestamp ? '&start=' + timestamp : '');
  // Bilibili BV
  m = url.match(/(?:bilibili\.com\/video\/|b23\.tv\/)(BV[A-Za-z0-9]+)/i);
  if (m) return 'https://player.bilibili.com/player.html?bvid=' + m[1] + '&high_quality=1&danmaku=0' + (timestamp ? '&t=' + timestamp : '');
  // Bilibili av
  m = url.match(/bilibili\.com\/video\/av(\d+)/i);
  if (m) return 'https://player.bilibili.com/player.html?aid=' + m[1] + '&high_quality=1&danmaku=0' + (timestamp ? '&t=' + timestamp : '');
  // NicoNico
  m = url.match(/(?:nicovideo\.jp\/watch\/|nico\.ms\/)((?:sm|nm|so)\d+)/);
  if (m) {
    let embed = 'https://embed.nicovideo.jp/watch/' + m[1] + '?oldScript=1&referer=&from=0&allowProgrammaticFullScreen=1';
    if (timestamp) embed = embed.replace('&from=0', '&from=' + timestamp);
    return embed;
  }
  // Twitter/X — no iframe embed support; links open externally via the ↗ button
  return null;
}

// Per-session embed cache: wazaId → array of resolved video objects
export const embedCache = new Map();

// Per-session oEmbed metadata cache: url → { title, author } | 'pending' | 'failed'
export const oembedCache = new Map();

// oEmbed endpoint resolvers — returns a fetch URL or null if unsupported
export function oembedEndpoint(url) {
  if (!url) return null;
  // YouTube
  if (/youtu\.be|youtube\.com/.test(url))
    return 'https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json';
  // NicoNico
  if (/nicovideo\.jp|nico\.ms/.test(url))
    return 'https://noembed.com/embed?url=' + encodeURIComponent(url);
  // Bilibili — no public oEmbed; noembed covers some
  if (/bilibili\.com|b23\.tv/.test(url))
    return 'https://noembed.com/embed?url=' + encodeURIComponent(url);
  // Twitter/X — noembed
  if (/twitter\.com|x\.com/.test(url))
    return 'https://noembed.com/embed?url=' + encodeURIComponent(url);
  return null;
}

// Fetch oEmbed for a single URL and update all matching DOM spans in the detail panel
export async function fetchOembed(url) {
  if (oembedCache.has(url)) return;
  oembedCache.set(url, 'pending');
  const endpoint = oembedEndpoint(url);
  if (!endpoint) { oembedCache.set(url, 'failed'); applyOembedToDOM(url); return; }
  try {
    const r = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const meta = { title: d.title || '', author: d.author_name || '' };
    oembedCache.set(url, meta);
  } catch {
    oembedCache.set(url, 'failed');
  }
  applyOembedToDOM(url);
}

// Update the DOM spans for a specific URL after metadata arrives
export function applyOembedToDOM(url) {
  const meta = oembedCache.get(url);
  if (!meta || meta === 'pending') return;
  document.querySelectorAll('.vlink-title[data-url]').forEach(el => {
    if (el.dataset.url !== url) return;
    if (meta === 'failed') { el.classList.remove('loading'); return; }
    el.textContent = meta.title || el.textContent;
    el.classList.remove('loading');
    const authorEl = el.closest('.vlink-meta')?.querySelector('.vlink-author');
    if (authorEl && meta.author) authorEl.textContent = meta.author;
  });
}

// Kick off oEmbed fetches for all videos of a waza (called after renderDetail)
export function prefetchOembeds(vids) {
  vids.forEach(v => {
    const cached = oembedCache.get(v.url);
    if (cached && cached !== 'pending') {
      // Already have data — apply immediately (DOM was just rebuilt)
      applyOembedToDOM(v.url);
    } else {
      fetchOembed(v.url);
    }
  });
}
export function videoButtons(w) {
  const vids = [w.video0, w.video1, w.video2, w.video3, w.video4, w.video5, w.video6, w.video7, w.video8, w.video9].filter(v => v && v.trim() && v !== '0');
  if (!vids.length) return '';
  return '<div class="wce-videos">' + vids.map((v, i) => {
    const pl = platform(v);
    return '<a class="vid-btn" href="' + v + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">'
      + '<span class="vid-dot" style="background:' + platColor[pl] + '"></span>'
      + platLabel[pl] + ' ' + (i + 1) + '</a>';
  }).join('') + '</div>';
}

// Mini like/dislike pill for list/card views
export function cardLikePill(w, p) {
  const lc = w.like_count || 0, dc = w.dislike_count || 0;
  if (!lc && !dc && p.like === null) return '';
  return '<div class="card-like-pill">'
    + '<span class="' + (p.like === LIKE_UP ? 'like-on' : '') + '">' + '👍 ' + lc + '</span>'
    + '<span class="' + (p.like === LIKE_DOWN ? 'dislike-on' : '') + '">' + '👎 ' + dc + '</span>'
    + '</div>';
}

// ── Render browse list ────────────────────────────────────────
