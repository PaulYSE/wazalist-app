/**
 * @file lib/escape.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief HTML escaping utility to prevent XSS attacks.
 */

/**
 * Escapes a value for insertion as HTML text or a quoted attribute value.
 *
 * Converts null and undefined to an empty string and converts other
 * values to strings. Escapes ampersands, angle brackets, double quotes,
 * and apostrophes.
 *
 * Does not validate URLs or sanitize HTML markup. Do not use this
 * function as an encoder for JavaScript, CSS, or unquoted attributes.
 * Existing HTML entities are escaped again.
 *
 * @param {*} value Value to convert to a string and escape.
 * @return {string} String with special HTML characters escaped.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates a URL against the application's HTTP(S) link policy.
 *
 * Requires a string with an explicit HTTP(S) scheme, a parseable URL,
 * a hostname, and no parsed username or password. After trimming,
 * rejects ASCII spaces, C0 control characters, DEL, and backslashes.
 *
 * Returns the trimmed input without URL normalization or HTML escaping.
 * Does not restrict hosts, require a different origin, or verify the
 * destination's availability or trustworthiness.
 *
 * @param {*} value URL candidate to validate.
 * @return {?string} Trimmed original URL when permitted, or null when
 *     the input is invalid or URL parsing fails.
 */
export function safeWebUrl(value) {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  // Require an explicit HTTP(S) scheme and authority.
  if (!/^https?:\/\//i.test(raw)) return null;

  // Reject ASCII spaces, C0 controls, DEL, and backslashes.
  // eslint-disable-next-line no-control-regex -- intentional: blocks C0/DEL
  if (/[\u0000-\u0020\u007f\\]/.test(raw)) return null;

  try {
    const parsed = new URL(raw);

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }

    // Preserve the original form for metadata/cache matching.
    return raw;
  } catch {
    return null;
  }
}
