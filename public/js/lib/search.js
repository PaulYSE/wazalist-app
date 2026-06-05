/* search.js — search-string normalization, fuzzy (Levenshtein) matching,
   and filterWaza() which produces the currently-visible list. */

import { state } from '../state/state.js';
import { getP } from '../services/progress.js';

// Fields to search within each waza for the search query
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

// Scoped-search prefixes: PREFIX:query restricts matching to these fields only.
// Add a new scoped filter by adding an entry here — nothing else changes.
const SEARCH_SCOPES = {
  author: ['author_jp0', 'author_en0', 'author_jp1', 'author_en1'],
  parent: ['parent_jp0', 'parent_en0', 'parent_jp1', 'parent_en1'],
  name: ['name_jp', 'name_en', 'name_en_literal', 'name_en_gtranslate', 'name_cn_gtranslate'],
  tag: ['tag'],
};

// ── Normalize user search entry ───────────────────────────────
export function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .normalize('NFD') // decompose accents (é → e + ́)
    .replace(/[\u0300-\u036f]/g, ''); // remove diacritical marks
}

// String Matching
function matchesExactField(text, query) {
  if (!text || !query) return false;
  return normalizeForSearch(text) === normalizeForSearch(query);
}

// ── Substring Matching ───────────────────────────────────────
function matchesQuery(text, query) {
  if (!text || !query) return false;

  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);

  // Level 1: Exact substring match (fast path)
  if (normalizedText.includes(normalizedQuery)) return true;

  // Level 2: All query words must appear somewhere in the text
  const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 0);
  if (queryWords.every((word) => normalizedText.includes(word))) return true;

  return false;
}

// ── Levenshtein distance implementation ───────────────────────────────────────
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
export function isFuzzyMatch(text, query, maxDistance = 2) {
  if (!text || !query) return false;

  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);

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

  // Check if query is a substring of text (within distance)
  for (let i = 0; i <= normalizedText.length - normalizedQuery.length + actualMaxDist; i++) {
    const substring = normalizedText.substring(
      Math.max(0, i - actualMaxDist),
      Math.min(normalizedText.length, i + normalizedQuery.length + actualMaxDist),
    );
    if (levenshteinDistance(substring, normalizedQuery) <= actualMaxDist) {
      return true;
    }
  }

  // Also check word-by-word for multi-word queries
  const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 1);
  if (queryWords.length > 1) {
    const textWords = normalizedText.split(' ');
    return queryWords.some((queryWord) =>
      textWords.some((textWord) => levenshteinDistance(textWord, queryWord) <= actualMaxDist),
    );
  }

  return false;
}

// ── Filter logic ─────────────────────────────────────────────
export const dispName = (w) =>
  w.name_en || w.name_en_literal || w.name_en_gtranslate || '(unnamed)';

// Parse a scoped search like AUTHOR:"PERIKAN" or PARENT:OUKA.
// Returns { fields, query, exact } or null if no recognized PREFIX: is present.
function parseScopedSearch(search) {
  const m = search.match(/^([a-z]+)\s*:\s*(.*)$/i);
  if (!m) return null;
  const scope = m[1].toLowerCase();
  const fields = SEARCH_SCOPES[scope];
  if (!fields) return null; // unknown prefix → treat as a normal search, not scoped

  let rest = m[2].trim();
  // Honour the same "quoted = exact" convention as the global search.
  const exact = rest.startsWith('"') && rest.endsWith('"') && rest.length >= 2;
  if (exact) rest = rest.slice(1, -1).trim();

  return { fields, query: rest, exact };
}

// Returns true if the waza matches the search string in any of the specified fields
export function wazaMatchesSearch(w, search) {
  if (!search) return true;

  // (Scoped search): PREFIX:QUERY = fuzzy, PREFIX:"QUERY" = exact
  const scoped = parseScopedSearch(search);
  if (scoped) {
    if (!scoped.query) return true; // "AUTHOR:" with nothing yet → don't filter
    const matchFn = scoped.exact ? matchesExactField : isFuzzyMatch;
    return scoped.fields.some((f) => w[f] && matchFn(w[f], scoped.query));
  }

  // (Global search): QUERY = fuzzy, "QUERY" = substring
  const isExact = search.startsWith('"') && search.endsWith('"');
  const matchFn = isExact ? matchesQuery : isFuzzyMatch;
  const query = isExact ? search.slice(1, -1).trim() : search;
  return SEARCH_FIELDS.some((f) => w[f] && matchFn(w[f], query));
}

export function filterWaza() {
  const { search, markings } = state.filters;
  const anyMarkingActive = markings.some(Boolean);
  let results = state.wazaData.filter((w) => {
    // "Any" mode: only show waza that have at least one marking
    if (state.browseFilterAny) {
      const p = getP(w.id);
      if (!(p.markings && p.markings.some(Boolean))) return false;
    }
    if (!wazaMatchesSearch(w, search)) return false;
    if (anyMarkingActive) {
      const p = getP(w.id);
      const ws = p.markings || Array(6).fill(false);
      if (!markings.every((on, i) => !on || ws[i])) return false;
    }
    return true;
  });
  // Sort
  if (state.browseSortField !== 'default') {
    results.sort((a, b) => {
      let cmp;
      if (state.browseSortField === 'likes') {
        // Sort by total like count (aggregate from all users)
        const la = a.like_count || 0;
        const lb = b.like_count || 0;
        cmp = la - lb; // ascending: least likes first (1, 2, 3...)
      } else {
        const na = (a.name_jp || dispName(a) || '').toLowerCase();
        const nb = (b.name_jp || dispName(b) || '').toLowerCase();
        cmp = na.localeCompare(nb, 'ja');
      }
      return state.browseSortOrder === 'desc' ? -cmp : cmp;
    });
  }
  return results;
}
