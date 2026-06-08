/**
 * @file export-to-excel.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Excel export feature. Collects user's marked waza, generates an .xlsx file with hyperlinks and cell colors, and triggers download.
 */

import { state } from '../state/state.js';
import { showToast } from '../components/show-toast.js';
import { SHAPES, EXPORT_MARK_COLORS } from '../config/constants.js';

/**
 * @brief Selects the best video URL for Excel hyperlink.
 *
 * Prioritizes video1, then falls back to video0 or any available video.
 *
 * @param {Object} w - Waza object with video0..video9 fields.
 * @return {string} Video URL or empty string if none exists.
 */
function pickVideoUrl(w) {
  // User asked for video1; fall back to the first available video so links aren't broken.
  return w.video1 || w.video0 || w.video2 || w.video3 || w.video4 || w.video5 || '';
}

/**
 * @brief Exports the user's marked waza to an Excel file.
 *
 * Collects all waza with at least one active marking, generates an Excel workbook
 * with hyperlinked waza names, cell colors based on the first active marking,
 * and a color legend. Triggers browser download.
 *
 * @return {Promise<void>}
 */
export async function exportToExcel() {
  const btn = document.getElementById('exportXlsxBtn');
  const status = document.getElementById('exportXlsxStatus');
  const setStatus = (msg, color) => {
    if (status) {
      status.textContent = msg;
      status.style.color = color || 'var(--text3)';
    }
  };

  // Check if ExcelJS library is available
  if (typeof ExcelJS === 'undefined') {
    setStatus('Excel library not loaded — please refresh and try again.', 'var(--red)');
    return;
  }

  // Collect every waza the user has marked (at least one active marking).
  const rows = [];
  state.wazaData.forEach((w) => {
    const p = state.prog[w.id];
    const markings = (p && p.markings) || null;
    if (!markings || !markings.some(Boolean)) return;
    const firstMark = markings.findIndex(Boolean); // colour by first active marking
    rows.push({ waza: w, firstMark });
  });

  if (!rows.length) {
    setStatus('Nothing to export — mark some waza first.', 'var(--amber)');
    return;
  }

  const headerName = !state.isGuest && state.currentUsername ? state.currentUsername : 'Guest';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Generating…';
  }
  setStatus('');

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Wazalist';
    wb.created = new Date();
    const ws = wb.addWorksheet('Wazalist');
    ws.getColumn(1).width = 52;

    // Header = username (or Guest)
    const head = ws.getCell('A1');
    head.value = headerName;
    head.font = { bold: true, size: 14 };

    // Track which markings actually appear, for the legend
    const usedMarks = new Set();

    let r = 2;
    rows.forEach(({ waza: w, firstMark }) => {
      const en = (w.name_en || w.name_en_literal || w.name_en_gtranslate || '').trim();
      const jp = (w.name_jp || '').trim();
      let disp = en && jp ? `${en}(${jp})` : en || jp || 'Waza #' + w.id;
      const url = pickVideoUrl(w);

      const cell = ws.getCell('A' + r);
      if (url) {
        // =HYPERLINK("url","name_en(name_jp)") — escape any double quotes for the formula
        const fUrl = url.replace(/"/g, '""');
        const fDisp = disp.replace(/"/g, '""');
        cell.value = { formula: `HYPERLINK("${fUrl}","${fDisp}")` };
        cell.font = { color: { argb: 'FF1A1A1A' }, underline: true };
      } else {
        cell.value = disp;
        cell.font = { color: { argb: 'FF1A1A1A' } };
      }

      // Cell colour based on the active marking
      const argb = EXPORT_MARK_COLORS[firstMark] || 'FFFFFFFF';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      usedMarks.add(firstMark);
      r++;
    });

    // Legend (a couple of rows below the list) so the colours have meaning
    r += 1;
    ws.getCell('A' + r).value = 'Legend';
    ws.getCell('A' + r).font = { bold: true, color: { argb: 'FF777777' } };
    r++;
    [...usedMarks]
      .sort((a, b) => a - b)
      .forEach((mi) => {
        const label = (state.markingLabels[mi] || '').trim() || 'Marking ' + (mi + 1);
        const cell = ws.getCell('A' + r);
        cell.value = `${SHAPES[mi]}  ${label}`;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXPORT_MARK_COLORS[mi] },
        };
        cell.font = { color: { argb: 'FF1A1A1A' } };
        r++;
      });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = headerName.replace(/[^\w-]+/g, '_');
    a.href = dlUrl;
    a.download = `wazalist_${safeName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(dlUrl), 2000);

    setStatus(`Exported ${rows.length} waza.`, 'var(--green)');
    showToast(`Exported ${rows.length} waza to Excel.`, 'green');
  } catch (e) {
    console.error('Export error:', e);
    setStatus('Export failed — please try again.', 'var(--red)');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⬇️ Export to Excel';
    }
  }
}
