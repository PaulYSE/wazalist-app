/**
 * @fileoverview Builds accordion markup and updates accordion DOM classes.
 *
 * Event wiring, animation styles, and application-state synchronization
 * are managed by consuming modules.
 *
 * @author Paul Yong Shao En
 */

import { escapeHtml } from '../lib/escape.js';

/**
 * Builds an accordion section without attaching event handlers.
 *
 * Escapes the section key and wrapper classes for HTML attributes.
 * Inserts label and bodyHtml as HTML; callers must supply trusted or
 * appropriately sanitized markup and escape dynamic text within it.
 *
 * Expansion classes and wrapper visibility are independent. Animation
 * and collapsed-content visibility depend on external CSS.
 *
 * @param {string} key Section identifier stored in data-acc.
 * @param {string} label Trusted or sanitized heading HTML.
 * @param {string} bodyHtml Trusted or sanitized body HTML.
 * @param {{
 *   open: (boolean|undefined),
 *   visible: (boolean|undefined),
 *   wrapper: (string|undefined)
 * }=} opts Configuration. Defaults to closed, visible, and wrapper
 *     class dsec2. Individual properties may be omitted.
 * @return {string} Accordion section HTML.
 */
export function buildAccordion(key, label, bodyHtml, opts = {}) {
  const {
    open = false,
    visible = true,
    wrapper = 'dsec2',
  } = opts;

  return (
    '<div class="' +
    escapeHtml(wrapper) +
    '"' +
    (visible ? '' : ' style="display:none"') +
    '>' +
    '<div class="dsec-toggle acc-toggle' +
    (open ? '' : ' collapsed') +
    '" data-acc="' +
    escapeHtml(key) +
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
 * Sets an accordion's expansion classes without rebuilding its markup.
 *
 * Requires a toggle element whose next element sibling is its body.
 * A missing sibling is tolerated. Does not update wrapper visibility,
 * application state, or persisted preferences.
 *
 * To open one section exclusively, close the container's accordions
 * first. For exclusive click-to-toggle behavior, capture the target's
 * previous expansion state before closing the other sections.
 *
 * @param {!HTMLElement} toggleEl Accordion toggle element.
 * @param {boolean} open Whether to expand or collapse the section.
 * @return {void}
 */
export function toggleAccordionDOM(toggleEl, open) {
  toggleEl.classList.toggle('collapsed', !open);
  toggleEl.nextElementSibling?.classList.toggle('open', open);
}

/**
 * Removes expansion classes from accordion descendants of a container.
 *
 * Includes nested accordion toggles but not the container itself.
 * Assumes each toggle's next element sibling is its body; a missing
 * sibling is tolerated.
 *
 * Does not update wrapper visibility, application state, or persisted
 * preferences. Visual collapsing and animation depend on external CSS.
 *
 * @param {!HTMLElement} container Container whose accordions should close.
 * @return {void}
 */
export function closeAllAccordions(container) {
  container.querySelectorAll('.acc-toggle').forEach((el) => {
    el.classList.add('collapsed');
    el.nextElementSibling?.classList.remove('open');
  });
}
