/**
 * @file parser.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Text import engine for parsing waza lists with status detection, label extraction, tab-separated column detection, and fuzzy matching. No DOM manipulation.
 */

import { state, tiState } from '../state/state.js';
import { normalizeForSearch, isFuzzyMatch } from '../lib/search.js';
import { STATUS_TO_SHAPE_MAP, HEADER_KEYWORDS, DECORATIVE_PATTERNS } from '../config/constants.js';

// Fuzzy status matching - find closest known status label

/**
 * @brief Fuzzy matches a status text to a marking index.
 *
 * @param {string} text - Status text to match.
 * @return {number|null} Marking index (0-5) or null if no match.
 */
function fuzzyMatchStatus(text) {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();

  // Exact match first
  if (STATUS_TO_SHAPE_MAP[normalized] !== undefined) {
    return STATUS_TO_SHAPE_MAP[normalized];
  }

  // Fuzzy match - check if status text contains any known keywords
  for (const [key, value] of Object.entries(STATUS_TO_SHAPE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Check for partial word matches
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (STATUS_TO_SHAPE_MAP[word] !== undefined) {
      return STATUS_TO_SHAPE_MAP[word];
    }
  }

  return null;
}

// Enhanced multi-column detection with better heuristics

/**
 * @brief Detects column layout for tab-separated lines.
 *
 * @param {string[]} lines - Array of text lines.
 * @return {string|null} Layout type: 'WAZA_STATUS', 'STATUS_WAZA', or null.
 */
function detectColumnLayout(lines) {
  const tabLines = lines.filter((l) => l.includes('\t'));
  if (tabLines.length === 0) return null;

  // Sample first few tab-separated lines to detect pattern
  const samples = tabLines.slice(0, Math.min(10, tabLines.length));
  let wazaFirstCount = 0;
  let statusFirstCount = 0;

  samples.forEach((line) => {
    const parts = line
      .split('\t')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return;

    const firstHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[0]);
    const firstHasParens = parts[0].includes('(');
    const secondHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[1]);
    const secondHasParens = parts[1].includes('(');

    // Check if first column looks like a status
    const firstIsStatus = fuzzyMatchStatus(parts[0]) !== null;
    const secondIsStatus = fuzzyMatchStatus(parts[1]) !== null;

    // Heuristic: waza names have Japanese + parentheses, statuses don't
    if (
      (firstHasParens && firstHasJapanese) ||
      (firstIsStatus === false && secondIsStatus === true)
    ) {
      wazaFirstCount++;
    }
    if (
      (secondHasParens && secondHasJapanese) ||
      (secondIsStatus === false && firstIsStatus === true)
    ) {
      statusFirstCount++;
    }
  });

  // Return most common pattern
  if (wazaFirstCount > statusFirstCount) {
    return 'WAZA_STATUS'; // Column A = Waza, Column B = Status
  } else if (statusFirstCount > wazaFirstCount) {
    return 'STATUS_WAZA'; // Column A = Status, Column B = Waza
  }

  return 'WAZA_STATUS'; // Default assumption
}

// Category detection and preservation

/**
 * @brief Detects if a line is a category header.
 *
 * @param {string} line - Text line.
 * @return {string|null} Category name or null.
 */
function detectCategory(line) {
  const lower = line.toLowerCase();

  // Common category patterns
  const categoryPatterns = [
    { pattern: /fundamental|basic|beginner/i, category: 'Fundamental' },
    { pattern: /advanced|expert|master/i, category: 'Advanced' },
    { pattern: /intermediate/i, category: 'Intermediate' },
    { pattern: /optional|niche/i, category: 'Optional' },
    { pattern: /favourite|favorite|custom|original|own/i, category: 'Favourite' },
  ];

  for (const { pattern, category } of categoryPatterns) {
    if (pattern.test(lower)) {
      return category;
    }
  }

  return null; // Not a category header
}

// Check if line is a header/instruction row (should be skipped)

/**
 * @brief Determines if a line is a header/instruction row to skip.
 *
 * @param {string} line - Text line.
 * @return {boolean} True if line is a header.
 */
function isHeaderLine(line) {
  const lower = line.toLowerCase();
  return HEADER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// Strip decorative markers and return cleaned text + detected favorite flag

/**
 * @brief Strips decorative markers from text and detects if it's a favorite.
 *
 * @param {string} text - Input text.
 * @return {Object} Object with cleaned text and isFavorite flag.
 */
function stripDecorations(text) {
  let cleaned = text;
  let isFavorite = false;

  // Check for star decoration before stripping
  if (text.includes('˗ˏˋ ★ ˎˊ˗') || text.includes('★')) {
    isFavorite = true;
  }

  // Strip all decorative patterns
  DECORATIVE_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });

  return { cleaned: cleaned.trim(), isFavorite };
}

// Extract waza name from Excel hyperlink formula

/**
 * @brief Extracts waza name from Excel HYPERLINK formula.
 *
 * @param {string} text - Text possibly containing hyperlink formula.
 * @return {string|null} Extracted name or null.
 */
function extractFromHyperlink(text) {
  // Pattern: =HYPERLINK("URL", "Waza Name")
  const match = text.match(/=HYPERLINK\s*\(\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)/i);
  return match ? match[1] : null;
}

// Parse "English (Japanese)" format and extract both parts

/**
 * @brief Parses "English (Japanese)" format into separate components.
 *
 * @param {string} text - Input text.
 * @return {Object} Object with english, japanese, and original fields.
 */
function parseWazaName(text) {
  // Try to extract from "English (Japanese)" format
  const match = text.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
  if (match) {
    const english = match[1].trim();
    const japanese = match[2].trim();
    return { english, japanese, original: text };
  }
  return { english: text, japanese: '', original: text };
}

// Detect tab-separated format and parse status + waza (Phase 2: enhanced)

/**
 * @brief Parses a tab-separated line into waza name and status.
 *
 * @param {string} line - Tab-separated line.
 * @param {string|null} columnLayout - Detected layout ('WAZA_STATUS' or 'STATUS_WAZA').
 * @return {Object|null} Object with waza and status fields, or null.
 */
function parseTabSeparated(line, columnLayout = null) {
  if (!line.includes('\t')) return null;

  const parts = line
    .split('\t')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  // Phase 2: Use detected layout if available
  if (columnLayout === 'STATUS_WAZA') {
    return { waza: parts[1], status: parts[0] || null };
  } else if (columnLayout === 'WAZA_STATUS') {
    return { waza: parts[0], status: parts[1] || null };
  }

  // Auto-detect if no layout provided
  const firstHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[0]);
  const secondHasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(parts[1]);

  // Phase 2: Use fuzzy status detection
  const firstIsStatus = fuzzyMatchStatus(parts[0]) !== null;
  const secondIsStatus = fuzzyMatchStatus(parts[1]) !== null;

  if (parts[0].includes('(') && firstHasJapanese) {
    // Column A = Waza, Column B = Status
    return { waza: parts[0], status: parts[1] || null };
  } else if (parts[1].includes('(') && secondHasJapanese) {
    // Column A = Status, Column B = Waza
    return { waza: parts[1], status: parts[0] || null };
  } else if (firstIsStatus && !secondIsStatus) {
    return { waza: parts[1], status: parts[0] };
  } else if (secondIsStatus && !firstIsStatus) {
    return { waza: parts[0], status: parts[1] };
  } else {
    // Ambiguous - assume first is waza
    return { waza: parts[0], status: parts[1] || null };
  }
}

// Map status text to marking index (0-5) - Phase 2: with fuzzy matching

/**
 * @brief Maps status text to marking index using fuzzy matching.
 *
 * @param {string} statusText - Status text.
 * @return {number|null} Marking index (0-5) or null.
 */
function mapStatusToMarking(statusText) {
  if (!statusText) return null;
  return fuzzyMatchStatus(statusText); // Use Phase 2 fuzzy matcher
}

// Matches any [...], {...} encapsulation on a line
// Returns array of matched state.token strings (with brackets), e.g. ["[Learning]", "{WIP}"]
// Note: () are reserved for "English(Japanese)" naming convention

/**
 * @brief Extracts bracket-encapsulated labels from a line.
 *
 * @param {string} line - Text line.
 * @return {string[]} Array of matched label strings including brackets.
 */
function extractEncapsulations(line) {
  const matches = [];
  const re = /\[([^[\]]+)\]|\{([^{}]+)\}/g;
  let m;
  while ((m = re.exec(line)) !== null) matches.push(m[0]);
  return matches;
}

// Strip ALL encapsulated state.tokens from a line to get the bare waza name
// Note: () are NOT stripped - they're part of the "English(Japanese)" format

/**
 * @brief Removes all bracket-encapsulated labels from a line.
 *
 * @param {string} line - Text line.
 * @return {string} Cleaned line without labels.
 */
function stripAllLabels(line) {
  return line
    .replace(/\[([^[\]]+)\]|\{([^{}]+)\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Detect which known label(s) appear on this line; returns first match or null

/**
 * @brief Detects the first known label on a line.
 *
 * @param {string} line - Text line.
 * @return {string|null} Matched label (with brackets) or null.
 */
function detectLabelOnLine(line) {
  const tokens = extractEncapsulations(line);
  for (const tok of tokens) {
    if (tiState.foundLabels.includes(tok)) return tok;
  }
  return null;
}

// Collect all unique labels across the entire text

/**
 * @brief Collects all unique bracket-encapsulated labels from raw text.
 *
 * @param {string} rawText - Raw import text.
 * @return {string[]} Ordered array of unique labels.
 */
function collectLabels(rawText) {
  const seen = new Set();
  const ordered = [];
  rawText.split('\n').forEach((line) => {
    extractEncapsulations(line.trim()).forEach((tok) => {
      const key = tok.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(tok);
      }
    });
  });
  return ordered;
}

/**
 * @brief Finds a waza object matching a line of text.
 *
 * Uses hyperlink extraction, Japanese/English name parsing, exact matches,
 * and fuzzy matching with distance threshold of 2.
 *
 * @param {string} line - Text line to match.
 * @return {Object|null} Matching waza object or null.
 */
function findWazaForLine(line) {
  // Phase 1: Try hyperlink extraction first
  const hyperlinkMatch = extractFromHyperlink(line);
  if (hyperlinkMatch) {
    line = hyperlinkMatch;
  }

  // Phase 1: Strip decorations (but we'll check for favorites later)
  const { cleaned: decorationStripped } = stripDecorations(line);
  line = decorationStripped;

  const cleaned = stripAllLabels(line);
  if (!cleaned) return null;

  // Phase 1: Parse "English (Japanese)" format
  const { english, japanese } = parseWazaName(cleaned);

  // Try matching with both English and Japanese parts
  const norm = normalizeForSearch(cleaned);
  const normEnglish = normalizeForSearch(english);
  const normJapanese = normalizeForSearch(japanese);

  // Exact match - prioritize Japanese, then English, then full text
  let hit;

  // 1. Try exact Japanese match
  if (japanese) {
    hit = state.wazaData.find((w) => normalizeForSearch(w.name_jp || '') === normJapanese);
    if (hit) return hit;
  }

  // 2. Try exact English match
  hit = state.wazaData.find(
    (w) =>
      normalizeForSearch(w.name_en || '') === normEnglish ||
      normalizeForSearch(w.name_en_literal || '') === normEnglish ||
      normalizeForSearch(w.name_en_gtranslate || '') === normEnglish,
  );
  if (hit) return hit;

  // 3. Try exact match on full cleaned text (fallback)
  hit = state.wazaData.find(
    (w) =>
      normalizeForSearch(w.name_jp || '') === norm ||
      normalizeForSearch(w.name_en || '') === norm ||
      normalizeForSearch(w.name_en_literal || '') === norm,
  );
  if (hit) return hit;

  // Fuzzy match - try Japanese first, then English
  if (japanese) {
    hit = state.wazaData.find((w) => isFuzzyMatch(w.name_jp, japanese, 1));
    if (hit) return hit;
  }

  hit = state.wazaData.find(
    (w) =>
      isFuzzyMatch(w.name_en, english, 1) ||
      isFuzzyMatch(w.name_en_literal, english, 1) ||
      isFuzzyMatch(w.name_en_gtranslate, english, 1),
  );
  if (hit) return hit;

  // Final fallback: fuzzy on full text
  hit = state.wazaData.find(
    (w) =>
      isFuzzyMatch(w.name_jp, cleaned, 1) ||
      isFuzzyMatch(w.name_en, cleaned, 1) ||
      isFuzzyMatch(w.name_en_literal, cleaned, 1),
  );
  return hit || null;
}

/**
 * @brief Main entry point for parsing imported text into matched waza.
 *
 * Collects labels, builds auto-mapping, detects column layout, processes lines,
 * and populates tiState with matched and unmatched items.
 *
 * @param {string} rawText - Raw import text.
 * @return {void}
 */
export function parseTextImport(rawText) {
  // 1. Collect all unique labels in document order
  tiState.foundLabels = collectLabels(rawText);

  // 2. Seed tiState.autoMapping for new labels (preserve existing assignments)
  tiState.foundLabels.forEach((lbl, i) => {
    if (tiState.autoMapping[lbl] === undefined) {
      // Phase 1: Try to map known status labels automatically
      const statusMarking = mapStatusToMarking(lbl.slice(1, -1)); // Remove brackets
      tiState.autoMapping[lbl] = statusMarking !== null ? statusMarking : i < 6 ? i : -1;
    }
  });

  // 3. Seed tiState.labelNames for new labels (default = inner text without brackets)
  tiState.foundLabels.forEach((lbl) => {
    if (tiState.labelNames[lbl] === undefined) {
      tiState.labelNames[lbl] = lbl.slice(1, -1); // strip outer bracket pair
    }
  });

  // 4. Parse lines
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Phase 2: Detect column layout for tab-separated format
  const columnLayout = detectColumnLayout(lines);

  let currentLabel = null;
  let currentCategory = null; // Phase 2: Track category context
  tiState.matched = [];
  tiState.unmatched = [];

  lines.forEach((line) => {
    // Phase 1: Skip header lines
    if (isHeaderLine(line)) {
      return;
    }

    // Phase 2: Check if line is a category header
    const detectedCategory = detectCategory(line);
    if (detectedCategory) {
      currentCategory = detectedCategory;
      return; // Skip category header line itself
    }

    // Phase 1: Handle tab-separated format
    const tabParsed = parseTabSeparated(line, columnLayout); // Phase 2: Pass detected layout
    let lineToProcess = line;
    let detectedStatus = null;

    if (tabParsed) {
      lineToProcess = tabParsed.waza;
      detectedStatus = tabParsed.status;
    }

    // Phase 1: Check for decorative markers (favorites)
    const { isFavorite } = stripDecorations(lineToProcess);

    const stripped = stripAllLabels(lineToProcess);
    const lineLabel = detectLabelOnLine(lineToProcess);

    if (!stripped) {
      // Pure label header line — update running context
      if (lineLabel) currentLabel = lineLabel;
      return;
    }

    // Effective label: inline takes priority over running context
    let effectiveLabel = lineLabel || currentLabel;

    // Phase 2: Use category as label if no other label present
    if (!effectiveLabel && currentCategory) {
      effectiveLabel = `[${currentCategory}]`; // Wrap in brackets to match label format
    }

    const waza = findWazaForLine(lineToProcess);
    if (waza) {
      const matchedItem = {
        waza,
        rawLine: line,
        category: effectiveLabel,
        manualMarkings: Array(6).fill(false),
      };

      // Phase 1: Auto-assign markings from status or decorations
      if (detectedStatus) {
        const markingIdx = mapStatusToMarking(detectedStatus);
        if (markingIdx !== null) {
          matchedItem.manualMarkings[markingIdx] = true;
        }
      } else if (isFavorite) {
        // Auto-assign Favourite marking for decorated waza
        matchedItem.manualMarkings[3] = true; // Marking 4 (index 3)
      }

      tiState.matched.push(matchedItem);
    } else {
      tiState.unmatched.push(line);
    }
  });
  tiState.parsed = true;
}
