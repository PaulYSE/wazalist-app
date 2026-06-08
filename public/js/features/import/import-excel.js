/**
 * @file import-excel.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Excel file parsing module. Extracts text and cell background colors for color-based marking auto-mapping during import.
 */

import { tiState } from '../../state/state.js';
import { parseTextImport } from '../../lib/parser.js';

/**
 * @brief Parses an Excel file and extracts text content with cell color information.
 *
 * Reads the first sheet of the uploaded Excel file, captures cell text and background colors,
 * groups text by color for potential marking auto-mapping, then passes the combined text
 * to the text parser for waza matching.
 *
 * @param {File} file - The uploaded Excel file (.xlsx, .xls).
 * @return {Promise<void>}
 */
export async function parseExcelFile(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(firstSheet['!ref']);

  tiState.excelColors = {};
  const allLines = [];

  // Read cells with color information
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = firstSheet[cellAddr];

      // Skip empty cells
      if (!cell || !cell.v) continue;

      const text = String(cell.v).trim();
      if (!text) continue;

      // Extract fill color (if any)
      let fillColor = 'FFFFFF'; // default white
      if (cell.s && cell.s.fgColor && cell.s.fgColor.rgb) {
        fillColor = cell.s.fgColor.rgb;
      } else if (cell.s && cell.s.bgColor && cell.s.bgColor.rgb) {
        fillColor = cell.s.bgColor.rgb;
      }

      // Group by color
      if (!tiState.excelColors[fillColor]) tiState.excelColors[fillColor] = [];
      tiState.excelColors[fillColor].push(text);
      allLines.push(text);
    }
  }

  // If we detected colors other than white, show color mapping UI
  const colorKeys = Object.keys(tiState.excelColors).filter(
    (c) => c !== 'FFFFFF' && c !== 'ffffff',
  );
  if (colorKeys.length > 0) {
    // Parse the text to match waza
    parseTextImport(allLines.join('\n'));
    tiState.parsed = 'excel'; // Special mode for color mapping
  } else {
    // No colors detected, treat as regular text import
    parseTextImport(allLines.join('\n'));
  }
}
