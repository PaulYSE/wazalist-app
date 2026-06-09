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

// Returns { cls, style } — cls is 'sh-active' if any markings on, style is the inline color string.
// Uses circular (vector) mean of hues so blends wrap correctly across 0°/360°.
// Memoized: there are only 64 possible markings combos, and the all-false case
// dominates a typical list, so caching collapses most calls to a Map lookup.
const _msCache = new Map();

/**
 * @brief Computes marking style with memoization.
 *
 * @param {Array<boolean>} markings - Array of 6 boolean marking states.
 * @return {Object} Object containing CSS class and inline style string.
 */
export function markingStyle(markings) {
  const key = (markings || []).map((b) => (b ? '1' : '0')).join('');
  const hit = _msCache.get(key);
  if (hit) return hit;
  const v = _computeMarkingStyle(markings);
  _msCache.set(key, v);
  return v;
}

/**
 * @brief Computes marking style without memoization.
 *
 * @param {Array<boolean>} markings - Array of 6 boolean marking states.
 * @return {Object} Object containing CSS class and inline style string.
 */
function _computeMarkingStyle(markings) {
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
  const t = Math.pow((count - 1) / 5, 0.65);
  const sat = Math.round(38 + t * 57);
  const bgL = Math.round(7.5 + t * 9);
  const bdL = Math.round(42 + t * 44);
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
      ',70%,' +
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
      (state.markingLabels[i] || 'Marking ' + (i + 1)) +
      '">' +
      s +
      '</span>',
  ).join('');

/**
 * @brief Detects video platform from URL.
 *
 * @param {string} url - Video URL.
 * @return {string} Platform identifier: 'yt', 'bili', 'tw', 'nico', 'fb', or 'other'.
 */
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

/**
 * @brief Extracts timestamp parameter from video URL.
 *
 * Supports formats: ?t=90, &t=90s, ?t=1m30s, etc.
 *
 * @param {string} url - Video URL.
 * @return {number|null} Timestamp in seconds, or null if not found.
 */
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

/**
 * @brief Converts video URL to embeddable iframe URL.
 *
 * Supports YouTube, Bilibili, and NicoNico. Returns null for platforms without iframe support (Twitter/X).
 *
 * @param {string} url - Video URL.
 * @return {string|null} Embed URL or null.
 */
export function embedUrl(url) {
  if (!url) return null;

  // Handle timestamp for URLs that support it (YouTube, Bilibili)
  const timestamp = extractTimestamp(url);

  // YouTube
  let m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/,
  );
  if (m)
    return (
      'https://www.youtube-nocookie.com/embed/' +
      m[1] +
      '?rel=0&modestbranding=1' +
      (timestamp ? '&start=' + timestamp : '')
    );
  // Bilibili BV
  m = url.match(/(?:bilibili\.com\/video\/|b23\.tv\/)(BV[A-Za-z0-9]+)/i);
  if (m)
    return (
      'https://player.bilibili.com/player.html?bvid=' +
      m[1] +
      '&high_quality=1&danmaku=0' +
      (timestamp ? '&t=' + timestamp : '')
    );
  // Bilibili av
  m = url.match(/bilibili\.com\/video\/av(\d+)/i);
  if (m)
    return (
      'https://player.bilibili.com/player.html?aid=' +
      m[1] +
      '&high_quality=1&danmaku=0' +
      (timestamp ? '&t=' + timestamp : '')
    );
  // NicoNico
  m = url.match(/(?:nicovideo\.jp\/watch\/|nico\.ms\/)((?:sm|nm|so)\d+)/);
  if (m) {
    let embed =
      'https://embed.nicovideo.jp/watch/' +
      m[1] +
      '?oldScript=1&referer=&from=0&allowProgrammaticFullScreen=1';
    if (timestamp) embed = embed.replace('&from=0', '&from=' + timestamp);
    return embed;
  }
  // Twitter/X — no iframe embed support; links open externally via the ↗ button
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
 * @brief Returns oEmbed endpoint URL for a given video URL.
 *
 * @param {string} url - Video URL.
 * @return {string|null} oEmbed API endpoint or null.
 */
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
  ].filter((v) => v && v.trim() && v !== '0');
  if (!vids.length) return '';
  return (
    '<div class="wce-videos">' +
    vids
      .map((v, i) => {
        const pl = platform(v);
        return (
          '<a class="vid-btn" href="' +
          v +
          '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' +
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

/**
 * @brief Canonical identity key for a video URL — platform + id, ignoring
 *        timestamps, query params, and short/long URL form. Two URLs pointing
 *        at the same video (e.g. youtu.be/X and youtube.com/watch?v=X&t=90)
 *        produce the same key. Falls back to a normalized raw URL for
 *        platforms without an extractable id.
 *
 * @param {string} url - Video URL.
 * @return {string|null} Identity key like "yt:dRJkbHvHli4", or null for empty input.
 */
export function videoKey(url) {
  if (!url || !url.trim()) return null;
  const u = url.trim();

  let m = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/,
  );
  if (m) return 'yt:' + m[1];

  m = u.match(/(?:bilibili\.com\/video\/|b23\.tv\/)(BV[A-Za-z0-9]+)/i);
  if (m) return 'bili:' + m[1].toLowerCase();

  m = u.match(/bilibili\.com\/video\/av(\d+)/i);
  if (m) return 'bili:av' + m[1];

  m = u.match(/(?:nicovideo\.jp\/watch\/|nico\.ms\/)((?:sm|nm|so)\d+)/);
  if (m) return 'nico:' + m[1];

  m = u.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  if (m) return 'tw:' + m[1];

  // Fallback: strip protocol, www, trailing slash, and query/hash, lowercase.
  return (
    'raw:' +
    u
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
  );
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
