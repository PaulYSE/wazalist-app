/**
 * @file show-toast.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-10-20
 * @fileoverview Theme-aware toast notifications with stacking, dismissal, duplicate merging, and interaction-aware timers.
 */

const MAX_TOASTS = 3;

const TOAST_COLORS = {
  green: ['var(--green-bg)', 'var(--green)'],
  amber: ['var(--amber-bg)', 'var(--amber)'],
  red: ['var(--red-bg)', 'var(--red)'],
};

/**
 * @typedef {{
 *   element: !HTMLDivElement,
 *   message: string,
 *   color: string,
 *   remaining: number,
 *   startedAt: number,
 *   timer: ?number,
 *   hovered: boolean,
 *   focused: boolean
 * }}
 */
let ToastEntry;

/** @type {!Array<!ToastEntry>} Oldest to newest. */
const toasts = [];

/** @type {?HTMLDivElement} */
let container = null;

/**
 * Creates the shared toast container, styles, and visibility listener.
 *
 * Requires document.body to exist.
 *
 * @return {!HTMLDivElement} Shared toast container.
 */
function ensureContainer() {
  if (container) return container;

  const style = document.createElement('style');
  style.textContent = `
    .wl-toast-stack {
      position: fixed;
      right: max(20px, env(safe-area-inset-right, 0px));
      bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(320px, calc(100vw - 40px));
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
      pointer-events: none;
    }

    .wl-toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex-shrink: 0;
      box-sizing: border-box;
      padding: 10px 12px 10px 16px;
      border: 1px solid;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      pointer-events: auto;
    }

    .wl-toast-message {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .wl-toast-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .wl-toast-close:hover {
      border-color: currentColor;
    }

    .wl-toast-close:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    @media (max-width: 600px) {
      .wl-toast-stack {
        left: max(12px, env(safe-area-inset-left, 0px));
        right: max(12px, env(safe-area-inset-right, 0px));
        bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        width: auto;
        max-height: calc(
          100dvh - 24px -
          env(safe-area-inset-top, 0px) -
          env(safe-area-inset-bottom, 0px)
        );
      }
    }
  `;
  document.head.appendChild(style);

  container = document.createElement('div');
  container.className = 'wl-toast-stack';
  document.body.appendChild(container);

  document.addEventListener('visibilitychange', () => {
    toasts.forEach((entry) => {
      // Recheck interaction state after returning to the document.
      entry.hovered = entry.element.matches(':hover');
      entry.focused = entry.element.contains(document.activeElement);
      syncTimer(entry);
    });
  });

  return container;
}

/**
 * Stops a running timer and records its remaining duration.
 *
 * @param {!ToastEntry} entry Toast to pause.
 * @return {void}
 */
function pauseTimer(entry) {
  if (entry.timer === null) return;

  window.clearTimeout(entry.timer);
  entry.timer = null;
  entry.remaining = Math.max(
    0,
    entry.remaining - (performance.now() - entry.startedAt),
  );
}

/**
 * Starts or pauses a toast timer according to all pause conditions.
 *
 * Does not restart an already running timer.
 *
 * @param {!ToastEntry} entry Toast whose timer should be reconciled.
 * @return {void}
 */
function syncTimer(entry) {
  if (!toasts.includes(entry)) return;

  if (document.hidden || entry.hovered || entry.focused) {
    pauseTimer(entry);
    return;
  }

  if (entry.timer !== null) return;

  entry.startedAt = performance.now();
  entry.timer = window.setTimeout(() => {
    removeToast(entry);
  }, entry.remaining);
}

/**
 * Updates visual stack order without moving or recreating DOM elements.
 *
 * @return {void}
 */
function updateOrder() {
  toasts.forEach((entry, index) => {
    entry.element.style.order = String(index);
  });
}

/**
 * Removes a toast and clears its timer and tracking record.
 *
 * Has no effect if the toast has already been removed.
 *
 * @param {!ToastEntry} entry Toast to remove.
 * @return {void}
 */
function removeToast(entry) {
  const index = toasts.indexOf(entry);
  if (index === -1) return;

  if (entry.timer !== null) {
    window.clearTimeout(entry.timer);
    entry.timer = null;
  }

  toasts.splice(index, 1);
  entry.element.remove();
  updateOrder();
}

/**
 * Displays a plain-text, theme-aware toast without moving keyboard focus.
 *
 * Shows at most three toasts, newest at the bottom. A new toast at capacity
 * removes the oldest toast that does not contain keyboard focus.
 *
 * Duplicate messages with the same resolved color reuse the existing toast,
 * move it to the bottom, and reset its duration. Green toasts last three
 * seconds; amber and red toasts last five seconds.
 *
 * Timers pause during hover, focus within the toast, or a hidden document.
 * Remaining time resumes only when all pause conditions clear. Each toast
 * has a close button. No automatic screen-reader announcements are made.
 *
 * Requires document.body and the application's theme CSS variables.
 *
 * @param {string} msg Message to display as plain text.
 * @param {string=} color Green, amber, or red. Defaults to green;
 *     unsupported values also resolve to green.
 * @return {void}
 */
export function showToast(msg, color = 'green') {
  const stack = ensureContainer();

  const resolvedColor = Object.prototype.hasOwnProperty.call(
    TOAST_COLORS,
    color,
  )
    ? color
    : 'green';

  const message = String(msg ?? '');
  const duration = resolvedColor === 'green' ? 3000 : 5000;

  const existing = toasts.find(
    (entry) =>
      entry.message === message && entry.color === resolvedColor,
  );

  if (existing) {
    pauseTimer(existing);
    existing.remaining = duration;

    toasts.splice(toasts.indexOf(existing), 1);
    toasts.push(existing);
    updateOrder();

    // CSS reordering can change which toast is beneath the pointer.
    toasts.forEach((entry) => {
      entry.hovered = entry.element.matches(':hover');
      entry.focused = entry.element.contains(document.activeElement);
      syncTimer(entry);
    });

    return;
  }

  if (toasts.length >= MAX_TOASTS) {
    const oldestNonfocused = toasts.find(
      (entry) => !entry.element.contains(document.activeElement),
    );

    // Defensive fallback: never evict a keyboard-focused toast.
    if (!oldestNonfocused) return;

    removeToast(oldestNonfocused);
  }

  const [background, foreground] = TOAST_COLORS[resolvedColor];

  const element = document.createElement('div');
  element.className = 'wl-toast';
  element.style.background = background;
  element.style.color = foreground;
  element.style.borderColor = foreground;

  const text = document.createElement('div');
  text.className = 'wl-toast-message';
  text.textContent = message;

  const close = document.createElement('button');
  close.className = 'wl-toast-close';
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Dismiss notification');

  element.append(text, close);

  /** @type {!ToastEntry} */
  const entry = {
    element,
    message,
    color: resolvedColor,
    remaining: duration,
    startedAt: 0,
    timer: null,
    hovered: false,
    focused: false,
  };

  element.addEventListener('mouseenter', () => {
    entry.hovered = true;
    syncTimer(entry);
  });

  element.addEventListener('mouseleave', () => {
    entry.hovered = false;
    syncTimer(entry);
  });

  element.addEventListener('focusin', () => {
    entry.focused = true;
    syncTimer(entry);
  });

  element.addEventListener('focusout', () => {
    // Wait until the browser has updated document.activeElement.
    queueMicrotask(() => {
      entry.focused = element.contains(document.activeElement);
      syncTimer(entry);
    });
  });

  close.addEventListener('click', () => {
    removeToast(entry);
  });

  toasts.push(entry);
  stack.appendChild(element);
  updateOrder();

  toasts.forEach((toast) => {
    toast.hovered = toast.element.matches(':hover');
    toast.focused = toast.element.contains(document.activeElement);
    syncTimer(toast);
  });
}
