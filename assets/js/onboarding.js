/* onboarding.js — first-run onboarding overlay. Self-contained IIFE that
   READS the globals defined above (initApp, wazaData, markingPips, ...) and
   monkey-patches window.initApp. MUST load last. */
(function() {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  const TEMPLATE = ['Want to Learn','Learning','Complete','Favourite','Oriwaza','Forgotten'];
  const SHAPES_OB = ['●','▲','■','♥','★','◆'];
  const SLIDE_COUNT = 10; // Updated to include Stats, Compare, and Contribute slides

  // Get real waza data from the main app (first 20 waza)
  function getRealWaza() {
    // Access the global wazaData from the main app
    if (typeof wazaData !== 'undefined' && Array.isArray(wazaData) && wazaData.length > 0) {
      return wazaData.slice(0, 20).map(w => ({
        id: w.id,
        jp: w.name_jp || '',
        en: w.name_en || '',
        tag: w.tag || '',
        alias: [] // Real waza don't have pre-computed aliases in the DB
      }));
    }
    // Fallback empty array if wazaData not yet loaded
    return [];
  }

  let currentSlide = 0;
  let chosenStyle = localStorage.getItem('wl_view_style') || 'expanded';
  // Demo marking state: [wazaIndex][markingIndex] - combined markings to show they're not mutually exclusive
  const demoMarkings = [
    [true,false,true,false,false,false],  // Thundersnake: ● ■
    [false,true,false,false,false,false], // Amaterasu: ▲
    [false,false,false,true,true,false],  // Muramasa: ♥ ★
    [true,true,false,false,false,false],  // Double Mix: ● ▲
    [false,false,true,true,false,false],  // Romance: ■ ♥
  ];
  // Labels inputs state
  const labelsValues = ['','','','','',''];

  // ── Show / hide ───────────────────────────────────────────────
  function showOnboarding() {
    const el = document.getElementById('wlOnboarding');
    el.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.classList.add('ob-visible'); });
    });
    buildBrowseDemo();
    buildMarkingDemo();
    buildLabelsPreview();
    renderSlide(0);
  }

  function closeOnboarding() {
    saveOnboardingLabels();
    const el = document.getElementById('wlOnboarding');
    el.classList.remove('ob-visible');
    setTimeout(() => { el.style.display = 'none'; }, 150);
  }

  // ── Slide navigation ──────────────────────────────────────────
  function goToSlide(n) {
    currentSlide = Math.max(0, Math.min(SLIDE_COUNT - 1, n));
    document.getElementById('obSlides').style.transform = `translateX(-${currentSlide * 100}%)`;
    // Progress dots
    for (let i = 0; i < SLIDE_COUNT; i++) {
      const dot = document.getElementById('obDot' + i);
      if (!dot) continue;
      dot.className = 'ob-dot' + (i === currentSlide ? ' active' : (i < currentSlide ? ' done' : ''));
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

  function renderSlide(n) { goToSlide(n); }

  // ── Footer buttons ────────────────────────────────────────────
  function renderFooter() {
    const footer = document.getElementById('obFooter');
    footer.innerHTML = '';

    // Back button (all slides except first)
    if (currentSlide > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'ob-btn';
      backBtn.textContent = '← Back';
      backBtn.onclick = () => goToSlide(currentSlide - 1);
      footer.appendChild(backBtn);
    }

    if (currentSlide === 5) {
      // Combined labels + template slide — "Skip" or "Next"
      const next = mkNextBtn();
      footer.appendChild(next);

    } else if (currentSlide === 9) {
      // Import slide (last slide) — "Skip" or "Import now"
      const importBtn = document.createElement('button');
      importBtn.className = 'ob-btn ob-btn-primary';
      importBtn.style.marginLeft = 'auto';
      importBtn.textContent = '📥 Import now';
      importBtn.onclick = () => {
        closeOnboarding();
        setTimeout(() => {
          const navAcc = document.querySelector('[data-tab="account"]');
          if (navAcc) navAcc.click();
        }, 400);
      };

      const skipBtn = document.createElement('button');
      skipBtn.className = 'ob-btn ob-btn-primary';
      skipBtn.style.marginLeft = currentSlide > 0 ? '0' : 'auto';
      skipBtn.textContent = "I'll set up later";
      skipBtn.onclick = () => closeOnboarding();
      // Push skip to right if no back button
      if (currentSlide === 0) skipBtn.style.marginLeft = 'auto';

      footer.appendChild(skipBtn);
      footer.appendChild(importBtn);

    } else {
      // Default: Next button pushed to right
      footer.appendChild(mkNextBtn());
    }
  }

  function mkNextBtn() {
    const btn = document.createElement('button');
    btn.className = 'ob-btn ob-btn-primary';
    btn.style.marginLeft = 'auto';
    btn.textContent = currentSlide === SLIDE_COUNT - 2 ? 'Almost done →' : 'Next →';
    btn.onclick = () => goToSlide(currentSlide + 1);
    return btn;
  }

  // ── Browse demo (slide 1) ─────────────────────────────────────
  function buildBrowseDemo() {
    const container = document.getElementById('obBrowseList');
    if (!container) return;
    
    // Get real waza data
    const realWaza = getRealWaza();
    if (realWaza.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">Loading waza...</div>';
      return;
    }
    
    // Get real app helper functions if available
    const hasRealFunctions = typeof markingPips === 'function' && 
                             typeof markingStyle === 'function' &&
                             typeof SHAPES !== 'undefined';
    
    // Local fallback helpers if real functions not available
    const localMarkingPips = markings => {
      const SHAPES_LOCAL = ['●','▲','■','♥','★','◆'];
      return SHAPES_LOCAL.map((s, i) => 
        '<span class="marking-pip' + (markings[i] ? ' on' : '') + '">' + s + '</span>'
      ).join('');
    };
    
    const localMarkingClass = markings => {
      const active = (markings || []).map((on, i) => on ? i : -1).filter(i => i >= 0);
      if (!active.length) return { cls: '', style: '' };
      const HUES = [200, 45, 123, 280, 80, 330];
      let sinSum = 0, cosSum = 0;
      active.forEach(i => { const r = HUES[i] * Math.PI / 180; sinSum += Math.sin(r); cosSum += Math.cos(r); });
      const hue = Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
      const count = active.length;
      return { cls: 'sh-active', style: 'background:hsl(' + hue + ',' + (44+count*4) + '%,' + (8.5+count*0.5) + '%);border-left-color:hsl(' + hue + ',70%,' + (57+count*2) + '%)' };
    };
    
    const localCardLikePill = (likeCount, dislikeCount) => {
      if (!likeCount && !dislikeCount) return '';
      return '<div class="card-like-pill">'
        + '<span>👍 ' + likeCount + '</span>'
        + '<span>👎 ' + dislikeCount + '</span>'
        + '</div>';
    };
    
    // Choose which functions to use
    const markingPipsFunc = hasRealFunctions ? markingPips : localMarkingPips;
    const markingClassFunc = hasRealFunctions ? markingStyle : localMarkingClass;
    
    // Use first 3 real waza with demo markings
    const demoItems = [
      { waza: realWaza[0], markings: [true, false, true, false, false, false], likes: 2, dislikes: 0 },
      { waza: realWaza[1], markings: [false, true, false, false, false, false], likes: 1, dislikes: 0 },
      { waza: realWaza[2], markings: [false, false, false, true, true, false], likes: 3, dislikes: 1 },
    ];
    
    // Build real waza-list components (same structure as main app's list view)
    container.innerHTML = demoItems.map(item => {
      const w = item.waza;
      const markings = item.markings;
      const pill = localCardLikePill(item.likes, item.dislikes);
      
      const bottomRow = '<div class="card-bottom-row">'
        + '<div class="markings-row wce-markings">' + markingPipsFunc(markings) + '</div>'
        + pill + '</div>';
      
      const _ms = markingClassFunc(markings);
      return '<div class="waza-list ' + _ms.cls + '" style="' + _ms.style + '">'
        + '<div class="njp">' + w.jp + '</div>'
        + '<div class="nen">' + w.en + '</div>'
        + bottomRow + '</div>';
    }).join('');
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
    resultsEl.innerHTML = '<div class="ob-no-results" id="obSearchHint">Start typing above to see fuzzy matching in action…</div>';

    input.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearchDemo(input.value), 120);
    };
    // Auto-type demo
    autoTypeDemo(input);
  }

  function autoTypeDemo(input) {
    // Get a search term from real waza data
    const realWaza = getRealWaza();
    let phrase = 'waza'; // fallback
    if (realWaza.length > 0 && realWaza[0].en) {
      // Use first few characters of the first waza's English name (lowercase)
      phrase = realWaza[0].en.toLowerCase().substring(0, 8);
    }
    
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
      resultsEl.innerHTML = '<div class="ob-no-results" id="obSearchHint">Start typing above to see fuzzy matching in action…</div>';
      return;
    }
    
    // Get real waza data
    const realWaza = getRealWaza();
    if (realWaza.length === 0) {
      resultsEl.innerHTML = '<div class="ob-no-results">Loading waza data...</div>';
      return;
    }
    
    // Use real app search functions - check if they're available
    const hasRealFunctions = typeof isFuzzyMatch === 'function' && typeof matchesQuery === 'function';
    
    const matches = realWaza.filter(w => {
      if (hasRealFunctions) {
        // Use real app's search logic - check all searchable fields
        // Check exact match first (fast path)
        if (matchesQuery(w.jp, query)) return true;
        if (matchesQuery(w.en, query)) return true;
        
        // Then check fuzzy match
        if (isFuzzyMatch(w.jp, query)) return true;
        if (isFuzzyMatch(w.en, query)) return true;
        
        return false;
      } else {
        // Fallback to simple matching if real functions not available
        const q = query.toLowerCase().trim();
        if (w.en.toLowerCase().includes(q)) return true;
        if (w.jp.includes(query)) return true;
        return false;
      }
    }).slice(0, 5); // Limit to first 5 matches

    if (!matches.length) {
      resultsEl.innerHTML = '<div class="ob-no-results">No matches found — try a different spelling</div>';
      return;
    }

    resultsEl.innerHTML = '';
    matches.forEach((w, idx) => {
      const row = document.createElement('div');
      row.className = 'waza-compact'; // Use actual list row class from main app
      
      // Determine if it's exact or fuzzy match using real app logic
      let isExact = false;
      if (hasRealFunctions) {
        isExact = matchesQuery(w.jp, query) || matchesQuery(w.en, query);
      } else {
        const q = query.toLowerCase().trim();
        isExact = w.en.toLowerCase().includes(q) || w.jp.includes(query);
      }
      
      // Use actual wazalist list row structure
      row.innerHTML = `
        <span class="dnjp">${w.jp}</span>
        <span class="dnen">${w.en}</span>
        ${w.tag ? `<span class="badge b-tag">${w.tag}</span>` : ''}
        <span class="badge" style="background:rgba(124,111,247,.15);color:var(--accent);border:none;margin-left:auto">${isExact ? 'match' : 'fuzzy'}</span>
      `;
      
      resultsEl.appendChild(row);
      // Stagger animation
      setTimeout(() => row.classList.add('show'), idx * 60);
    });
  }

  // ── Card style demo (slide 3) ─────────────────────────────────
  function initStyleDemo() { buildStyleDemo(); }
  
  function buildStyleDemo() {
    const container = document.getElementById('obStyleDemo');
    if (!container) return;
    
    const SHAPES = ['●','▲','■','♥','★','◆'];
    
    // Helper: generate marking style from markings (circular hue blend)
    const markingClass = markings => {
      const active = (markings || []).map((on, i) => on ? i : -1).filter(i => i >= 0);
      if (!active.length) return { cls: '', style: '' };
      const HUES = [200, 45, 123, 280, 80, 330];
      let sinSum = 0, cosSum = 0;
      active.forEach(i => { const r = HUES[i] * Math.PI / 180; sinSum += Math.sin(r); cosSum += Math.cos(r); });
      const hue = Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
      const count = active.length;
      return { cls: 'sh-active', style: 'background:hsl(' + hue + ',' + (44+count*4) + '%,' + (8.5+count*0.5) + '%);border-left-color:hsl(' + hue + ',70%,' + (57+count*2) + '%)' };
    };
    
    // Helper: generate marking pips HTML
    const markingPips = markings => SHAPES.map((s, i) => 
      '<span class="marking-pip' + (markings[i] ? ' on' : '') + '">' + s + '</span>'
    ).join('');
    
    // Helper: like pill (simplified for demo)
    const cardLikePill = () => {
      return '<div class="card-like-pill"><span>👍 2</span><span>👎 0</span></div>';
    };
    
    // Get real waza data
    const realWaza = getRealWaza();
    if (realWaza.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">Loading waza...</div>';
      return;
    }
    
    // Sample waza with demo data
    const samples = [
      { jp: realWaza[0].jp, en: realWaza[0].en, markings: [true,false,true,false,false,false] }, // ● ■
      { jp: realWaza[1].jp, en: realWaza[1].en, markings: [false,true,false,false,false,false] }, // ▲
      { jp: realWaza[2].jp, en: realWaza[2].en, markings: [false,false,false,true,true,false] }, // ♥ ★
    ];
    
    container.innerHTML = '';
    
    // ── List style ──
    const listPill = document.createElement('div');
    listPill.className = 'ob-style-pill' + (chosenStyle === 'list' ? ' selected' : '');
    listPill.dataset.style = 'list';
    listPill.innerHTML = '<div class="sp-label">List' + (chosenStyle === 'list' ? ' ✓ (selected)' : '') + '</div>';
    
    const listPreview = document.createElement('div');
    samples.slice(0, 2).forEach(w => {
      const card = document.createElement('div');
      (function(){var _ms=markingClass(w.markings);card.className='waza-list '+_ms.cls;card.setAttribute('style',_ms.style);})();
      const bottomRow = '<div class="card-bottom-row">'
        + '<div class="markings-row wce-markings">' + markingPips(w.markings) + '</div>'
        + cardLikePill() + '</div>';
      card.innerHTML = '<div class="njp">' + w.jp + '</div>'
        + '<div class="nen">' + w.en + '</div>'
        + bottomRow;
      listPreview.appendChild(card);
    });
    listPill.appendChild(listPreview);
    container.appendChild(listPill);
    
    // ── Cards style (expanded) ──
    const cardsPill = document.createElement('div');
    cardsPill.className = 'ob-style-pill' + (chosenStyle === 'expanded' ? ' selected' : '');
    cardsPill.dataset.style = 'expanded';
    cardsPill.innerHTML = '<div class="sp-label">Cards' + (chosenStyle === 'expanded' ? ' ✓ (default)' : '') + '</div>';
    
    const w = samples[0];
    const expandedCard = document.createElement('div');
    (function(){var _ms=markingClass(w.markings);expandedCard.className='waza-card '+_ms.cls;expandedCard.setAttribute('style',_ms.style);})();
    const bottomRow = '<div class="card-bottom-row">'
      + '<div class="markings-row wce-markings">' + markingPips(w.markings) + '</div>'
      + cardLikePill() + '</div>';
    const videoHTML = '<div class="wce-videos">'
      + '<a class="vid-btn" href="#" onclick="return false"><span class="vid-dot" style="background:#ff0000"></span>YouTube 1</a>'
      + '<a class="vid-btn" href="#" onclick="return false"><span class="vid-dot" style="background:#00a1d6"></span>Bilibili 2</a>'
      + '</div>';
    expandedCard.innerHTML = '<div class="wce-header">'
      + '<div class="njp">' + w.jp + '</div>'
      + '<div class="nen">' + w.en + '</div>'
      + bottomRow + '</div>'
      + videoHTML;
    cardsPill.appendChild(expandedCard);
    container.appendChild(cardsPill);
    
    // ── Compact style ──
    const compactPill = document.createElement('div');
    compactPill.className = 'ob-style-pill' + (chosenStyle === 'compact' ? ' selected' : '');
    compactPill.dataset.style = 'compact';
    compactPill.innerHTML = '<div class="sp-label">Compact' + (chosenStyle === 'compact' ? ' ✓ (selected)' : '') + '</div>';
    
    const compactPreview = document.createElement('div');
    samples.forEach(w => {
      const row = document.createElement('div');
      (function(){var _ms=markingClass(w.markings);row.className='waza-compact '+_ms.cls;row.setAttribute('style',_ms.style);})();
      row.innerHTML = '<span class="drn">' + w.jp + '</span>'
        + '<span class="drs">' + w.en + '</span>'
        + '<div class="markings-row" style="flex-shrink:0">' + markingPips(w.markings) + '</div>';
      compactPreview.appendChild(row);
    });
    compactPill.appendChild(compactPreview);
    container.appendChild(compactPill);
    
    // Bind click handlers
    container.querySelectorAll('.ob-style-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        chosenStyle = pill.dataset.style;
        localStorage.setItem('wl_view_style', chosenStyle);
        const sel = document.getElementById('browseViewSelect');
        const selMob = document.getElementById('browseViewSelectMob');
        if (sel) sel.value = chosenStyle;
        if (selMob) selMob.value = chosenStyle;
        buildStyleDemo(); // Rebuild to update labels
      });
    });
  }

  // ── Marking demo (slide 4) ────────────────────────────────────
  function buildMarkingDemo() {
    const container = document.getElementById('obMarkingDemo');
    if (!container) return;
    
    // Get real waza data
    const realWaza = getRealWaza();
    if (realWaza.length === 0) {
      container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">Loading waza...</div>';
      return;
    }
    
    // Get markingLabels if available from main app
    const labels = window.markingLabels || TEMPLATE;
    const SHAPES = ['●','▲','■','♥','★','◆'];
    
    // Helper: generate marking style from bitmask (same as main app)
    const markingClass = markings => {
      const active = (markings || []).map((on, i) => on ? i : -1).filter(i => i >= 0);
      if (!active.length) return { cls: '', style: '' };
      const HUES = [200, 45, 123, 280, 80, 330];
      let sinSum = 0, cosSum = 0;
      active.forEach(i => { const r = HUES[i] * Math.PI / 180; sinSum += Math.sin(r); cosSum += Math.cos(r); });
      const hue = Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
      const count = active.length;
      return { cls: 'sh-active', style: 'background:hsl(' + hue + ',' + (44+count*4) + '%,' + (8.5+count*0.5) + '%);border-left-color:hsl(' + hue + ',70%,' + (57+count*2) + '%)' };
    };
    
    container.innerHTML = '';
    // Use first 5 real waza for marking demo
    realWaza.slice(0, 5).forEach((w, wi) => {
      const row = document.createElement('div');
      const markings = demoMarkings[wi];
      
      // Use real waza-compact structure with marking tint classes
      (function(){var _ms=markingClass(markings);row.className='waza-compact '+_ms.cls;row.setAttribute('style',_ms.style);})();
      
      // Structure: drn (JP name) + drs (EN name) + cmp-markings-mine (buttons)
      const markingsHTML = '<div class="cmp-markings-mine" style="flex-shrink:0">'
        + SHAPES.map((sh, si) => 
            '<button class="cmp-marking-btn' + (markings[si] ? ' on' : '') + '" '
            + 'data-wid="' + wi + '" data-si="' + si + '" '
            + 'title="' + (markingLabels[si] || 'Marking ' + (si + 1)) + '">'
            + sh + '</button>'
          ).join('')
        + '</div>';
      
      row.innerHTML = '<span class="drn">' + w.jp + '</span>'
        + '<span class="drs">' + w.en + '</span>'
        + markingsHTML;
      
      container.appendChild(row);
      
      // Attach click handlers to marking buttons
      row.querySelectorAll('.cmp-marking-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const wid = +btn.dataset.wid;
          const si = +btn.dataset.si;
          demoMarkings[wid][si] = !demoMarkings[wid][si];
          btn.classList.toggle('on', demoMarkings[wid][si]);
          // Update row's marking class for color tinting
          (function(){var _ms=markingClass(demoMarkings[wid]);row.className='waza-compact '+_ms.cls;row.setAttribute('style',_ms.style);})();
        });
      });
    });
  }
  
  // Remove updateMarkingRowStyle - no longer needed with waza-compact structure

  // ── Labels preview (slide 5) ──────────────────────────────────
  function buildLabelsPreview() {
    const container = document.getElementById('obLabelsPreview');
    if (!container) return;
    container.innerHTML = '';
    // Load existing labels from app
    let existing = ['','','','','',''];
    try { existing = JSON.parse(localStorage.getItem('wl_marking_labels') || '["","","","","",""]'); } catch {}
    SHAPES_OB.forEach((sh, i) => {
      const row = document.createElement('div');
      row.className = 'ob-labels-row';
      row.innerHTML = `<span class="ob-labels-marking">${sh}</span>`;
      const inp = document.createElement('input');
      inp.className = 'ob-labels-input';
      inp.type = 'text';
      inp.maxLength = 32;
      inp.placeholder = 'Label this marking…';
      inp.value = existing[i] || labelsValues[i] || '';
      inp.oninput = () => { labelsValues[i] = inp.value; };
      row.appendChild(inp);
      container.appendChild(row);
    });
  }

  function saveOnboardingLabels() {
    const inputs = document.querySelectorAll('#obLabelsPreview .ob-labels-input');
    const vals = Array.from(inputs).map(i => i.value.trim());
    if (window.markingLabels) {
      vals.forEach((v, i) => { window.markingLabels[i] = v; });
      if (typeof window.saveLabels === 'function') {
        window.saveLabels();
      } else {
        localStorage.setItem('wl_marking_labels', JSON.stringify(vals));
      }
    } else {
      localStorage.setItem('wl_marking_labels', JSON.stringify(vals));
    }
    if (typeof renderStats === 'function') renderStats();
  }

  // ── Apply template ────────────────────────────────────────────
  function applyTemplate() {
    const inputs = document.querySelectorAll('#obLabelsPreview .ob-labels-input');
    inputs.forEach((inp, i) => { inp.value = TEMPLATE[i] || ''; labelsValues[i] = inp.value; });
    saveOnboardingLabels();
  }

  // ── Clear all labels ──────────────────────────────────────────
  function clearAllLabels() {
    const inputs = document.querySelectorAll('#obLabelsPreview .ob-labels-input');
    inputs.forEach((inp, i) => { inp.value = ''; labelsValues[i] = ''; });
    saveOnboardingLabels();
  }

  // ── Close button ──────────────────────────────────────────────
  document.getElementById('obClose').onclick = closeOnboarding;

  // ── Trigger: show after new account registration ──────────────
  // We patch the register flow: after initApp() is called following register,
  // check a flag set by the register button.
  function patchRegister() {
    const rgBtn = document.getElementById('rg-btn');
    if (!rgBtn) { setTimeout(patchRegister, 300); return; }
    const originalOnclick = rgBtn.onclick;
    rgBtn.addEventListener('click', function() {
      window._wlJustRegistered = true;
    }, true); // capture phase so it fires before existing handler
  }

  // Patch initApp to show onboarding when _wlJustRegistered is true
  function patchInitApp() {
    if (typeof initApp !== 'function') { setTimeout(patchInitApp, 100); return; }
    const _orig = initApp;
    window.initApp = async function() {
      await _orig.apply(this, arguments);
      if (window._wlJustRegistered) {
        window._wlJustRegistered = false;
        // Show onboarding after registration
        setTimeout(showOnboarding, 600);
      }
    };
  }

  // Also expose a manual trigger for testing
  window.showWazaOnboarding = showOnboarding;

  // ── Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    patchRegister();
    patchInitApp();
  });
  // If DOM is already ready
  if (document.readyState !== 'loading') {
    patchRegister();
    patchInitApp();
  }

})();
