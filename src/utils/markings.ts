/**
 * markings.ts — Helpers for parsing and validating six-boolean progress
 * markings stored as JSON strings.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import { ValidationError } from '../validation';

/**
 * Parses stored progress markings into a safe six-boolean array.
 *
 * @remarks
 * The value must be a JSON string decoding to an array of exactly six
 * booleans. Any non-string input, invalid JSON, or invalid shape falls
 * back to `[false, false, false, false, false, false]`.
 *
 * @param value - Stored `progress.markings` database value.
 * @returns Exactly six boolean marking values.
 */
export const parseStoredMarkings = (value: unknown): boolean[] => {
  if (typeof value !== 'string') {
    return Array(6).fill(false);
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      Array.isArray(parsed) &&
      parsed.length === 6 &&
      parsed.every((marking) => typeof marking === 'boolean')
    ) {
      return parsed;
    }
  } catch {
    // Invalid stored JSON falls back to empty markings.
  }

  return Array(6).fill(false);
};

/**
 * Validates and normalizes a submitted markings JSON string.
 *
 * @remarks
 * The current frontend API contract submits markings as a serialized JSON
 * string. The decoded value must be an array of exactly six booleans; the
 * function returns the canonical re-serialized form. Non-string input is
 * rejected without attempting to parse it.
 *
 * @param value - Submitted markings value.
 * @returns Canonical serialized six-boolean markings array.
 * @throws ValidationError If the value is missing, not a string, not valid
 *   JSON, or not exactly six booleans.
 */
export const validateSubmittedMarkings = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new ValidationError('markings must be a JSON string containing exactly six booleans');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ValidationError('markings must be valid JSON');
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 6 ||
    !parsed.every((marking) => typeof marking === 'boolean')
  ) {
    throw new ValidationError('markings must contain exactly six booleans');
  }

  return JSON.stringify(parsed);
};
