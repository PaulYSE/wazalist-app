/* onboarding.js — feature by feature user guide */

import { saveLabels } from './core.js';
import { renderDashStats } from './stats.js';
import { state } from './state/state.js';
import { LS_LABELS } from './state/localStorage.js';
import { SHAPES, MARKING_LABELS_TEMPLATE } from './config/constants.js';
import { wazaMatchesSearch } from './features/search.js';
import {
  markingStyle, // used in renderList() for all 3 view modes
  markingPips, // used in renderList() and renderDetail()
  cardLikePill, // used in renderList()
} from './render-helpers.js';

// ── Config ────────────────────────────────────────────────────
const SLIDE_COUNT = 10; // Updated to include Stats, Compare, and Contribute slides

// Get real waza data from the main app
function getRealWaza(limit = 20) {
  // Access the global state.wazaData from the main app
  if (
    typeof state.wazaData !== 'undefined' &&
    Array.isArray(state.wazaData) &&
    state.wazaData.length > 0
  ) {
    return state.wazaData.slice(0, limit);
  }
  // Fallback empty array if state.wazaData not yet loaded
  return [];
}

let currentSlide = 0;
let chosenStyle = localStorage.getItem('wl_view_style') || 'expanded';
// Demo marking state: [wazaIndex][markingIndex] - combined markings to show they're not mutually exclusive
const demoMarkings = [
  [true, false, true, false, false, false], // Thundersnake: ● ■
  [false, true, false, false, false, false], // Amaterasu: ▲
  [false, false, false, true, true, false], // Muramasa: ♥ ★
  [true, true, false, false, false, false], // Double Mix: ● ▲
  [false, false, true, true, false, false], // Romance: ■ ♥
];
// Labels inputs state
const labelsValues = ['', '', '', '', '', ''];

// ── Show / hide ───────────────────────────────────────────────
export function showOnboarding() {
  const el = document.getElementById('wlOnboarding');
  el.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('ob-visible');
    });
  });
  buildBrowseDemo();
  buildMarkingDemo();
  buildLabelsPreview();
  renderSlide(0);
}

function closeOnboarding() {
  const el = document.getElementById('wlOnboarding');
  el.classList.remove('ob-visible');
  setTimeout(() => {
    el.style.display = 'none';
  }, 150);
}

// ── Slide navigation ──────────────────────────────────────────
function goToSlide(n) {
  currentSlide = Math.max(0, Math.min(SLIDE_COUNT - 1, n));
  document.getElementById('obSlides').style.transform = `translateX(-${currentSlide * 100}%)`;
  // Progress dots
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const dot = document.getElementById('obDot' + i);
    if (!dot) continue;
    dot.className = 'ob-dot' + (i === currentSlide ? ' active' : i < currentSlide ? ' done' : '');
  }
  renderFooter();
  // Slide-specific init
  if (currentSlide === 2) initSearchDemo();
  if (currentSlide === 3) initStyleDemo();
  if (currentSlide === 5) {
    buildLabelsPreview();
    // Bind the "Use template" button
    const tplBtn = document.getElementById('obUseTemplate');
    if (tplBtn) {
      tplBtn.onclick = () => {
        applyTemplate();
      };
    }
    // Bind the "Clear All" button
    const clearBtn = document.getElementById('obClearAll');
    if (clearBtn) {
      clearBtn.onclick = () => {
        clearAllLabels();
      };
    }
  }
}

function renderSlide(n) {
  goToSlide(n);
}

// ── Footer buttons ────────────────────────────────────────────
function renderFooter() {
  const footer = document.getElementById('obFooter');
  footer.innerHTML = '';

  const footerLeft = document.createElement('div');
  footerLeft.className = 'ob-footer-left';

  const footerRight = document.createElement('div');
  footerRight.className = 'ob-footer-right';

  footer.appendChild(footerLeft);
  footer.appendChild(footerRight);

  // Back button (all slides except first)
  if (currentSlide > 0) {
    footerLeft.appendChild(mkBackBtn());
  }

  if (currentSlide === 5) {
    // Save button — same pattern as share.js
    const saveBtn = document.createElement('button');
    saveBtn.className = 'ob-btn ob-btn-primary';
    saveBtn.textContent = 'Save Labels';

    saveBtn.onclick = () => {
      labelsValues.forEach((value, i) => {
        state.markingLabels[i] = value.trim();
      });
      saveLabels();
      if (typeof renderDashStats === 'function') renderDashStats();
      saveBtn.textContent = 'Saved ✓';
      setTimeout(() => {
        saveBtn.textContent = 'Save Labels';
      }, 1800);
    };
    footerRight.appendChild(saveBtn);
  }

  if (currentSlide < SLIDE_COUNT - 1) {
    footerRight.appendChild(mkNextBtn());
  }

  if (currentSlide === SLIDE_COUNT - 1) {
    // Import slide (last slide) — "Skip" or "Import now"
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ob-btn ob-btn-primary';
    skipBtn.textContent = 'Skip';
    skipBtn.onclick = () => closeOnboarding();

    const importBtn = document.createElement('button');
    importBtn.className = 'ob-btn ob-btn-secondary';
    importBtn.textContent = 'Import now';
    importBtn.onclick = () => {
      closeOnboarding();
      setTimeout(() => {
        const navAcc = document.querySelector('[data-tab="account"]');
        if (navAcc) navAcc.click();
      }, 400);
    };

    footerRight.appendChild(skipBtn);
    footerRight.appendChild(importBtn);
  }
}

function mkBackBtn() {
  const btn = document.createElement('button');
  btn.className = 'ob-btn';
  btn.textContent = '← Back';
  btn.onclick = () => {
    goToSlide(currentSlide - 1);
  };
  return btn;
}

function mkNextBtn() {
  const btn = document.createElement('button');
  btn.className = 'ob-btn ob-btn-primary';
  btn.textContent = currentSlide === SLIDE_COUNT - 2 ? 'Almost done →' : 'Next →';
  btn.onclick = () => {
    goToSlide(currentSlide + 1);
  };
  return btn;
}

// ── Browse demo (slide 1) ─────────────────────────────────────
function buildBrowseDemo() {
  const container = document.getElementById('obBrowseList');
  if (!container) return;

  // Get real waza data
  const realWaza = getRealWaza(5);
  if (realWaza.length === 0) {
    container.innerHTML =
      '<div style="color:var(--text3);padding:20px;text-align:center">Loading waza...</div>';
    return;
  }

  // Use first 3 real waza with demo markings
  const demoItems = [
    {
      waza: realWaza[0],
      markings: [true, false, false, true, true, false],
      likes: 67,
      dislikes: 0,
    },
    { waza: realWaza[1], markings: [false, false, false, true, true, true], likes: 5, dislikes: 0 },
    {
      waza: realWaza[2],
      markings: [true, true, false, false, false, false],
      likes: 3,
      dislikes: 1,
    },
    {
      waza: realWaza[3],
      markings: [true, false, false, false, true, true],
      likes: 12,
      dislikes: 0,
    },
    {
      waza: realWaza[4],
      markings: [false, false, true, false, false, true],
      likes: 3,
      dislikes: 2,
    },
  ];

  // Build real waza-list components (same structure as main app's list view)
  container.innerHTML = demoItems
    .map((item) => {
      const w = item.waza;
      const markings = item.markings;
      const pill = cardLikePill(item.likes, item.dislikes);

      const bottomRow =
        '<div class="card-bottom-row">' +
        '<div class="markings-row wce-markings">' +
        markingPips(markings) +
        '</div>' +
        pill +
        '</div>';

      const _ms = markingStyle(markings);
      return (
        '<div class="waza-list ' +
        _ms.cls +
        '" style="' +
        _ms.style +
        '">' +
        '<div class="njp">' +
        w.name_jp +
        '</div>' +
        '<div class="nen">' +
        w.name_en +
        '</div>' +
        bottomRow +
        '</div>'
      );
    })
    .join('');
}

// ── Fuzzy search demo (slide 2) ───────────────────────────────
let searchTimer = null;
function initSearchDemo() {
  const input = document.getElementById('obSearchInput');
  const resultsEl = document.getElementById('obSearchResults');
  const hint = document.getElementById('obSearchHint');
  if (!input) return;
  input.value = '';
  if (hint) hint.style.display = '';
  resultsEl.innerHTML =
    '<div class="ob-no-results" id="obSearchHint">Start typing above to see fuzzy matching in action…</div>';

  input.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearchDemo(input.value), 120);
  };
  // Auto-type demo
  autoTypeDemo(input);
}

function autoTypeDemo(input) {
  // Search for a Snake waza
  let phrase = 'suneiku';

  // Autotype
  let i = 0;
  function type() {
    if (input !== document.getElementById('obSearchInput')) return; // slide changed
    if (document.getElementById('obSearchInput') !== document.activeElement) {
      if (i < phrase.length) {
        input.value = phrase.slice(0, ++i);
        input.dispatchEvent(new Event('input'));
        setTimeout(type, 90 + Math.random() * 60);
      }
    }
  }
  setTimeout(type, 800);
}

function runSearchDemo(query) {
  const resultsEl = document.getElementById('obSearchResults');
  if (!resultsEl) return;
  if (!query.trim()) {
    resultsEl.innerHTML =
      '<div class="ob-no-results" id="obSearchHint">Start typing above to see fuzzy matching in action…</div>';
    return;
  }

  // Get real waza data
  const realWaza = getRealWaza(100); // Limit to first 100 for performance
  if (realWaza.length === 0) {
    resultsEl.innerHTML = '<div class="ob-no-results">Loading waza data...</div>';
    return;
  }

  const matches = realWaza.filter((w) => wazaMatchesSearch(w, query)).slice(0, 10);

  if (!matches.length) {
    resultsEl.innerHTML =
      '<div class="ob-no-results">No matches found — try a different spelling</div>';
    return;
  }

  resultsEl.innerHTML = '';
  matches.forEach((w, idx) => {
    const row = document.createElement('div');
    row.className = 'waza-compact'; // Use actual list row class from main app

    // Use actual wazalist list row structure
    row.innerHTML = `
        <span class="dnjp">${w.name_jp}</span>
        <span class="dnen">${w.name_en}</span>
      `;

    resultsEl.appendChild(row);
    // Stagger animation
    setTimeout(() => row.classList.add('show'), idx * 60);
  });
}

// ── Card style demo (slide 3) ─────────────────────────────────
function initStyleDemo() {
  buildStyleDemo();
}

function buildStyleDemo() {
  const container = document.getElementById('obStyleDemo');
  if (!container) return;

  const SHAPES = ['●', '▲', '■', '♥', '★', '◆'];

  const pipsHTML = (markings) =>
    SHAPES.map(
      (s, i) => '<span class="marking-pip' + (markings[i] ? ' on' : '') + '">' + s + '</span>',
    ).join('');

  const likePillHTML = (likes, dislikes) =>
    '<div class="card-like-pill"><span>👍 ' +
    likes +
    '</span><span>👎 ' +
    dislikes +
    '</span></div>';

  const bottomRowHTML = (w) =>
    '<div class="card-bottom-row">' +
    '<div class="markings-row wce-markings">' +
    pipsHTML(w.markings) +
    '</div>' +
    likePillHTML(w.likes, w.dislikes) +
    '</div>';

  // ── Sample waza ───────────────────────────────────────────────
  const realWaza = getRealWaza(5);
  if (realWaza.length === 0) {
    container.innerHTML =
      '<div style="color:var(--text3);padding:20px;text-align:center">Loading waza...</div>';
    return;
  }

  const sample_waza = [
    { ...realWaza[0], markings: [true, false, false, false, true, false], likes: 67, dislikes: 2 },
    { ...realWaza[1], markings: [false, true, false, true, false, false], likes: 12, dislikes: 0 },
    { ...realWaza[2], markings: [false, false, true, true, false, false], likes: 5, dislikes: 1 },
    { ...realWaza[3], markings: [true, false, false, false, false, true], likes: 8, dislikes: 3 },
    { ...realWaza[4], markings: [false, true, true, false, false, false], likes: 3, dislikes: 0 },
  ];

  // ── Item builders ─────────────────────────────────────────────
  const buildListItem = (w) => {
    const ms = markingStyle(w.markings);
    const el = document.createElement('div');
    el.className = 'waza-list ' + ms.cls;
    el.setAttribute('style', ms.style);
    el.innerHTML =
      '<div class="njp">' +
      w.name_jp +
      '</div>' +
      '<div class="nen">' +
      w.name_en +
      '</div>' +
      bottomRowHTML(w);
    return el;
  };

  const buildCardItem = (w) => {
    const ms = markingStyle(w.markings);
    const el = document.createElement('div');
    el.className = 'waza-card ' + ms.cls;
    el.setAttribute('style', ms.style);
    el.innerHTML =
      '<div class="wce-header">' +
      '<div class="njp">' +
      w.name_jp +
      '</div>' +
      '<div class="nen">' +
      w.name_en +
      '</div>' +
      bottomRowHTML(w) +
      '</div>' +
      '<div class="wce-videos">' +
      '<a class="vid-btn" href="#" onclick="return false"><span class="vid-dot" style="background:#ff0000"></span>YouTube</a>' +
      '<a class="vid-btn" href="#" onclick="return false"><span class="vid-dot" style="background:#00a1d6"></span>Bilibili</a>' +
      '</div>';
    return el;
  };

  const buildCompactItem = (w) => {
    const ms = markingStyle(w.markings);
    const el = document.createElement('div');
    el.className = 'waza-compact ' + ms.cls;
    el.setAttribute('style', ms.style);
    el.innerHTML =
      '<span class="drn">' +
      w.name_jp +
      '</span>' +
      '<span class="drs">' +
      w.name_en +
      '</span>' +
      '<div class="markings-row" style="flex-shrink:0">' +
      pipsHTML(w.markings) +
      '</div>';
    return el;
  };

  // ── Build pills ───────────────────────────────────────────────
  const STYLES = [
    { key: 'list', label: 'List' },
    { key: 'expanded', label: 'Cards' },
    { key: 'compact', label: 'Compact' },
  ];

  container.innerHTML = '';

  STYLES.forEach(({ key, label }) => {
    const pill = document.createElement('div');
    pill.className = 'ob-style-pill' + (chosenStyle === key ? ' selected' : '');
    pill.dataset.style = key;

    const pillLabel = document.createElement('div');
    pillLabel.className = 'sp-label';
    pillLabel.textContent = label + (chosenStyle === key ? ' ✓ (selected)' : '');
    pill.appendChild(pillLabel);

    const preview = document.createElement('div');
    if (key === 'list') {
      preview.appendChild(buildListItem(sample_waza[0]));
    } else if (key === 'expanded') {
      preview.appendChild(buildCardItem(sample_waza[1]));
    } else {
      sample_waza.slice(2).forEach((w) => preview.appendChild(buildCompactItem(w)));
    }
    pill.appendChild(preview);
    container.appendChild(pill);
  });

  // ── Style selection ───────────────────────────────────────────
  container.querySelectorAll('.ob-style-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      chosenStyle = pill.dataset.style;
      localStorage.setItem('wl_view_style', chosenStyle);
      const sel = document.getElementById('browseViewSelect');
      const selMob = document.getElementById('browseViewSelectMob');
      if (sel) sel.value = chosenStyle;
      if (selMob) selMob.value = chosenStyle;
      buildStyleDemo();
    });
  });
}

// ── Marking demo (slide 4) ────────────────────────────────────
function buildMarkingDemo() {
  const container = document.getElementById('obMarkingDemo');
  if (!container) return;

  // Get real waza data
  const realWaza = getRealWaza(5);
  if (realWaza.length === 0) {
    container.innerHTML =
      '<div style="color:var(--text3);padding:20px;text-align:center">Loading waza...</div>';
    return;
  }

  container.innerHTML = '';
  // Use first 5 real waza for marking demo
  realWaza.forEach((w, wi) => {
    const row = document.createElement('div');
    const markings = demoMarkings[wi];

    // Use real waza-compact structure with marking tint classes
    (function () {
      var _ms = markingStyle(markings);
      row.className = 'waza-compact ' + _ms.cls;
      row.setAttribute('style', _ms.style);
    })();

    // Structure: drn (JP name) + drs (EN name) + cmp-markings-mine (buttons)
    const markingsHTML =
      '<div class="cmp-markings-mine" style="flex-shrink:0">' +
      SHAPES.map(
        (sh, si) =>
          '<button class="cmp-marking-btn' +
          (markings[si] ? ' on' : '') +
          '" ' +
          'data-wid="' +
          wi +
          '" data-si="' +
          si +
          '" ' +
          'title="' +
          (state.markingLabels[si] || 'Marking ' + (si + 1)) +
          '">' +
          sh +
          '</button>',
      ).join('') +
      '</div>';

    row.innerHTML =
      '<span class="drn">' +
      w.name_jp +
      '</span>' +
      '<span class="drs">' +
      w.name_en +
      '</span>' +
      markingsHTML;

    container.appendChild(row);

    // Attach click handlers to marking buttons
    row.querySelectorAll('.cmp-marking-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wid = +btn.dataset.wid;
        const si = +btn.dataset.si;
        demoMarkings[wid][si] = !demoMarkings[wid][si];
        btn.classList.toggle('on', demoMarkings[wid][si]);
        // Update row's marking class for color tinting
        (function () {
          var _ms = markingStyle(demoMarkings[wid]);
          row.className = 'waza-compact ' + _ms.cls;
          row.setAttribute('style', _ms.style);
        })();
      });
    });
  });
}

// ── Labels preview (slide 5) ──────────────────────────────────
function buildLabelsPreview() {
  const container = document.getElementById('obLabelsPreview');
  if (!container) return;
  container.innerHTML = '';
  // Load existing labels from app
  let existing = ['', '', '', '', '', ''];
  try {
    existing = JSON.parse(localStorage.getItem(LS_LABELS) || '["","","","","",""]');
  } catch {
    // corrupt localStorage value — fall back to six empty labels
  }
  SHAPES.forEach((sh, i) => {
    const row = document.createElement('div');
    row.className = 'ob-labels-row';
    row.innerHTML = `<span class="ob-labels-marking">${sh}</span>`;
    const inp = document.createElement('input');
    inp.className = 'ob-labels-input';
    inp.type = 'text';
    inp.maxLength = 32;
    inp.placeholder = 'Label this marking…';
    inp.value = existing[i] || labelsValues[i] || '';
    inp.oninput = () => {
      labelsValues[i] = inp.value;
    };
    row.appendChild(inp);
    container.appendChild(row);
  });
}

// ── Apply template ────────────────────────────────────────────
function applyTemplate() {
  const inputs = document.querySelectorAll('#obLabelsPreview .ob-labels-input');
  inputs.forEach((inp, i) => {
    inp.value = MARKING_LABELS_TEMPLATE[i] || '';
    labelsValues[i] = inp.value;
  });
}

// ── Clear all labels ──────────────────────────────────────────
function clearAllLabels() {
  const inputs = document.querySelectorAll('#obLabelsPreview .ob-labels-input');
  inputs.forEach((inp, i) => {
    inp.value = '';
    labelsValues[i] = '';
  });
}

// ── Close button ──────────────────────────────────────────────
export function initOnboarding() {
  document.getElementById('obClose').onclick = closeOnboarding;
}
