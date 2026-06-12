/**
 * @file themes.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-12
 * @brief Theme registry for the Wazalist application. Defines available themes with labels, groups (light/dark), and preview swatch colors.
 */

// Each theme: key, label, group ('light'|'dark'), and swatch preview colors.
// The actual CSS palette lives in themes.css keyed by [data-theme="<key>"].
// Adding a theme = one entry here + one block in themes.css. Nothing else.

/**
 * @brief Registry of all available themes with their display properties.
 *
 * @type {Array<{key: string, label: string, group: 'light'|'dark', swatches: string[]}>}
 */
export const THEME_REGISTRY = [
  // ── Light ──
  {
    key: 'light',
    label: 'Light',
    group: 'light',
    swatches: ['#ffffff', '#eef0f4', '#5a4fd0', '#2e9e63'],
  },
  {
    key: 'solarized',
    label: 'Solarized',
    group: 'light',
    swatches: ['#fdf6e3', '#eee8d5', '#268bd2', '#859900'],
  },
  {
    key: 'nord-light',
    label: 'Nord Light',
    group: 'light',
    swatches: ['#eceff4', '#d8dee9', '#5e81ac', '#a3be8c'],
  },
  {
    key: 'gruvbox-light',
    label: 'Gruvbox Light',
    group: 'light',
    swatches: ['#fbf1c7', '#ebdbb2', '#d65d0e', '#98971a'],
  },
  {
    key: 'github-light',
    label: 'GitHub Light',
    group: 'light',
    swatches: ['#ffffff', '#f6f8fa', '#0969da', '#1a7f37'],
  },
  {
    key: 'latte',
    label: 'Catppuccin Latte',
    group: 'light',
    swatches: ['#eff1f5', '#e6e9ef', '#8839ef', '#40a02b'],
  },
  {
    key: 'light-owl',
    label: 'Light Owl',
    group: 'light',
    swatches: ['#fbfbfb', '#f0f0f0', '#2aa298', '#994cc3'],
  },
  // ── Dark ──
  {
    key: 'dark',
    label: 'Dark',
    group: 'dark',
    swatches: ['#0f0f14', '#1e1e28', '#7c6ff7', '#56c08a'],
  },
  {
    key: 'amoled',
    label: 'AMOLED',
    group: 'dark',
    swatches: ['#000000', '#141414', '#7c6ff7', '#56c08a'],
  },
  {
    key: 'dracula',
    label: 'Dracula',
    group: 'dark',
    swatches: ['#282a36', '#44475a', '#bd93f9', '#50fa7b'],
  },
  {
    key: 'steel',
    label: 'Steel',
    group: 'dark',
    swatches: ['#14181d', '#232a32', '#5fa8d3', '#5bbf99'],
  },
  {
    key: 'nord-dark',
    label: 'Nord Dark',
    group: 'dark',
    swatches: ['#2e3440', '#3b4252', '#88c0d0', '#a3be8c'],
  },
  {
    key: 'gruvbox-dark',
    label: 'Gruvbox Dark',
    group: 'dark',
    swatches: ['#282828', '#3c3836', '#fe8019', '#b8bb26'],
  },
  {
    key: 'github-dark',
    label: 'GitHub Dark',
    group: 'dark',
    swatches: ['#0d1117', '#161b22', '#58a6ff', '#3fb950'],
  },
  {
    key: 'one-dark',
    label: 'One Dark Pro',
    group: 'dark',
    swatches: ['#282c34', '#3a3f4b', '#61afef', '#98c379'],
  },
  {
    key: 'frappe',
    label: 'Catppuccin Frappé',
    group: 'dark',
    swatches: ['#303446', '#414559', '#ca9ee6', '#a6d189'],
  },
  {
    key: 'macchiato',
    label: 'Catppuccin Macchiato',
    group: 'dark',
    swatches: ['#24273a', '#363a4f', '#c6a0f6', '#a6da95'],
  },
  {
    key: 'mocha',
    label: 'Catppuccin Mocha',
    group: 'dark',
    swatches: ['#1e1e2e', '#313244', '#cba6f7', '#a6e3a1'],
  },
  {
    key: 'synthwave',
    label: "SynthWave '84",
    group: 'dark',
    swatches: ['#262335', '#2a2139', '#ff7edb', '#72f1b8'],
  },
  {
    key: 'night-owl',
    label: 'Night Owl',
    group: 'dark',
    swatches: ['#011627', '#0e293f', '#82aaff', '#addb67'],
  },
];

/**
 * @brief Array of light theme keys.
 *
 * @type {string[]}
 */
export const LIGHT_THEMES = THEME_REGISTRY.filter((t) => t.group === 'light').map((t) => t.key);

/**
 * @brief Array of dark theme keys.
 *
 * @type {string[]}
 */
export const DARK_THEMES = THEME_REGISTRY.filter((t) => t.group === 'dark').map((t) => t.key);

/**
 * @brief Array of all theme keys (light + dark).
 *
 * @type {string[]}
 */
export const ALL_THEMES = THEME_REGISTRY.map((t) => t.key);
