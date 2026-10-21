/**
 * @file render-helpers.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-10
 * @brief Shared rendering utilities for marking styles/pips, video platform detection, oEmbed handling, and UI components like video buttons and like pills.
 */

import {
  SHAPES,
  SHAPES_HUES,
  platLabel,
  platColor,
  LIKE_UP,
  LIKE_DOWN,
} from '../config/constants.js';
import { state } from '../state/state.js';
import { THEME_REGISTRY } from '../config/theme-registry.js';
import { escapeHtml, safeWebUrl } from '../lib/escape.js';

// Returns { cls, style } — cls is 'sh-active' if any markings on, style is the inline color string.
// Uses circular (vector) mean of hues so blends wrap correctly across 0°/360°.
// Memoized: there are only 64 possible markings combos, and the all-false case
// dominates a typical list, so caching collapses most calls to a Map lookup.
const _msCache = new Map();

/**
 * @brief Returns the active resolved theme name ('light' | 'dark' | 'slate').
 *        Reads the data-theme attribute set by the theme system; defaults to a
 *        dark-family treatment if unset.
 *
 * @return {string} Resolved theme name.
 */
function activeTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

// theme key → tier, derived from the registry's `tier` field (fallback by group).
const _tierByTheme = Object.fromEntries(
  THEME_REGISTRY.map((t) => [t.key, t.tier || (t.group === 'light' ? 'light' : 'deep')]),
);

/**
 * @brief Computes marking style with memoization (theme-aware).
 *
 * The cache is keyed by theme + markings, so switching themes yields fresh
 * styles rather than stale ones computed for the previous theme.
 *
 * @param {Array<boolean>} markings - Array of 6 boolean marking states.
 * @return {Object} Object containing CSS class and inline style string.
 */
export function markingStyle(markings) {
  const theme = activeTheme();
  const tier = _tierByTheme[theme] || 'deep';
  const key = tier + ':' + (markings || []).map((b) => (b ? '1' : '0')).join('');
  const hit = _msCache.get(key);
  if (hit) return hit;
  const v = _computeMarkingStyle(markings, tier);
  _msCache.set(key, v);
  return v;
}

// Per-tier marking-tint tuning. Each maps the 1→6 marking-count curve (t: 0→1)
// onto saturation + fill-lightness + border-lightness ranges. Higher saturation
// and more lightness-separation from the base = more prominent tints.
//   sat:  [min%, max%]  — color intensity (more markings → more saturated)
//   bgL:  [min%, max%]  — fill lightness (dark themes: above base; light: below)
//   bdL:  [min%, max%]  — border-left lightness (the accent edge)
const MARKING_TIERS = {
  black: { sat: [52, 88], bgL: [11, 22], bdL: [48, 74] },
  deep: { sat: [48, 85], bgL: [12, 25], bdL: [50, 76] },
  mid: { sat: [44, 80], bgL: [20, 35], bdL: [52, 78] },
  light: { sat: [48, 80], bgL: [91, 80], bdL: [50, 35] },
  'warm-light': { sat: [54, 84], bgL: [89, 78], bdL: [48, 33] },
};
const DEFAULT_TIER = 'deep';

/**
 * @brief Computes marking style without memoization (theme-tier aware).
 *
 * Hues are fixed (SHAPES_HUES, circular-mean blend). Saturation, fill lightness,
 * and border lightness are driven by the active theme's tier, so tints stay
 * prominent against each theme's particular background.
 *
 * @param {Array<boolean>} markings - Array of 6 boolean marking states.
 * @param {string} tier - The active theme's marking tier.
 * @return {Object} { cls, style }.
 */
function _computeMarkingStyle(markings, tier) {
  const active = (markings || []).map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  if (!active.length) return { cls: '', style: '' };

  let sinSum = 0,
    cosSum = 0;
  active.forEach((i) => {
    const rad = (SHAPES_HUES[i] * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  });
  const hue = Math.round(((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360);

  const count = active.length;
  const t = Math.pow((count - 1) / 5, 0.65); // 0 at 1 marking → 1 at 6

  const p = MARKING_TIERS[tier] || MARKING_TIERS[DEFAULT_TIER];
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const sat = lerp(p.sat[0], p.sat[1]);
  const bgL = lerp(p.bgL[0], p.bgL[1]);
  const bdL = lerp(p.bdL[0], p.bdL[1]);

  return {
    cls: 'sh-active',
    style:
      'background:hsl(' +
      hue +
      ',' +
      sat +
      '%,' +
      bgL +
      '%);border-left-color:hsl(' +
      hue +
      ',' +
      Math.min(sat + 10, 100) +
      '%,' +
      bdL +
      '%)',
  };
}

/**
 * @brief Generates HTML for marking pips.
 *
 * @param {Array<boolean>} markings - Array of 6 boolean marking states.
 * @return {string} HTML string of pip spans.
 */
export const markingPips = (markings) =>
  SHAPES.map(
    (s, i) =>
      '<span class="marking-pip' +
      (markings[i] ? ' on' : '') +
      '" title="' +
      escapeHtml(state.markingLabels[i] || 'Marking ' + (i + 1)) +
      '">' +
      s +
      '</span>',
  ).join('');

/**
 * Parses an absolute HTTP(S) URL.
 *
 * Uses browser URL parsing without validating destination trust,
 * credentials, or video-specific paths.
 *
 * @param {string} url URL to parse.
 * @return {?URL} Parsed HTTP(S) URL, or null for invalid input or
 *     an unsupported protocol.
 */
function parseVideoWebUrl(url) {
  if (typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * Checks whether a normalized hostname is a domain or its subdomain.
 *
 * @param {string} hostname Normalized hostname from a parsed URL.
 * @param {string} domain Lowercase domain to match.
 * @return {boolean} Whether the hostname matches the domain boundary.
 */
function hostnameMatches(hostname, domain) {
  return (
    hostname === domain ||
    hostname.endsWith('.' + domain)
  );
}

/**
 * Identifies a video platform from an absolute HTTP(S) URL's hostname.
 *
 * Accepts configured domains and their subdomains. Does not inspect
 * video paths or resolve redirects.
 *
 * @param {string} url Video URL to classify.
 * @return {string} Platform identifier: yt, bili, tw, nico, fb, or
 *     other for invalid URLs, unsupported protocols, or unknown hosts.
 */
export function platform(url) {
  const parsed = parseVideoWebUrl(url);
  if (!parsed) return 'other';

  const host = parsed.hostname;

  const groups = [
    ['yt', ['youtu.be', 'youtube.com']],
    ['bili', ['bilibili.com', 'b23.tv']],
    ['tw', ['twitter.com', 'x.com']],
    ['nico', ['nicovideo.jp', 'nico.ms']],
    ['fb', ['facebook.com', 'fb.com']],
  ];

  for (const [key, domains] of groups) {
    if (domains.some((domain) => hostnameMatches(host, domain))) {
      return key;
    }
  }

  return 'other';
}

// Helper: extract timestamp from URL (handles ?t=90, &t=90, #t=1m30s)

/**
 * Extracts the first t parameter and converts its value to seconds.
 *
 * Supports integer seconds with an optional s suffix, minutes with an m
 * suffix, and combined minutes and seconds, such as 90, 90s, 2m, or 1m30s.
 * Recognizes t at the start of the input or after ?, &, or #.
 *
 * @param {string} url URL or parameter string to inspect.
 * @return {?number} Nonnegative safe-integer seconds, or null if the
 *     parameter is absent, malformed, or exceeds the safe-integer range.
 */
export function extractTimestamp(url) {
  const match = url.match(/(?:^|[?&#])t=([^&#]*)/);
  if (!match) return null;

  const value = match[1];
  let seconds;

  if (/^\d+s?$/.test(value)) {
    seconds = Number(value.replace(/s$/, ''));
  } else {
    const units = value.match(/^(\d+)m(?:(\d+)s)?$/);
    if (!units) return null;

    seconds = Number(units[1]) * 60 + Number(units[2] || 0);
  }

  return Number.isSafeInteger(seconds) ? seconds : null;
}

// Embed URL resolver — returns null for platforms with no iframe support

/**
 * Builds an iframe URL for a recognized video URL format.
 *
 * Supports YouTube watch, short-link, shorts, and embed paths;
 * Bilibili BV/av paths and BV-shaped b23.tv paths; and NicoNico
 * watch/short-link paths. Does not resolve short-link redirects.
 *
 * Applies timestamps recognized by extractTimestamp(). A generated
 * URL does not guarantee that the video exists or permits embedding.
 *
 * @param {string} url Absolute HTTP(S) video URL.
 * @return {?string} Embed URL, or null for invalid URLs, unsupported
 *     hosts, or unrecognized video paths.
 */
export function embedUrl(url) {
  const parsed = parseVideoWebUrl(url);
  if (!parsed) return null;

  const host = parsed.hostname;
  const path = parsed.pathname;
  const timestamp = extractTimestamp(url);
  const hasTimestamp = timestamp !== null;

  // YouTube.
  let youtubeId = null;

  if (hostnameMatches(host, 'youtu.be')) {
    const match = path.match(
      /^\/([A-Za-z0-9_-]{11})(?:\/|$)/,
    );
    youtubeId = match ? match[1] : null;
  } else if (hostnameMatches(host, 'youtube.com')) {
    if (path === '/watch') {
      const candidate = parsed.searchParams.get('v');

      if (candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)) {
        youtubeId = candidate;
      }
    } else {
      const match = path.match(
        /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})(?:\/|$)/,
      );
      youtubeId = match ? match[1] : null;
    }
  }

  if (youtubeId) {
    return (
      'https://www.youtube-nocookie.com/embed/' +
      youtubeId +
      '?rel=0&modestbranding=1' +
      (hasTimestamp ? '&start=' + timestamp : '')
    );
  }

  // Bilibili.
  const isBilibili = hostnameMatches(host, 'bilibili.com');
  const isB23 = hostnameMatches(host, 'b23.tv');

  if (isBilibili || isB23) {
    const bvMatch = isBilibili
      ? path.match(/^\/video\/(BV[A-Za-z0-9]+)(?:\/|$)/i)
      : path.match(/^\/(BV[A-Za-z0-9]+)(?:\/|$)/i);

    if (bvMatch) {
      return (
        'https://player.bilibili.com/player.html?bvid=' +
        bvMatch[1] +
        '&high_quality=1&danmaku=0' +
        (hasTimestamp ? '&t=' + timestamp : '')
      );
    }

    const avMatch = isBilibili
      ? path.match(/^\/video\/av(\d+)(?:\/|$)/i)
      : null;

    if (avMatch) {
      return (
        'https://player.bilibili.com/player.html?aid=' +
        avMatch[1] +
        '&high_quality=1&danmaku=0' +
        (hasTimestamp ? '&t=' + timestamp : '')
      );
    }
  }

  // NicoNico.
  const isNicoVideo = hostnameMatches(host, 'nicovideo.jp');
  const isNicoShort = hostnameMatches(host, 'nico.ms');

  if (isNicoVideo || isNicoShort) {
    const match = isNicoVideo
      ? path.match(/^\/watch\/((?:sm|nm|so)\d+)(?:\/|$)/)
      : path.match(/^\/((?:sm|nm|so)\d+)(?:\/|$)/);

    if (match) {
      return (
        'https://embed.nicovideo.jp/watch/' +
        match[1] +
        '?oldScript=1&referer=&from=' +
        (hasTimestamp ? timestamp : 0) +
        '&allowProgrammaticFullScreen=1'
      );
    }
  }

  return null;
}

// Per-session embed cache: wazaId → array of resolved video objects

/**
 * @brief Cache for embed data keyed by waza ID.
 *
 * @type {Map<number, Array>}
 */
export const embedCache = new Map();

// Per-session oEmbed metadata cache: url → { title, author } | 'pending' | 'failed'

/**
 * @brief Cache for oEmbed metadata keyed by URL.
 *
 * @type {Map<string, Object|string>}
 */
export const oembedCache = new Map();

// oEmbed endpoint resolvers — returns a fetch URL or null if unsupported

/**
 * Builds a metadata endpoint URL for a recognized video platform.
 *
 * Uses platform() for hostname-based classification. Routes YouTube
 * URLs to its oEmbed endpoint and NicoNico, Bilibili, and Twitter/X
 * URLs to noembed. Encodes the original input URL unchanged.
 *
 * Does not fetch metadata, validate video paths, or resolve redirects.
 * A returned endpoint does not guarantee metadata availability.
 *
 * @param {string} url Absolute HTTP(S) video URL.
 * @return {?string} Metadata endpoint URL, or null for invalid URLs,
 *     unsupported protocols, or platforms without a configured endpoint.
 */
export function oembedEndpoint(url) {
  const pl = platform(url);

  if (pl === 'yt') {
    return (
      'https://www.youtube.com/oembed?url=' +
      encodeURIComponent(url) +
      '&format=json'
    );
  }

  if (['nico', 'bili', 'tw'].includes(pl)) {
    return (
      'https://noembed.com/embed?url=' +
      encodeURIComponent(url)
    );
  }

  return null;
}

// Fetch oEmbed for a single URL and update all matching DOM spans in the detail panel

/**
 * @brief Fetches oEmbed metadata for a URL and updates DOM.
 *
 * @param {string} url - Video URL.
 * @return {Promise<void>}
 */
export async function fetchOembed(url) {
  if (oembedCache.has(url)) return;
  oembedCache.set(url, 'pending');
  const endpoint = oembedEndpoint(url);
  if (!endpoint) {
    oembedCache.set(url, 'failed');
    applyOembedToDOM(url);
    return;
  }
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

/**
 * @brief Applies cached oEmbed metadata to DOM elements.
 *
 * @param {string} url - Video URL.
 * @return {void}
 */
export function applyOembedToDOM(url) {
  const meta = oembedCache.get(url);
  if (!meta || meta === 'pending') return;
  document.querySelectorAll('.vlink-title[data-url]').forEach((el) => {
    if (el.dataset.url !== url) return;
    if (meta === 'failed') {
      el.classList.remove('loading');
      return;
    }
    el.textContent = meta.title || el.textContent;
    el.classList.remove('loading');
    const authorEl = el.closest('.vlink-meta')?.querySelector('.vlink-author');
    if (authorEl && meta.author) authorEl.textContent = meta.author;
  });
}

// Kick off oEmbed fetches for all videos of a waza (called after renderDetail)

/**
 * @brief Prefetches oEmbed metadata for all videos of a waza.
 *
 * @param {Array<Object>} vids - Array of video objects with 'url' property.
 * @return {void}
 */
export function prefetchOembeds(vids) {
  vids.forEach((v) => {
    const cached = oembedCache.get(v.url);
    if (cached && cached !== 'pending') {
      // Already have data — apply immediately (DOM was just rebuilt)
      applyOembedToDOM(v.url);
    } else {
      fetchOembed(v.url);
    }
  });
}

/**
 * @brief Generates video button HTML for a waza.
 *
 * @param {Object} w - Waza object containing video0..video9 fields.
 * @return {string} HTML string of video buttons.
 */
export function videoButtons(w) {
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
  ]
    .map((value) => safeWebUrl(value))
    .filter((value) => value !== null);

  if (!vids.length) return '';

  return (
    '<div class="wce-videos">' +
    vids
      .map((url, i) => {
        const pl = platform(url);

        return (
          '<a class="vid-btn" href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener" ' +
          'onclick="event.stopPropagation()">' +
          '<span class="vid-dot" style="background:' +
          platColor[pl] +
          '"></span>' +
          platLabel[pl] +
          ' ' +
          (i + 1) +
          '</a>'
        );
      })
      .join('') +
    '</div>'
  );
}

// Mini like/dislike pill for list/card views

/**
 * @brief Generates like/dislike pill HTML for list/card views.
 *
 * @param {Object} w - Waza object with like_count and dislike_count.
 * @param {Object} p - Progress object with like property.
 * @return {string} HTML string of like/dislike pill.
 */
export function cardLikePill(w, p) {
  const lc = w.like_count || 0,
    dc = w.dislike_count || 0;
  if (!lc && !dc && p.like === null) return '';
  return (
    '<div class="card-like-pill">' +
    '<span class="' +
    (p.like === LIKE_UP ? 'like-on' : '') +
    '">' +
    '👍 ' +
    lc +
    '</span>' +
    '<span class="' +
    (p.like === LIKE_DOWN ? 'dislike-on' : '') +
    '">' +
    '👎 ' +
    dc +
    '</span>' +
    '</div>'
  );
}

export function videoKey(url) {
  if (typeof url !== 'string' || !url.trim()) return null;

  const u = url.trim();
  const parsed = parseVideoWebUrl(u);
  if (!parsed) return null;

  if (parsed) {
    const host = parsed.hostname;
    const path = parsed.pathname;

    // YouTube.
    let youtubeId = null;

    if (hostnameMatches(host, 'youtu.be')) {
      const match = path.match(
        /^\/([A-Za-z0-9_-]{11})(?:\/|$)/,
      );
      youtubeId = match ? match[1] : null;
    } else if (hostnameMatches(host, 'youtube.com')) {
      if (path === '/watch') {
        const candidate = parsed.searchParams.get('v');

        if (candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)) {
          youtubeId = candidate;
        }
      } else {
        const match = path.match(
          /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})(?:\/|$)/,
        );
        youtubeId = match ? match[1] : null;
      }
    }

    if (youtubeId) return 'yt:' + youtubeId;

    // Bilibili.
    const isBilibili = hostnameMatches(host, 'bilibili.com');
    const isB23 = hostnameMatches(host, 'b23.tv');

    if (isBilibili || isB23) {
      const bvMatch = isBilibili
        ? path.match(/^\/video\/(BV[A-Za-z0-9]+)(?:\/|$)/i)
        : path.match(/^\/(BV[A-Za-z0-9]+)(?:\/|$)/i);

      if (bvMatch) {
        return 'bili:' + bvMatch[1].toLowerCase();
      }

      const avMatch = isBilibili
        ? path.match(/^\/video\/av(\d+)(?:\/|$)/i)
        : null;

      if (avMatch) return 'bili:av' + avMatch[1];
    }

    // NicoNico.
    const isNicoVideo = hostnameMatches(host, 'nicovideo.jp');
    const isNicoShort = hostnameMatches(host, 'nico.ms');

    if (isNicoVideo || isNicoShort) {
      const match = isNicoVideo
        ? path.match(/^\/watch\/((?:sm|nm|so)\d+)(?:\/|$)/)
        : path.match(/^\/((?:sm|nm|so)\d+)(?:\/|$)/);

      if (match) return 'nico:' + match[1];
    }

    // Twitter/X.
    if (
      hostnameMatches(host, 'twitter.com') ||
      hostnameMatches(host, 'x.com')
    ) {
      const match = path.match(
        /^\/[^/]+\/status\/(\d+)(?:\/|$)/,
      );

      if (match) return 'tw:' + match[1];
    }
  }

  // Existing fallback preserved pending a separate identity-policy review.
  return 'raw:' + parsed.href;
}

/**
 * @brief Whether two video URLs refer to the same video (timestamp-insensitive).
 *
 * @param {string} a - First URL.
 * @param {string} b - Second URL.
 * @return {boolean} True if both resolve to the same video identity.
 */
export function sameVideo(a, b) {
  const ka = videoKey(a);
  return ka !== null && ka === videoKey(b);
}
