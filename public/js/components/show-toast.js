/**
 * @file show-toast.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-13
 * @brief Simple toast notification helper. Displays a temporary message in the bottom-right corner of the viewport.
 */

// ── Toast helper ─────────────────────────────────────────────

/**
 * @brief Displays a temporary toast notification.
 *
 * Creates a floating div at bottom-right of the screen that auto-removes after 3 seconds.
 * Colors are theme-driven via CSS variables, so the toast adapts to the active theme.
 *
 * @param {string} msg - The message text to display.
 * @param {string} [color='green'] - Color theme: 'green', 'amber', or 'red'.
 * @return {void}
 */
export function showToast(msg, color = 'green') {
  // Each entry maps to [background var, foreground/border var].
  const colors = {
    green: ['var(--green-bg)', 'var(--green)'],
    amber: ['var(--amber-bg)', 'var(--amber)'],
    red: ['var(--red-bg)', 'var(--red)'],
  };
  const [bg, fg] = colors[color] || colors.green;
  const fb = document.createElement('div');
  fb.style.cssText =
    'position:fixed;bottom:20px;right:20px;background:' +
    bg +
    ';color:' +
    fg +
    ';border:1px solid ' +
    fg +
    ';border-radius:8px;padding:10px 16px;font-size:13px;z-index:300;max-width:320px';
  fb.textContent = msg;
  document.body.appendChild(fb);
  setTimeout(() => fb.remove(), 3000);
}
