/**
 * @file theme.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-12
 * @brief Theme management. Resolves and applies the active theme (system/light/dark/slate),
 *        persists the choice to localStorage, and tracks OS preference changes when on 'system'.
 */

const LS_THEME = 'wl_theme';

// The user-selectable choices. 'system' is a meta-choice that resolves to
// 'light' or 'dark' based on the OS preference.
export const THEMES = ['system', 'light', 'dark', 'slate'];

// 'system' resolves to one of these via prefers-color-scheme.
const SYSTEM_DARK = 'dark'; // OS dark  → AMOLED dark
const SYSTEM_LIGHT = 'light'; // OS light → light

/**
 * @brief Returns the stored theme choice, or 'system' if none/invalid.
 *
 * @return {string} One of THEMES.
 */
export function getTheme() {
  const v = localStorage.getItem(LS_THEME);
  return THEMES.includes(v) ? v : 'system';
}

/**
 * @brief Resolves a choice to a concrete theme name (collapses 'system').
 *
 * @param {string} choice - A value from THEMES.
 * @return {string} A concrete theme: 'light' | 'dark' | 'slate'.
 */
function resolve(choice) {
  if (choice === 'system') {
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? SYSTEM_DARK : SYSTEM_LIGHT;
  }
  return choice;
}

/**
 * @brief Applies the given choice to the document (sets data-theme).
 *        Does NOT persist — use setTheme for that.
 *
 * @param {string} choice - A value from THEMES.
 * @return {void}
 */
export function applyTheme(choice) {
  document.documentElement.dataset.theme = resolve(choice);
  window.dispatchEvent(new Event('themechange'));
}

/**
 * @brief Sets, persists, and applies the theme choice.
 *
 * @param {string} choice - A value from THEMES.
 * @return {void}
 */
export function setTheme(choice) {
  if (!THEMES.includes(choice)) choice = 'system';
  localStorage.setItem(LS_THEME, choice);
  applyTheme(choice);
}

/**
 * @brief Initializes theming: applies the stored choice and, while on 'system',
 *        re-applies live when the OS light/dark preference changes.
 *
 * @return {void}
 */
export function initTheme() {
  applyTheme(getTheme());

  // Track OS preference changes — only matters while the choice is 'system'.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getTheme() === 'system') applyTheme('system');
    };
    // addEventListener is the modern API; older Safari used addListener.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
}
