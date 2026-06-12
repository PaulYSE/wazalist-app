/**
 * @file theme.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-12
 * @brief Theme management. Mode is 'system' or 'explicit'. In system mode the
 *        active theme is the user's chosen light/dark theme, picked by OS
 *        prefers-color-scheme. Picking a specific theme sets explicit mode and
 *        updates the matching light/dark slot. Persisted to localStorage.
 */

const LS_MODE = 'wl_theme_mode'; // 'system' | 'explicit'
const LS_LIGHT = 'wl_theme_light'; // chosen light theme
const LS_DARK = 'wl_theme_dark'; // chosen dark theme

import { LIGHT_THEMES, DARK_THEMES, ALL_THEMES } from '../config/theme-registry.js';

const DEFAULT_LIGHT = 'light';
const DEFAULT_DARK = 'dark';

/** @return {boolean} */
function osPrefersDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/** @return {string} 'system' | 'explicit' */
export function getThemeMode() {
  return localStorage.getItem(LS_MODE) === 'explicit' ? 'explicit' : 'system';
}

/** @return {string} the chosen light theme */
export function getThemeLightChoice() {
  const v = localStorage.getItem(LS_LIGHT);
  return LIGHT_THEMES.includes(v) ? v : DEFAULT_LIGHT;
}

/** @return {string} the chosen dark theme */
export function getThemeDarkChoice() {
  const v = localStorage.getItem(LS_DARK);
  return DARK_THEMES.includes(v) ? v : DEFAULT_DARK;
}

/**
 * @brief Resolve the active concrete theme from current mode + slots + OS.
 * @return {string} a concrete theme name.
 */
export function getActiveTheme() {
  if (getThemeMode() === 'explicit') {
    const v = localStorage.getItem('wl_theme_active');
    return ALL_THEMES.includes(v) ? v : getThemeDarkChoice();
  }
  return osPrefersDark() ? getThemeDarkChoice() : getThemeLightChoice();
}

/** @brief Apply the resolved theme to the document + notify. */
export function applyTheme() {
  document.documentElement.dataset.theme = getActiveTheme();
  window.dispatchEvent(new Event('themechange'));
}

/**
 * @brief Switch to System mode (active theme follows OS + chosen slots).
 * @return {void}
 */
export function setThemeSystemMode() {
  localStorage.setItem(LS_MODE, 'system');
  applyTheme();
}

/**
 * @brief Pick a specific theme: set explicit mode, store it as active, and
 *        update the matching light/dark slot (so it becomes the System target
 *        for its category too).
 * @param {string} theme - a concrete theme name.
 * @return {void}
 */
export function setTheme(theme) {
  if (!ALL_THEMES.includes(theme)) return;
  localStorage.setItem(LS_MODE, 'explicit');
  localStorage.setItem('wl_theme_active', theme);
  if (LIGHT_THEMES.includes(theme)) localStorage.setItem(LS_LIGHT, theme);
  else localStorage.setItem(LS_DARK, theme);
  applyTheme();
}

/**
 * @brief Init: apply current state and track OS changes while in system mode.
 * @return {void}
 */
export function initTheme() {
  applyTheme();
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemeMode() === 'system') applyTheme();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
}
