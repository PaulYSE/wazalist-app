/**
  * @file render-helpers.js
  * @author Paul Yong Shao En
  * @email paulyse99@gmail.com
  * @project Wazalist App
  * @date 2026-10-21
  * @fileoverview Shared helpers for marking styles, marking indicators,
  * video links, embed URLs, metadata retrieval, and video comparison keys.
  *
  * Reads application state and the active document theme. Maintains
  * in-memory caches, retrieves video metadata with bounded retries,
  * and updates matching video metadata elements in the document.
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
 * Reads the current theme name from the document's data-theme attribute.
 *
 * Returns dark when the attribute is absent or empty. Does not validate
 * the theme name against THEME_REGISTRY.
 *
 * @return {string} Nonempty theme attribute value, or dark as the fallback.
 */
function activeTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

// theme key → tier, derived from the registry's `tier` field (fallback by group).
const _tierByTheme = Object.fromEntries(
  THEME_REGISTRY.map((t) => [t.key, t.tier || (t.group === 'light' ? 'light' : 'deep')]),
);

/**
 * Returns cached marking styles for the current theme's marking tier.
 *
 * Combines active marking hues and adjusts styling by tier. Themes
 * sharing a tier reuse cached results for the same marking combination.
 * Returns empty class and style strings when no markings are active.
 *
 * The returned object is shared with the cache and must not be modified.
 *
 * @param {!Array<boolean>} markings Six marking states in SHAPES order.
 * @return {{cls: string, style: string}} CSS class and inline style text.
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
 * Computes marking colors for a theme tier without caching.
 *
 * Blends active SHAPES_HUES using a circular mean. Adjusts saturation,
 * background lightness, and left-border lightness using the tier settings
 * and number of active markings.
 *
 * Returns empty class and style strings when no markings are active.
 *
 * @param {!Array<boolean>} markings Six marking states in SHAPES order.
 * @param {string} tier Configured marking tier.
 * @return {{cls: string, style: string}} CSS class and inline background
 *     and left-border color declarations.
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
 * Builds HTML spans representing active and inactive markings.
 *
 * Generates one span per SHAPES entry and adds the on class for active
 * markings. Uses HTML-escaped titles from state.markingLabels, falling
 * back to "Marking 1", "Marking 2", and so on for missing or empty labels.
 *
 * @param {!Array<boolean>} markings Six marking states in SHAPES order.
 * @return {string} Concatenated marking-span HTML without a container.
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
 * Parses and normalizes an absolute HTTP(S) video URL.
 *
 * Corrects a legacy malformed YouTube short-link form where the first
 * query parameter begins with an ampersand, such as:
 *
 *   youtu.be/VIDEO_ID&t=90s
 *
 * The corrected parsed URL uses:
 *
 *   youtu.be/VIDEO_ID?t=90s
 *
 * Does not validate destination trust, credentials, or video existence.
 *
 * @param {string} url URL to parse.
 * @return {?URL} Parsed and normalized HTTP(S) URL, or null for invalid
 *     input or an unsupported protocol.
 */
function parseVideoWebUrl(url) {
  if (typeof url !== 'string') return null;

  let normalized = url.trim();

  normalized = normalized.replace(
    /^(https?:\/\/(?:[^./]+\.)?youtu\.be\/[A-Za-z0-9_-]{11})&(?=[^#]*=)/i,
    '$1?',
  );

  try {
    const parsed = new URL(normalized);

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
 * Shared in-memory cache for video embed data.
 *
 * This module declares the cache; consuming modules populate and read it.
 * Not persisted across page reloads.
 *
 * @type {!Map<number, *>}
 */
export const embedCache = new Map();

// Per-session oEmbed metadata cache: url → { title, author } | 'pending' | 'failed'

/**
 * Stores video metadata or retrieval state by exact input URL.
 *
 * Values are metadata objects, pending, or failed. Retry eligibility
 * and in-flight operations are tracked separately.
 *
 * Held in module memory; not persisted across page reloads.
 *
 * @type {!Map<string, ({title: string, author: string}|'pending'|'failed')>}
 */
export const oembedCache = new Map();

/**
 * Tracks metadata requests currently running for each URL.
 *
 * Concurrent callers reuse the same promise instead of starting duplicate
 * request cycles. Entries are removed when their request cycle completes.
 *
 * Held in module memory; not persisted across page reloads.
 *
 * @type {!Map<string, !Promise<void>>}
 */
const oembedInFlight = new Map();

/**
 * Stores the earliest retry time for failed metadata requests.
 *
 * Uses Date.now() timestamps. Infinity marks terminal failures that are not
 * eligible for another retry during the current page lifetime.
 *
 * Held in module memory; not persisted across page reloads.
 *
 * @type {!Map<string, number>}
 */
const oembedRetryAt = new Map();

// oEmbed endpoint resolvers — returns a fetch URL or null if unsupported

/**
 * Builds a metadata endpoint URL for a recognized video platform.
 *
 * Uses platform() for hostname-based classification. Routes YouTube
 * URLs to its oEmbed endpoint and NicoNico, Bilibili, and Twitter/X
 * URLs to noembed.
 *
 * Normalizes supported legacy URL forms before embedding the source URL
 * in the metadata request. Does not fetch metadata, validate video paths,
 * or resolve redirects.
 *
 * @param {string} url Absolute HTTP(S) video URL.
 * @return {?string} Metadata endpoint URL, or null for invalid URLs,
 *     unsupported protocols, or platforms without a configured endpoint.
 */
export function oembedEndpoint(url) {
  const parsed = parseVideoWebUrl(url);
  if (!parsed) return null;

  const normalizedUrl = parsed.href;
  const pl = platform(normalizedUrl);

  if (pl === 'yt') {
    return (
      'https://www.youtube.com/oembed?url=' +
      encodeURIComponent(normalizedUrl) +
      '&format=json'
    );
  }

  if (['nico', 'bili', 'tw'].includes(pl)) {
    return (
      'https://noembed.com/embed?url=' +
      encodeURIComponent(normalizedUrl)
    );
  }

  return null;
}

// Fetch oEmbed for a single URL and update all matching DOM spans in the detail panel

/**
 * Fetches and caches video metadata, then updates matching DOM elements.
 *
 * Shares in-flight work between callers. Retries network failures,
 * timeouts, HTTP 408, and HTTP 5xx up to three total attempts, with
 * one-second and two-second delays.
 *
 * HTTP 429 defers retries according to Retry-After, with a minimum
 * 30-second cooldown. Exhausted temporary failures also receive a
 * 30-second cooldown. A later call is required to start another cycle.
 *
 * Unsupported URLs, other HTTP errors, and malformed metadata remain
 * failed for the page lifetime. Cached successes are reused.
 *
 * @param {string} url Video URL whose metadata should be fetched.
 * @return {!Promise<void>} Resolves after shared work and its DOM update,
 *     or immediately when no request is needed. Request failures are
 *     represented by the failed cache state, not a rejected promise.
 */
export async function fetchOembed(url) {
  const pending = oembedInFlight.get(url);
  if (pending) return pending;

  const cached = oembedCache.get(url);

  if (cached && cached !== 'pending' && cached !== 'failed') {
    applyOembedToDOM(url);
    return;
  }

  if (
    cached === 'failed' &&
    Date.now() < (oembedRetryAt.get(url) || 0)
  ) {
    applyOembedToDOM(url);
    return;
  }

  const operation = (async () => {
    // Defer execution until the shared promise has been registered.
    await Promise.resolve();

    oembedCache.set(url, 'pending');

    // Default to terminal failure unless a temporary failure is detected.
    let retryAt = Infinity;

    try {
      const endpoint = oembedEndpoint(url);
      if (!endpoint) return;

      for (let attempt = 1; attempt <= 3; attempt++) {
        let response;

        try {
          response = await fetch(endpoint, {
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          retryAt = Date.now() + 30000;

          if (attempt === 3) return;

          await new Promise((resolve) => {
            setTimeout(resolve, attempt * 1000);
          });
          continue;
        }

        if (response.status === 429) {
          const header = response.headers.get('Retry-After');
          let delay = 30000;

          if (header !== null) {
            const value = header.trim();

            if (/^\d+$/.test(value)) {
              const milliseconds = Number(value) * 1000;

              if (Number.isFinite(milliseconds)) {
                delay = Math.max(delay, milliseconds);
              }
            } else {
              const date = Date.parse(value);

              if (Number.isFinite(date)) {
                delay = Math.max(delay, date - Date.now());
              }
            }
          }

          retryAt = Date.now() + delay;
          return;
        }

        if (!response.ok) {
          const temporary =
            response.status === 408 ||
            (response.status >= 500 && response.status <= 599);

          if (!temporary) {
            retryAt = Infinity;
            return;
          }

          retryAt = Date.now() + 30000;

          if (attempt === 3) return;

          await new Promise((resolve) => {
            setTimeout(resolve, attempt * 1000);
          });
          continue;
        }

        let data;

        try {
          data = await response.json();
        } catch (error) {
          // Invalid JSON is terminal; body-read/network failures may retry.
          if (error instanceof SyntaxError) {
            retryAt = Infinity;
            return;
          }

          retryAt = Date.now() + 30000;

          if (attempt === 3) return;

          await new Promise((resolve) => {
            setTimeout(resolve, attempt * 1000);
          });
          continue;
        }

        if (
          !data ||
          typeof data !== 'object' ||
          Array.isArray(data) ||
          data.error
        ) {
          retryAt = Infinity;
          return;
        }

        const meta = {
          title: typeof data.title === 'string' ? data.title : '',
          author:
            typeof data.author_name === 'string'
              ? data.author_name
              : '',
        };

        if (!meta.title.trim() && !meta.author.trim()) {
          retryAt = Infinity;
          return;
        }

        oembedCache.set(url, meta);
        oembedRetryAt.delete(url);
        return;
      }
    } catch {
      // Includes endpoint-construction failures.
      retryAt = Infinity;
    } finally {
      if (oembedCache.get(url) === 'pending') {
        oembedCache.set(url, 'failed');
        oembedRetryAt.set(url, retryAt);
      }
    }
  })();

  oembedInFlight.set(url, operation);

  try {
    await operation;
  } finally {
    oembedInFlight.delete(url);
    applyOembedToDOM(url);
  }
}

// Update the DOM spans for a specific URL after metadata arrives

/**
 * Applies cached metadata to matching video elements throughout the document.
 *
 * Matches video-title elements by exact data-url equality. Successful
 * metadata updates nonempty titles and associated author text using
 * textContent, then removes the title's loading class.
 *
 * Failed metadata only removes the loading class. Missing or pending
 * metadata leaves the DOM unchanged. Empty metadata fields preserve
 * existing displayed text.
 *
 * @param {string} url Exact cache key and data-url value to update.
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
 * Starts metadata retrieval for video URLs without awaiting completion.
 *
 * Applies completed cache entries immediately. Failed entries are passed
 * to fetchOembed(), which enforces retry eligibility and cooldowns.
 *
 * @param {!Array<{url: string}>} vids Videos whose metadata is needed.
 * @return {void}
 */
export function prefetchOembeds(vids) {
  vids.forEach((video) => {
    void fetchOembed(video.url).catch((error) => {
      console.warn('oEmbed metadata update failed:', error);
    });
  });
}

/**
 * Builds external video-link buttons for a Waza.
 *
 * Reads video0 through video9 in order and retains URLs permitted by
 * safeWebUrl(). Escapes URLs for HTML attributes and numbers the retained
 * links consecutively, using platform() for their labels and colors.
 *
 * Links open in a new tab with noopener and stop click propagation
 * through an inline event handler.
 *
 * @param {!Object} w Waza containing optional video0 through video9 fields.
 * @return {string} Video-button container HTML, or an empty string when
 *     no permitted video URLs remain.
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
 * Builds a like/dislike summary pill for a Waza card.
 *
 * Defaults missing or falsy counts to zero and highlights the user's
 * preference using LIKE_UP and LIKE_DOWN. Returns an empty string when
 * both counts are falsy and the preference is exactly null.
 *
 * Counts are inserted directly into HTML and must be trusted numbers.
 *
 * @param {!Object} w Waza containing numeric like_count and dislike_count.
 * @param {!Object} p Progress containing like: LIKE_UP, LIKE_DOWN, or null.
 * @return {string} Summary pill HTML, or an empty string when there are
 *     no counts and the user has no preference.
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
 * Builds a comparison key from a recognized video ID or serialized URL.
 *
 * Recognized YouTube, Bilibili, NicoNico, and Twitter/X video formats
 * use platform-prefixed IDs, ignoring timestamps and other URL components.
 * Extracted BV identifiers retain their original case.
 *
 * Other valid HTTP(S) URLs use a raw-prefixed serialized URL, preserving
 * path case, query parameters, and fragments. URL serialization may
 * normalize components; the original input is not preserved verbatim.
 *
 * Does not resolve redirects, convert between BV and AV identifiers,
 * or verify that different URLs identify the same video.
 *
 * @param {string} url Video URL to inspect.
 * @return {?string} Comparison key, or null for empty, invalid, or
 *     non-HTTP(S) input.
 */
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
        return 'bili:' + bvMatch[1];
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
 * Checks whether two URLs produce the same non-null video comparison key.
 *
 * Uses videoKey() for both inputs. Recognized video IDs ignore timestamp
 * differences; fallback URL keys preserve query parameters and fragments.
 * Returns false if either input produces a null key.
 *
 * Does not independently verify that the URLs identify the same video.
 *
 * @param {string} a First video URL.
 * @param {string} b Second video URL.
 * @return {boolean} Whether both URLs produce the same non-null key.
 */
export function sameVideo(a, b) {
  const ka = videoKey(a);
  return ka !== null && ka === videoKey(b);
}
