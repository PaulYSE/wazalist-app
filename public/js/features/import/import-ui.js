/* import-ui.js: UI rendering and event handling for the import feature */

import { state, tiState } from '../../state/state.js';
import { parseTextImport } from '../../lib/parser.js';
import { parseExcelFile } from './import-excel.js';
import { escapeHtml } from '../../lib/escape.js';
import { SHAPES } from '../../config/constants.js';
import { dispName } from '../../lib/search.js';
import { saveP, saveLabels } from '../../services/progress.js';
import { showToast } from '../../components/Toast.js';

export function renderImport() {
  const container = document.getElementById('dashImport');

  if (!tiState.parsed) {
    container.innerHTML = renderTiInput();
    bindTiInputEvents(container);
    return;
  }

  // ── Excel color mapping mode ──────────────────────────────────
  if (tiState.parsed === 'excel' && Object.keys(tiState.excelColors).length > 1) {
    const colorKeys = Object.keys(tiState.excelColors).filter(
      (c) => c !== 'FFFFFF' && c !== 'ffffff',
    );

    if (colorKeys.length > 0) {
      const colorMappingHtml =
        '<div>' +
        '<div class="dsec2"><h3>📊 Excel Colors Detected</h3></div>' +
        '<p style="font-size:13px;color:var(--text2);margin-bottom:16px">We found waza with different cell colors. Rename the label for each color and choose which marking to assign:</p>' +
        '<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">' +
        colorKeys
          .map((colorHex) => {
            const wazaCount = tiState.excelColors[colorHex].length;
            const rgb = hexToRgb(colorHex);
            const colorDisplay = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            return (
              '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r)">' +
              '<div style="width:40px;height:40px;flex-shrink:0;border-radius:var(--r);border:1px solid var(--border);background:' +
              colorDisplay +
              '"></div>' +
              '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' +
              '<input type="text" class="excel-color-label-input" data-color="' +
              colorHex +
              '" placeholder="Label name (e.g., Learning, Mastered...)" style="padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text1);font-size:13px;width:100%">' +
              '<div style="font-size:11px;color:var(--text3)">' +
              wazaCount +
              ' waza · #' +
              colorHex +
              '</div>' +
              '</div>' +
              '<select class="color-marking-map" data-color="' +
              colorHex +
              '" style="padding:6px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text1);font-size:13px;flex-shrink:0">' +
              '<option value="-1">No marking</option>' +
              SHAPES.map(
                (s, i) =>
                  '<option value="' +
                  i +
                  '">' +
                  s +
                  ' ' +
                  (state.markingLabels[i] || 'Marking ' + (i + 1)) +
                  '</option>',
              ).join('') +
              '</select>' +
              '</div>'
            );
          })
          .join('') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="cbtn cbtn-primary" id="tiApplyColorMapBtn">Apply Color Mapping →</button>' +
        '<button class="cbtn cbtn-ghost" id="tiCancelExcelBtn">← Cancel</button>' +
        '</div>' +
        '</div>';

      container.innerHTML = colorMappingHtml;

      // Bind color mapping events
      container.querySelector('#tiApplyColorMapBtn')?.addEventListener('click', async () => {
        // Read label names
        container.querySelectorAll('.excel-color-label-input').forEach((input) => {
          const color = input.dataset.color;
          const labelName = input.value.trim();
          if (labelName) {
            tiState.excelColorLabels[color] = labelName;
          }
        });

        // Read mappings
        container.querySelectorAll('.color-marking-map').forEach((select) => {
          const color = select.dataset.color;
          const markingIdx = parseInt(select.value);
          tiState.colorMapping[color] = markingIdx;
        });

        // Check if user wants to update their marking labels
        const hasLabelNames = Object.keys(tiState.excelColorLabels).length > 0;
        const usedMarkings = new Set(Object.values(tiState.colorMapping).filter((idx) => idx >= 0));

        if (hasLabelNames && usedMarkings.size > 0 && !state.isGuest && state.token) {
          // Build a list of changes
          const changes = [];
          for (const [color, markingIdx] of Object.entries(tiState.colorMapping)) {
            if (markingIdx >= 0 && tiState.excelColorLabels[color]) {
              const currentLabel = state.markingLabels[markingIdx] || '';
              const newLabel = tiState.excelColorLabels[color];
              if (currentLabel !== newLabel) {
                changes.push({
                  markingIdx,
                  oldLabel: currentLabel || '(empty)',
                  newLabel: newLabel,
                });
              }
            }
          }

          if (changes.length > 0) {
            const changesList = changes
              .map((c) => `${SHAPES[c.markingIdx]} ${c.oldLabel} → ${c.newLabel}`)
              .join('\n');

            const shouldUpdate = confirm(
              `Update your marking labels with the names you entered?\n\n${changesList}\n\nThis will save to your account and affect all your waza.`,
            );

            if (shouldUpdate) {
              // Update local marking labels
              for (const [color, markingIdx] of Object.entries(tiState.colorMapping)) {
                if (markingIdx >= 0 && tiState.excelColorLabels[color]) {
                  state.markingLabels[markingIdx] = tiState.excelColorLabels[color];
                }
              }

              // Save to server
              try {
                await saveLabels();
              } catch (err) {
                console.error('[COLOR MAP] Failed to save marking labels:', err);
                alert(
                  'Failed to save marking labels. Your selections will still be applied to this import.',
                );
              }
            }
          }
        }

        // Apply color mappings to matched waza
        tiState.matched.forEach((item) => {
          // Find which color this waza belongs to
          // Normalize both sides for comparison (trim whitespace)
          const normalizedRawLine = item.rawLine.trim();

          for (const [color, wazaNames] of Object.entries(tiState.excelColors)) {
            // Check if any of the waza names from this color match this item
            const matchFound = wazaNames.some((name) => name.trim() === normalizedRawLine);

            if (matchFound) {
              const markingIdx = tiState.colorMapping[color];

              if (markingIdx === -1) {
                // Explicitly clear all markings when "no marking" is selected
                item.manualMarkings = Array(6).fill(false);
                item.category = null;
              } else if (markingIdx >= 0 && markingIdx < 6) {
                item.manualMarkings = Array(6).fill(false);
                item.manualMarkings[markingIdx] = true;
                item.category = state.markingLabels[markingIdx] || `Marking ${markingIdx + 1}`;
              }
              break;
            }
          }
        });

        tiState.parsed = true; // Switch to normal mode
        tiState.previewMode = true; // Enable preview mode
        renderImport();
      });

      container.querySelector('#tiCancelExcelBtn')?.addEventListener('click', () => {
        tiState.parsed = false;
        tiState.excelColors = {};
        tiState.colorMapping = {};
        tiState.excelColorLabels = {};
        renderImport();
      });

      return;
    }
  }

  const hasCategories = tiState.foundLabels.length > 0 && tiState.matched.some((m) => m.category);

  // ── Unmatched section ────────────────────────────────────────
  const unmatchedHtml = tiState.unmatched.length
    ? '<div class="ti-section-head"><span>Not found in database</span><span class="ti-badge ti-badge-miss">' +
      tiState.unmatched.length +
      '</span></div>' +
      tiState.unmatched
        .map(
          (l) =>
            '<div class="ti-unmatched-row"><span class="ti-raw">' +
            escapeHtml(l) +
            '</span><span style="font-size:11px;color:var(--text3)">No match</span></div>',
        )
        .join('')
    : '';

  // ── Matched rows ─────────────────────────────────────────────
  const matchedHeaderHtml =
    '<div class="ti-section-head"><span>Matched waza</span><span class="ti-badge ti-badge-ok">' +
    tiState.matched.length +
    '</span></div>';

  const matchedRowsHtml = tiState.matched
    .map((item, idx) => {
      const lbl = item.category;
      const dispLbl = lbl ? tiState.labelNames[lbl] || lbl : null;
      const catBadge = dispLbl
        ? '<span class="ti-match-row ti-category-badge ti-cat-dynamic">' +
          escapeHtml(dispLbl) +
          '</span>'
        : '';
      const markingsBtns = SHAPES.map(
        (s, si) =>
          '<button class="cmp-marking-btn' +
          (item.manualMarkings[si] ? ' on' : '') +
          '" data-idx="' +
          idx +
          '" data-si="' +
          si +
          '">' +
          s +
          '</button>',
      ).join('');
      return (
        '<div class="ti-match-row" data-idx="' +
        idx +
        '">' +
        '<div class="ti-names"><div class="ti-njp">' +
        escapeHtml(item.waza.name_jp || '—') +
        '</div>' +
        '<div class="ti-nen">' +
        escapeHtml(dispName(item.waza)) +
        '</div>' +
        (catBadge ? '<div style="margin-top:4px">' + catBadge + '</div>' : '') +
        '</div>' +
        '<div class="ti-manual-markings">' +
        markingsBtns +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  // ── Auto-mapping section (labels-style) ───────────────────────
  let autoMapHtml = '';
  if (hasCategories) {
    const mapRows = tiState.foundLabels
      .map((lbl) => {
        const assigned = tiState.autoMapping[lbl] !== undefined ? tiState.autoMapping[lbl] : -1;
        const dispName_ =
          tiState.labelNames[lbl] !== undefined ? tiState.labelNames[lbl] : lbl.slice(1, -1);
        const markingBtns = SHAPES.map(
          (s, si) =>
            '<button class="ti-map-marking-btn' +
            (assigned === si ? ' on' : '') +
            '" data-lbl="' +
            escapeHtml(lbl) +
            '" data-si="' +
            si +
            '">' +
            s +
            '</button>',
        ).join('');
        return (
          '<div class="labels-row">' +
          '<span class="labels-marking" style="font-size:13px;color:var(--text3);width:auto;min-width:20px">' +
          escapeHtml(lbl[0]) +
          escapeHtml(lbl[lbl.length - 1]) +
          '</span>' +
          '<input class="labels-input ti-label-name-input" data-lbl="' +
          escapeHtml(lbl) +
          '" type="text" maxlength="40" placeholder="Label name…" value="' +
          escapeHtml(dispName_) +
          '">' +
          '<div class="ti-map-markings">' +
          markingBtns +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    const wazaCountPerLabel = {};
    tiState.foundLabels.forEach((l) => {
      wazaCountPerLabel[l] = tiState.matched.filter((m) => m.category === l).length;
    });
    const countsNote = tiState.foundLabels
      .map(
        (l) =>
          '<span style="font-size:11px;color:var(--text3)">' +
          escapeHtml(tiState.labelNames[l] || l.slice(1, -1)) +
          ': ' +
          wazaCountPerLabel[l] +
          ' waza</span>',
      )
      .join(' &nbsp;·&nbsp; ');

    autoMapHtml =
      '<div class="ti-auto-mapping">' +
      '<h4>Auto-import: map labels to markings</h4>' +
      '<p style="font-size:12px;color:var(--text3);margin-bottom:10px">Rename labels and choose which marking each maps to. Click a marking to assign, click again to unassign.</p>' +
      '<div style="margin-bottom:10px;line-height:2">' +
      countsNote +
      '</div>' +
      mapRows +
      '</div>';
  }

  // ── Actions ──────────────────────────────────────────────────
  let previewBannerHtml = '';
  let actionsHtml;

  if (tiState.previewMode) {
    // In preview mode - show banner at top and commit/cancel buttons at bottom
    previewBannerHtml =
      '<div style="background:var(--bg2);border:1px solid var(--accent);border-radius:var(--r);padding:12px;margin-bottom:16px">' +
      '<p style="font-size:13px;color:var(--accent);margin-bottom:8px">✨ <b>Preview Mode:</b> Auto-labels have been applied to the markings below.</p>' +
      '<p style="font-size:12px;color:var(--text2)">Review and adjust the marked markings. Scroll down and click <b>Commit</b> when ready, or <b>Clear Preview</b> to start over.</p>' +
      '</div>';

    actionsHtml =
      '<div class="ti-actions">' +
      '<button class="cbtn cbtn-primary" id="tiCommitBtn">✓ Commit Markings to Database</button>' +
      '<button class="cbtn cbtn-ghost" id="tiClearPreviewBtn">✕ Clear Preview</button>' +
      '<button class="cbtn cbtn-ghost" id="tiResetBtn">← Back / Re-paste</button>' +
      '</div>';
  } else {
    // Normal mode - show auto-import and manual import buttons
    actionsHtml =
      '<div class="ti-actions">' +
      (hasCategories
        ? '<button class="cbtn cbtn-primary" id="tiAutoImportBtn">⚡ Preview Auto-Labels</button>'
        : '') +
      '<button class="cbtn cbtn-primary" id="tiManualImportBtn">✓ Apply Manual Markings</button>' +
      '<button class="cbtn cbtn-ghost" id="tiResetBtn">← Back / Re-paste</button>' +
      '</div>';
  }

  container.innerHTML =
    previewBannerHtml +
    unmatchedHtml +
    matchedHeaderHtml +
    matchedRowsHtml +
    (hasCategories && !tiState.previewMode ? autoMapHtml : '') +
    actionsHtml;

  // Manual marking toggles
  container.querySelectorAll('.ti-manual-markings .cmp-marking-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.idx,
        si = +btn.dataset.si;
      tiState.matched[idx].manualMarkings[si] = !tiState.matched[idx].manualMarkings[si];
      btn.classList.toggle('on', tiState.matched[idx].manualMarkings[si]);
    });
  });

  // Label name inputs
  container.querySelectorAll('.ti-label-name-input').forEach((inp) => {
    inp.addEventListener('input', () => {
      tiState.labelNames[inp.dataset.lbl] = inp.value;
      // Update badges in matched rows without full re-render
      container.querySelectorAll('.ti-match-row').forEach((row) => {
        const idx2 = +row.dataset.idx;
        if (isNaN(idx2)) return;
        const item = tiState.matched[idx2];
        if (item && item.category === inp.dataset.lbl) {
          const badge = row.querySelector('.ti-cat-dynamic');
          if (badge) badge.textContent = inp.value || inp.dataset.lbl.slice(1, -1);
        }
      });
    });
  });

  // Auto-map marking selectors
  container.querySelectorAll('.ti-map-marking-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lbl = btn.dataset.lbl,
        si = +btn.dataset.si;
      tiState.autoMapping[lbl] = tiState.autoMapping[lbl] === si ? -1 : si;
      // Update only the marking buttons in this row
      const row = btn.closest('.labels-row');
      row.querySelectorAll('.ti-map-marking-btn').forEach((b, bsi) => {
        b.classList.toggle('on', tiState.autoMapping[lbl] === bsi);
      });
    });
  });

  // Auto import (now preview mode)
  container.querySelector('#tiAutoImportBtn')?.addEventListener('click', () => {
    // Apply auto-mapping to manualMarkings as a preview
    for (const item of tiState.matched) {
      const si =
        item.category != null
          ? tiState.autoMapping[item.category] !== undefined
            ? tiState.autoMapping[item.category]
            : -1
          : -1;
      // Reset manual markings first
      item.manualMarkings = Array(6).fill(false);
      // Apply the auto-detected label
      if (si >= 0) item.manualMarkings[si] = true;
    }
    tiState.previewMode = true;
    renderImport();
    // Scroll to top where preview banner is
    setTimeout(() => {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  // Manual import
  container.querySelector('#tiManualImportBtn')?.addEventListener('click', async () => {
    let count = 0;
    for (const item of tiState.matched) {
      if (item.manualMarkings.some(Boolean)) {
        // REPLACE markings entirely (don't merge with existing)
        const newMarkings = [...item.manualMarkings];
        await saveP(item.waza.id, { markings: newMarkings });
        count++;
      }
    }
    if (count) {
      showToast('Applied markings to ' + count + ' waza!', 'green');
      tiState.parsed = false;
      tiState.previewMode = false;
      tiState.foundLabels = [];
      tiState.autoMapping = {};
      tiState.labelNames = {};
      renderImport();
    } else {
      showToast('No markings were toggled on — toggle at least one marking per waza.', 'amber');
    }
  });

  // Commit preview (save to database)
  container.querySelector('#tiCommitBtn')?.addEventListener('click', async () => {
    let count = 0;
    for (const item of tiState.matched) {
      if (item.manualMarkings.some(Boolean)) {
        // REPLACE markings entirely (don't merge with existing)
        const newMarkings = [...item.manualMarkings];
        await saveP(item.waza.id, { markings: newMarkings });
        count++;
      }
    }

    if (count) {
      showToast('Committed ' + count + ' waza markings to database!', 'green');
      tiState.parsed = false;
      tiState.previewMode = false;
      tiState.foundLabels = [];
      tiState.autoMapping = {};
      tiState.labelNames = {};
      renderImport();
    } else {
      showToast('No markings were marked — adjust the markings or clear preview.', 'amber');
    }
  });

  // Clear preview (reset manualMarkings back to empty, return to label mapping UI)
  container.querySelector('#tiClearPreviewBtn')?.addEventListener('click', () => {
    // Clear all manual markings
    tiState.matched.forEach((item) => {
      item.manualMarkings = Array(6).fill(false);
    });
    tiState.previewMode = false;
    renderImport();
    // Scroll to auto-mapping section
    setTimeout(() => {
      const autoMapSection = container.querySelector('.ti-auto-mapping');
      if (autoMapSection) autoMapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  // Reset
  container.querySelector('#tiResetBtn')?.addEventListener('click', () => {
    tiState.parsed = false;
    tiState.previewMode = false;
    tiState.foundLabels = [];
    tiState.autoMapping = {};
    tiState.labelNames = {};
    renderImport();
  });
}

function renderTiInput() {
  return (
    '<div style="display:flex;flex-direction:column;height:100%">' +
    // ── Import from Excel ──────────────────────────────────────
    '<div class="dsec2"><h3>📊 Import from Excel</h3></div>' +
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:20px">' +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:12px">Upload your Excel file with colored cells. Cell colors will be detected and mapped to your markings.</p>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
    '<input type="file" id="tiFileInput" accept=".xlsx,.xls" style="display:none">' +
    '<button class="cbtn cbtn-primary" id="tiFileBtn">📁 Choose File</button>' +
    '<span id="tiFileName" style="font-size:13px;color:var(--text3)">No file selected</span>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:12px;color:var(--text3)">✓ Preserves cell colors &nbsp; ✓ Automatic proficiency mapping</div>' +
    '</div>' +
    // ── Import from Text ───────────────────────────────────────
    '<div class="dsec2"><h3>📋 Import from Text</h3></div>' +
    '<div style="flex:1;display:flex;flex-direction:column;min-height:0">' +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:12px">Paste a list of waza names (one per line). Labels in <b>[ ]</b>, <b>{ }</b>, or <b>( )</b> are detected as categories.</p>' +
    '<textarea class="ti-textarea" id="tiPasteArea" placeholder="Paste your waza list here…\n\nSupported label formats:\n[Learning]\nDouble Rainbow (ダブルレインボー)\nMix\n\n{Performance Ready}\nNami (波)\n\nHyper Mix (ハイパーミックス)"></textarea>' +
    '<div class="ti-hint">Labels can be section headers on their own line, or placed inline next to a waza name. All bracket styles are supported: <code>[label]</code> <code>{label}</code> <code>(label)</code></div>' +
    '<div style="margin-top:12px;display:flex;gap:8px">' +
    '<button class="cbtn cbtn-primary" id="tiParseBtn">Analyse List \u2192</button>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

function bindTiInputEvents(container) {
  // Text paste handler
  container.querySelector('#tiParseBtn')?.addEventListener('click', () => {
    const text = container.querySelector('#tiPasteArea')?.value || '';
    if (!text.trim()) {
      showToast('Paste some waza names first.', 'amber');
      return;
    }
    parseTextImport(text);
    renderImport();
  });

  // Excel file upload handlers
  const fileInput = container.querySelector('#tiFileInput');
  const fileBtn = container.querySelector('#tiFileBtn');
  const fileName = container.querySelector('#tiFileName');

  fileBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileName.textContent = file.name;
    fileName.style.color = 'var(--text1)';

    try {
      // Check if XLSX library is loaded
      if (typeof XLSX === 'undefined') {
        throw new Error('Excel library not loaded. Please refresh the page and try again.');
      }
      await parseExcelFile(file);
      renderImport();
    } catch (err) {
      console.error('Excel parse error:', err);
      const errorMsg = err.message || 'Error reading Excel file. Please try text paste instead.';
      showToast(errorMsg, 'red');
    }
  });
}

function hexToRgb(hex) {
  // Remove # if present and handle 6-digit hex
  hex = hex.replace('#', '');
  if (hex.length === 8) hex = hex.substring(0, 6); // Remove alpha if present
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}
