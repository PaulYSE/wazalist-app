/**
 * @file lib/escape.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief HTML escaping utility to prevent XSS attacks.
 */

/**
 * @brief Escapes special HTML characters in a string.
 *
 * Converts &, <, >, and " to their HTML entity equivalents.
 *
 * @param {string} s - The input string to escape.
 * @return {string} Escaped HTML-safe string.
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
 * Validates an external web link.
 *
 * Returns the trimmed original URL when permitted, otherwise null.
 * Does not HTML-escape the result.
 */
export function safeWebUrl(value) {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  // Require an explicit HTTP(S) scheme and authority.
  if (!/^https?:\/\//i.test(raw)) return null;

  // Reject internal whitespace, control characters, and backslashes.
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
