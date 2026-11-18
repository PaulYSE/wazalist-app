/**
 * labels.ts — Helpers for parsing stored marking labels.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Default label set: six empty strings.
 *
 * @remarks
 * Returned (as a fresh copy) by `parseStoredLabels` whenever the stored
 * value is missing or malformed.
 */
export const EMPTY_LABELS = ['', '', '', '', '', ''];

/**
 * Parses stored marking labels into a safe six-string array.
 *
 * @remarks
 * The value must be a JSON string decoding to an array of exactly six
 * strings. Any non-string input, invalid JSON, or invalid shape falls back
 * to a fresh copy of `EMPTY_LABELS`.
 *
 * @param value - Stored `shape_labels` database value.
 * @returns Exactly six marking-label strings.
 */
export const parseStoredLabels = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [...EMPTY_LABELS];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      Array.isArray(parsed) &&
      parsed.length === 6 &&
      parsed.every((label) => typeof label === 'string')
    ) {
      return parsed;
    }
  } catch {
    // Invalid stored JSON falls back to the default labels.
  }

  return [...EMPTY_LABELS];
};
