/**
 * @file lib/search.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-28
 * @brief Search string normalization, fuzzy (Levenshtein) matching, scoped search prefixes, and filterWaza() for producing the currently-visible list.
 */

import { state } from '../state/state.js';
import { getP } from '../services/progress.js';
import {
  getBrowseMarkingFilters,
  getBrowseSearchString,
  getBrowseSortField,
  getBrowseSortOrder,
  isAnyMarkingFilterActive,
  isBrowseFilterAny,
} from '../state/waza-browse-state.js';

// ── Constants ─────────────────────────────────────────────────

/** @type {string[]} Fields to search within each waza for the search query. */
const SEARCH_FIELDS = [
  'name_jp',
  'name_en',
  'name_en_literal',
  'name_en_gtranslate',
  'name_cn_gtranslate',
  'reference',
  'tag',
  'parent_jp0',
  'parent_en0',
  'parent_jp1',
  'parent_en1',
  'author_jp0',
  'author_en0',
  'author_jp1',
  'author_en1',
];

/**
 * @brief Scoped-search prefixes: PREFIX:query restricts matching to these fields only.
 *
 * Add a new scoped filter by adding an entry here — nothing else changes.
 *
 * @type {Object<string, string[]>}
 */
const SEARCH_SCOPES = {
  author: ['author_jp0', 'author_en0', 'author_jp1', 'author_en1'],
  parent: ['parent_jp0', 'parent_en0', 'parent_jp1', 'parent_en1'],
  name: ['name_jp', 'name_en', 'name_en_literal', 'name_en_gtranslate', 'name_cn_gtranslate'],
  tag: ['tag'],
};

/**
 * @brief Unicode "smart quote" and fullwidth quote variants mapped to the
 *        plain ASCII double quote (").
 *
 * Mobile keyboards frequently substitute the straight ASCII quote for one
 * of these when autocorrect/smart-punctuation is on — iOS and Android both
 * do this by default on English keyboards (producing U+201C/U+201D), and
 * Japanese/Chinese IME keyboards commonly produce the fullwidth form
 * (U+FF02) instead. Since the exact-match feature only recognizes a literal
 * ASCII '"' at the start/end of a query, any of these substitutions would
 * silently fall through to fuzzy search instead of triggering exact match.
 *
 * @type {Object<string, string>}
 */
const SMART_QUOTE_MAP = {
  '\u201C': '"', // “ LEFT DOUBLE QUOTATION MARK
  '\u201D': '"', // ” RIGHT DOUBLE QUOTATION MARK
  '\u201E': '"', // „ DOUBLE LOW-9 QUOTATION MARK
  '\u201F': '"', // ‟ DOUBLE HIGH-REVERSED-9 QUOTATION MARK
  '\uFF02': '"', // ＂ FULLWIDTH QUOTATION MARK (common from JP/CN IME input)
};

/**
 * Replaces recognized Unicode double-quote variants with ASCII double quotes.
 *
 * Normalizes U+201C, U+201D, U+201E, U+201F, and U+FF02.
 * Leaves all other characters unchanged.
 *
 * @param {string} text Search input to normalize.
 * @return {string} Text with recognized quote variants replaced.
 */
function normalizeQuotes(text) {
  return text.replace(/[\u201C\u201D\u201E\u201F\uFF02]/g, (ch) => SMART_QUOTE_MAP[ch]);
}

// ── Normalize user search entry ───────────────────────────────

/**
 * Normalizes text for case-insensitive search and selected accent removal.
 *
 * Converts text to lowercase, trims surrounding whitespace, collapses
 * internal whitespace to single spaces, applies Unicode NFD decomposition,
 * and removes combining marks in U+0300–U+036F.
 *
 * @param {string} text Text to normalize.
 * @return {string} Normalized search text.
 */
export function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .normalize('NFD') // decompose accents (é → e + ́)
    .replace(/[\u0300-\u036f]/g, ''); // remove diacritical marks
}

// ── Exact Matching ────────────────────────────────────────────

/**
 * Checks whether text and query are equal after search normalization.
 *
 * Returns false if either input is empty or becomes empty after
 * normalization. Uses normalizeForSearch() for both inputs.
 *
 * @param {string} text Text to match.
 * @param {string} query Query to compare against the complete text.
 * @return {boolean} Whether both normalized values are nonempty and equal.
 */
function matchesExactField(text, query) {
  if (!text || !query) return false;

  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);

  if (!normalizedText || !normalizedQuery) return false;

  return normalizedText === normalizedQuery;
}

// ── Substring Matching ───────────────────────────────────────

/**
 * @brief Checks if query is a substring of text or all query words appear.
 *
 * @param {string} text - Text to search.
 * @param {string} query - Query string.
 * @return {boolean} True if substring or all words present.
 */
function matchesQuery(text, query) {
  if (!text || !query) return false;

  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);
  
  if (!normalizedText || !normalizedQuery) return false;

  // Level 1: Exact substring match (fast path)
  if (normalizedText.includes(normalizedQuery)) return true;

  // Level 2: All query words must appear somewhere in the text
  const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 0);
  if (queryWords.every((word) => normalizedText.includes(word))) return true;

  return false;
}

// ── Levenshtein distance implementation ──────────────────────

/**
 * @brief Calculates Levenshtein edit distance between two strings.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @return {number} Edit distance.
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ── Fuzzy String Matching ───

/**
 * @brief Determines if text fuzzy matches query within a distance threshold.
 *
 * @param {string} text - Text to match.
 * @param {string} query - Query string.
 * @param {number} maxDistance - Maximum allowed edit distance (default: 2).
 * @return {boolean} True if fuzzy match within threshold.
 */
export function isFuzzyMatch(text, query, maxDistance = 2) {
  if (!text || !query) return false;

  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);

  if (!normalizedText || !normalizedQuery) return false;

  // For general search (maxDistance = 2), use adaptive scaling for longer queries
  // For strict matching (maxDistance = 1), use exactly the specified distance
  let actualMaxDist;
  if (maxDistance === 1) {
    // Strict mode: use exactly 1 for Excel import
    actualMaxDist = 1;
  } else {
    // Flexible mode: for longer queries, allow more errors
    const adaptiveMaxDist = Math.max(1, Math.floor(normalizedQuery.length / 4));
    actualMaxDist = Math.min(maxDistance, adaptiveMaxDist);
  }

// Accept exact substrings without calculating edit distance.
if (normalizedText.includes(normalizedQuery)) return true;

// Insertions and deletions can change the matching substring's length.
// Examine every candidate length within the permitted distance.
const minLength = Math.max(
  0,
  normalizedQuery.length - actualMaxDist,
);
const maxLength = normalizedQuery.length + actualMaxDist;

for (
  let start = 0;
  start <= normalizedText.length - minLength;
  start++
) {
  const availableMaxLength = Math.min(
    maxLength,
    normalizedText.length - start,
  );

  for (
    let length = minLength;
    length <= availableMaxLength;
    length++
  ) {
    const candidate = normalizedText.slice(start, start + length);

    if (
      levenshteinDistance(candidate, normalizedQuery) <= actualMaxDist
    ) {
      return true;
    }
  }
}

// Require every significant query word to match a word in this field.
const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 1);

if (queryWords.length > 1) {
  const textWords = normalizedText.split(' ');

  return queryWords.every((queryWord) =>
    textWords.some(
      (textWord) =>
        levenshteinDistance(textWord, queryWord) <= actualMaxDist,
    ),
  );
}

  return false;
}

// ── Filter logic ─────────────────────────────────────────────

/**
 * @brief Returns the best available English name for a waza.
 *
 * @param {Object} w - Waza object.
 * @return {string} Display name.
 */
export const dispName = (w) =>
  w.name_en || w.name_en_literal || w.name_en_gtranslate || '(unnamed)';

// Parse a scoped search like AUTHOR:"PERIKAN" or PARENT:OUKA.
// Returns { fields, query, exact } or null if no recognized PREFIX: is present.

/**
 * @brief Parses a scoped search prefix like 'author:perikan' or 'parent:"ouka"'.
 *
 * @param {string} search - Search string.
 * @return {Object|null} Object with fields, query, and exact flag, or null.
 */
function parseScopedSearch(search) {
  const m = search.match(/^([a-z]+)\s*:\s*(.*)$/i);
  if (!m) return null;

  const scope = m[1].toLowerCase();

  // Only explicitly configured scopes are recognized.
  if (!Object.prototype.hasOwnProperty.call(SEARCH_SCOPES, scope)) {
    return null;
  }

  const fields = SEARCH_SCOPES[scope];

  let rest = m[2].trim();
  const exact =
    rest.startsWith('"') &&
    rest.endsWith('"') &&
    rest.length >= 2;

  if (exact) rest = rest.slice(1, -1).trim();

  return { fields, query: rest, exact };
}

// Returns true if the waza matches the search string in any of the specified fields

/**
 * @brief Determines if a waza matches the search string.
 *
 * Supports scoped search (author:, parent:, name:, tag:) and global fuzzy search.
 *
 * @param {Object} w - Waza object.
 * @param {string} search - Search query.
 * @return {boolean} True if waza matches.
 */
export function wazaMatchesSearch(w, search) {
  if (!search) return true;

  // Normalize quote variants and ignore outer whitespace before parsing.
  search = normalizeQuotes(search).trim();

  if (!normalizeForSearch(search)) return true;

  // Scoped quoted queries use normalized whole-field equality.
  const scoped = parseScopedSearch(search);

  if (scoped) {
    if (!normalizeForSearch(scoped.query)) return true;

    const matchFn = scoped.exact ? matchesExactField : isFuzzyMatch;

    return scoped.fields.some(
      (field) => w[field] && matchFn(w[field], scoped.query),
    );
  }

  // Global quoted queries use non-fuzzy substring/all-word matching.
  const isQuoted =
    search.length >= 2 &&
    search.startsWith('"') &&
    search.endsWith('"');

  const query = isQuoted ? search.slice(1, -1).trim() : search;

  if (!normalizeForSearch(query)) return true;

  const matchFn = isQuoted ? matchesQuery : isFuzzyMatch;

  return SEARCH_FIELDS.some(
    (field) => w[field] && matchFn(w[field], query),
  );
}

/**
 * @brief Filters and sorts the waza list based on current state filters.
 *
 * Applies search, marking filters, browseFilterAny mode, and sort preferences.
 *
 * @return {Array} Filtered and sorted array of waza objects.
 */
export function filterWaza() {
  const search = getBrowseSearchString();
  const markings = getBrowseMarkingFilters();
  let results = state.wazaData.filter((w) => {
    // "Any" mode: only show waza that have at least one marking
    if (isBrowseFilterAny()) {
      const p = getP(w.id);
      if (!(p.markings && p.markings.some(Boolean))) return false;
    }
    if (!wazaMatchesSearch(w, search)) return false;
    if (isAnyMarkingFilterActive()) {
      const p = getP(w.id);
      const ws = p.markings || Array(6).fill(false);
      if (!markings.every((on, i) => !on || ws[i])) return false;
    }
    return true;
  });
  // Sort
  if (getBrowseSortField() !== 'default') {
    results.sort((a, b) => {
      let cmp;
      if (getBrowseSortField() === 'likes') {
        // Sort by total like count (aggregate from all users)
        const la = a.like_count || 0;
        const lb = b.like_count || 0;
        cmp = la - lb; // ascending: least likes first (1, 2, 3...)
      } else {
        const na = (a.name_jp || dispName(a) || '').toLowerCase();
        const nb = (b.name_jp || dispName(b) || '').toLowerCase();
        cmp = na.localeCompare(nb, 'ja');
      }
      return getBrowseSortOrder() === 'desc' ? -cmp : cmp;
    });
  }
  return results;
}
