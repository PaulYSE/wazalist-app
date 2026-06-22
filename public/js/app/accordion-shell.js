/**
 * @file app/accordion-shell.js
 * @brief Unified accordion shell builder. Produces the animated collapsible
 *        section HTML used by Stats, Account, Compare, and Waza Detail tabs.
 *
 * @param {string}  key        - Unique identifier for this accordion section.
 * @param {string}  label      - Header text displayed in the toggle bar.
 * @param {string}  bodyHtml   - Inner HTML rendered inside the collapsible body.
 * @param {Object}  [opts]     - Optional configuration.
 * @param {boolean} [opts.open=false]     - Whether the section starts expanded.
 * @param {boolean} [opts.visible=true]   - Whether the outer wrapper is visible.
 * @param {string}  [opts.wrapper='dsec2'] - CSS class for the outer wrapper.
 * @return {string} HTML string for the accordion section.
 */
export function buildAccordion(key, label, bodyHtml, opts = {}) {
  const { open = false, visible = true, wrapper = 'dsec2' } = opts;

  return (
    '<div class="' +
    wrapper +
    '"' +
    (visible ? '' : ' style="display:none"') +
    '>' +
    '<div class="dsec-toggle acc-toggle' +
    (open ? '' : ' collapsed') +
    '" data-acc="' +
    key +
    '">' +
    '<h3 style="margin-bottom:0;border-bottom:none;padding-bottom:0">' +
    label +
    '</h3>' +
    '<span class="toggle-arrow">▾</span>' +
    '</div>' +
    '<div class="acc-body' +
    (open ? ' open' : '') +
    '">' +
    '<div class="acc-body-inner"><div class="acc-body-box">' +
    bodyHtml +
    '</div></div></div>' +
    '</div>'
  );
}

/**
 * @brief Toggles an accordion open/closed by toggling CSS classes on the DOM.
 *
 * Used when the accordion already exists in the DOM and you want to animate
 * it without rebuilding innerHTML. For mutually-exclusive accordions, call
 * closeAllAccordions() first, then this on the target.
 *
 * @param {HTMLElement} toggleEl - The .acc-toggle element that was clicked.
 * @param {boolean} open - Whether to open (true) or close (false).
 * @return {void}
 */
export function toggleAccordionDOM(toggleEl, open) {
  toggleEl.classList.toggle('collapsed', !open);
  toggleEl.nextElementSibling?.classList.toggle('open', open);
}

/**
 * @brief Closes all accordion sections inside a container.
 *
 * @param {HTMLElement} container - Parent element containing .acc-toggle elements.
 * @return {void}
 */
export function closeAllAccordions(container) {
  container.querySelectorAll('.acc-toggle').forEach((el) => {
    el.classList.add('collapsed');
    el.nextElementSibling?.classList.remove('open');
  });
}
