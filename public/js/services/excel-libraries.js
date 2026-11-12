/**
 * @file services/excel-libraries.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-11-09
 * @fileoverview Loads SheetJS and ExcelJS on demand.
 *
 * The libraries are not part of the initial application load. SheetJS is
 * loaded when the user selects an Excel file for import. ExcelJS is loaded
 * when the user requests an Excel export.
 */

const SHEETJS_SCRIPT_ID = 'wazalist-sheetjs';
const EXCELJS_SCRIPT_ID = 'wazalist-exceljs';

const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';

const EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';

/** @type {?Promise<void>} */
let sheetJsLoadPromise = null;

/** @type {?Promise<void>} */
let excelJsLoadPromise = null;

/**
 * Loads a classic script and verifies that its expected global exists.
 *
 * Reuses an existing script element when one is already loading. Removes
 * a failed script element so a later user action can retry the download.
 *
 * @param {string} id Unique script-element ID.
 * @param {string} src Script URL.
 * @param {function(): boolean} isAvailable Checks whether the expected
 *     library global is available.
 * @param {string} libraryName Human-readable library name for errors.
 * @return {!Promise<void>} Resolves when the library is available.
 */
function loadClassicScript(id, src, isAvailable, libraryName) {
  if (isAvailable()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);

    if (existing) {
      existing.addEventListener(
        'load',
        () => {
          if (isAvailable()) {
            resolve();
          } else {
            reject(new Error(libraryName + ' downloaded but did not initialize correctly.'));
          }
        },
        { once: true },
      );

      existing.addEventListener(
        'error',
        () => {
          existing.remove();

          reject(
            new Error(
              'Could not download ' + libraryName + '. Check your connection and try again.',
            ),
          );
        },
        { once: true },
      );

      return;
    }

    const script = document.createElement('script');

    script.id = id;
    script.src = src;
    script.async = true;

    script.addEventListener(
      'load',
      () => {
        if (isAvailable()) {
          resolve();
          return;
        }

        script.remove();

        reject(new Error(libraryName + ' downloaded but did not initialize correctly.'));
      },
      { once: true },
    );

    script.addEventListener(
      'error',
      () => {
        script.remove();

        reject(
          new Error('Could not download ' + libraryName + '. Check your connection and try again.'),
        );
      },
      { once: true },
    );

    document.head.appendChild(script);
  });
}

/**
 * Loads SheetJS if it is not already available.
 *
 * Concurrent callers share one download. A failed download clears the
 * cached promise so a later import attempt can retry.
 *
 * @return {!Promise<void>} Resolves when globalThis.XLSX is available.
 */
export function loadSheetJs() {
  if (globalThis.XLSX) {
    return Promise.resolve();
  }

  if (!sheetJsLoadPromise) {
    sheetJsLoadPromise = loadClassicScript(
      SHEETJS_SCRIPT_ID,
      SHEETJS_URL,
      () => typeof globalThis.XLSX !== 'undefined',
      'the Excel import library',
    ).catch((error) => {
      sheetJsLoadPromise = null;
      throw error;
    });
  }

  return sheetJsLoadPromise;
}

/**
 * Loads ExcelJS if it is not already available.
 *
 * Concurrent callers share one download. A failed download clears the
 * cached promise so a later export attempt can retry.
 *
 * @return {!Promise<void>} Resolves when globalThis.ExcelJS is available.
 */
export function loadExcelJs() {
  if (globalThis.ExcelJS) {
    return Promise.resolve();
  }

  if (!excelJsLoadPromise) {
    excelJsLoadPromise = loadClassicScript(
      EXCELJS_SCRIPT_ID,
      EXCELJS_URL,
      () => typeof globalThis.ExcelJS !== 'undefined',
      'the Excel export library',
    ).catch((error) => {
      excelJsLoadPromise = null;
      throw error;
    });
  }

  return excelJsLoadPromise;
}
