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
export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
