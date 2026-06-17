/**
 * @file groups-utils.js (partial — social link helpers)
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Shared utilities for rendering and reading social link lists in group create/edit forms.
 */
import { escapeHtml } from '../lib/escape.js';

// ── Social link builder (shared between create + edit) ────────

/**
 * @brief Renders the social link list into a container element.
 *
 * Displays a list of platform/URL pairs with editable inputs and remove buttons.
 * Each row includes a platform input, URL input, and a remove button.
 * Bind remove buttons to splice the link from the array and re-render.
 *
 * @param {HTMLElement} container - The container element to render into.
 * @param {Array<{platform:string,url:string}>} links - Array of social link objects.
 * @return {void}
 */
export function renderSocialList(container, links) {
  container.innerHTML = links
    .map(
      (s, i) =>
        '<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center" data-si="' +
        i +
        '">' +
        '<input class="cfield input sg-platform" type="text" placeholder="Platform (e.g. Instagram)" value="' +
        escapeHtml(s.platform) +
        '" style="flex:1;padding:7px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text1);font-size:13px">' +
        '<input class="cfield input sg-url" type="url" placeholder="https://…" value="' +
        escapeHtml(s.url) +
        '" style="flex:2;padding:7px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text1);font-size:13px">' +
        '<button class="btn sg-remove" data-si="' +
        i +
        '" style="padding:4px 8px;color:var(--red);border-color:var(--red);flex-shrink:0">✕</button>' +
        '</div>',
    )
    .join('');

  container.querySelectorAll('.sg-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      links.splice(+btn.dataset.si, 1);
      renderSocialList(container, links);
    });
  });
}

/**
 * @brief Reads the current social link inputs from a container.
 *
 * Iterates over each row in the container, extracts platform and URL values,
 * and returns an array of non-empty link objects.
 *
 * @param {HTMLElement} container - The container element containing social link rows.
 * @return {Array<{platform:string,url:string}>} Array of social link objects.
 */
export function readSocialList(container) {
  const rows = container.querySelectorAll(':scope > [data-si]');
  const result = [];
  rows.forEach((row) => {
    const platform = row.querySelector('.sg-platform').value.trim();
    const url = row.querySelector('.sg-url').value.trim();
    if (platform && url) result.push({ platform, url });
  });
  return result;
}