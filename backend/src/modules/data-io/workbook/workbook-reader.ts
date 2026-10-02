import ExcelJS from 'exceljs';
import {
  CAR_HEADER_FIELDS,
  CarRow,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
  EXPENSE_HEADER_ROW,
  ExpenseColumn,
  ExpenseRow,
  MAX_CAR_SHEETS,
  MAX_EXPENSE_ROWS,
  ParsedCarSheet,
  ParsedExpense,
  READ_ME_SHEET_NAME,
} from './workbook-columns';
import { coerceString, isBlank, validateCell } from './workbook-validators';

export interface ImportIssue {
  sheet: string;
  row?: number;
  // A1-style reference ("C23"), when the issue is about one cell.
  cell?: string;
  message: string;
}

export interface ReadWorkbookResult {
  sheets: ParsedCarSheet[];
  // Any error means nothing may be imported (the service enforces this).
  errors: ImportIssue[];
  // Imported anyway; reported so the user knows what was adjusted.
  warnings: ImportIssue[];
}

export class WorkbookParseError extends Error {}

const REQUIRED_EXPENSE_KEYS = EXPENSE_COLUMNS.filter((c) => c.required).map(
  (c) => c.key,
);
const CAR_ID_ROW = CAR_HEADER_FIELDS.find((f) => f.key === 'carId')!.row;

function colLetter(col: number): string {
  let letters = '';
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

// Recognize the common wrong uploads by their first bytes, so the user gets a
// specific fix instead of a generic "couldn't read it".
function assertLooksLikeXlsx(buffer: Buffer) {
  const isZip = buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (isZip) return;
  const isOle =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  if (isOle) {
    throw new WorkbookParseError(
      'This looks like an old .xls file or a password-protected workbook. Open it in Excel, remove any password, and save it as .xlsx (Excel Workbook) before importing.',
    );
  }
  throw new WorkbookParseError(
    'This isn’t an Excel .xlsx file (it may be a CSV or another format renamed to .xlsx). Open it in Excel and save it as .xlsx (Excel Workbook) before importing.',
  );
}

function sheetHasValues(sheet: ExcelJS.Worksheet): boolean {
  let found = false;
  sheet.eachRow((row) => {
    if (found) return;
    row.eachCell((cell) => {
      if (!isBlank(cell.value)) found = true;
    });
  });
  return found;
}

export async function readWorkbook(
  buffer: Buffer,
  now: Date = new Date(),
): Promise<ReadWorkbookResult> {
  assertLooksLikeXlsx(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new WorkbookParseError(
      'This .xlsx file couldn’t be read — it may be damaged. Open it in Excel, save it again, and retry.',
    );
  }

  // A stray empty "Sheet1" is harmless, so skip blank sheets silently.
  const carSheets = workbook.worksheets.filter(
    (ws) =>
      ws.name.trim().toLowerCase() !== READ_ME_SHEET_NAME.toLowerCase() &&
      sheetHasValues(ws),
  );
  if (carSheets.length === 0) {
    throw new WorkbookParseError('The workbook has no car sheets to import.');
  }
  if (carSheets.length > MAX_CAR_SHEETS) {
    throw new WorkbookParseError(
      `The workbook has ${carSheets.length} car sheets — at most ${MAX_CAR_SHEETS} can be imported at once. Split it into smaller files.`,
    );
  }

  const result: ReadWorkbookResult = { sheets: [], errors: [], warnings: [] };
  const carIdSheets = new Map<string, string>();
  const expenseIdRows = new Map<string, { sheet: string; row: number }>();

  // Every sheet and row is checked even after errors are found, so the user
  // gets the complete list in one go rather than one fix per upload.
  for (const sheet of carSheets) {
    const header = readCarHeader(sheet, result.errors, now);
    const isExistingCar = header !== undefined && 'existingCarId' in header;
    if (isExistingCar) {
      const firstSheet = carIdSheets.get(header.existingCarId);
      if (firstSheet) {
        result.errors.push({
          sheet: sheet.name,
          message: `This sheet is a copy of "${firstSheet}" (the same car). Delete one of them — to add expenses, add rows to the original sheet.`,
        });
      } else {
        carIdSheets.set(header.existingCarId, sheet.name);
      }
    }

    const expenses = readExpenseRows(
      sheet,
      isExistingCar,
      expenseIdRows,
      result,
      now,
    );
    if (header) {
      result.sheets.push({ sheetName: sheet.name, expenses, ...header });
    }
  }

  return result;
}

function readCarHeader(
  sheet: ExcelJS.Worksheet,
  errors: ImportIssue[],
  now: Date,
): { existingCarId: string } | { newCar: Omit<CarRow, 'carId'> } | undefined {
  // An existing car's details aren't read at all — they're locked in exports
  // and cars are edited in the app — so a sheet someone unprotected and
  // scribbled on can't block its expenses from importing.
  const existingCarId = coerceString(sheet.getCell(CAR_ID_ROW, 2).value);
  if (existingCarId) return { existingCarId };

  const car: Record<string, unknown> = {};
  let valid = true;
  for (const field of CAR_HEADER_FIELDS) {
    if (field.key === 'carId') continue;
    const { value, error } = validateCell(
      sheet.getCell(field.row, 2).value,
      field,
      now,
    );
    if (error) {
      valid = false;
      errors.push({
        sheet: sheet.name,
        row: field.row,
        cell: `B${field.row}`,
        message: error,
      });
    } else if (value !== undefined) {
      car[field.key] = value;
    }
  }
  return valid ? { newCar: car as Omit<CarRow, 'carId'> } : undefined;
}

// Maps each expense field to the column it actually lives in, by matching the
// header row's labels — so files exported with an older column order (e.g.
// Expense ID in column A) still import. Once any label matches, the header is
// authoritative and an unmatched field is read as blank: falling back to its
// current position would read some other field's column in an older layout.
// Only a sheet with no recognizable header uses the current positions.
function resolveExpenseColumns(
  sheet: ExcelJS.Worksheet,
): Array<ExpenseColumn & { sourceCol?: number }> {
  const known = new Set(EXPENSE_COLUMNS.map((c) => c.label.toLowerCase()));
  const colByLabel = new Map<string, number>();
  sheet.getRow(EXPENSE_HEADER_ROW).eachCell((cell, colNumber) => {
    const label = coerceString(cell.value)?.toLowerCase();
    if (label && known.has(label) && !colByLabel.has(label)) {
      colByLabel.set(label, colNumber);
    }
  });
  return EXPENSE_COLUMNS.map((c) => ({
    ...c,
    sourceCol:
      colByLabel.size > 0 ? colByLabel.get(c.label.toLowerCase()) : c.col,
  }));
}

function cellValue(
  sheet: ExcelJS.Worksheet,
  row: number,
  col: number | undefined,
): ExcelJS.CellValue {
  return col === undefined ? null : sheet.getCell(row, col).value;
}

function readExpenseRows(
  sheet: ExcelJS.Worksheet,
  isExistingCar: boolean,
  expenseIdRows: Map<string, { sheet: string; row: number }>,
  result: ReadWorkbookResult,
  now: Date,
): ParsedExpense[] {
  const columns = resolveExpenseColumns(sheet);
  const visibleColumns = columns.filter((c) => c.key !== 'expenseId');
  const expenses: ParsedExpense[] = [];

  // A renamed or deleted header would otherwise surface as "X is required"
  // on every single row — report it once instead.
  const missing = columns.filter(
    (c) => REQUIRED_EXPENSE_KEYS.includes(c.key) && c.sourceCol === undefined,
  );
  if (missing.length > 0) {
    result.errors.push({
      sheet: sheet.name,
      row: EXPENSE_HEADER_ROW,
      message: `The expense table is missing the ${missing.map((c) => `"${c.label}"`).join(', ')} column${missing.length === 1 ? '' : 's'} (header row ${EXPENSE_HEADER_ROW}). Restore the header from the template.`,
    });
    return expenses;
  }

  const lastScannedRow = EXPENSE_DATA_START_ROW + MAX_EXPENSE_ROWS - 1;
  for (let row = lastScannedRow + 1; row <= sheet.rowCount; row++) {
    if (
      visibleColumns.some((c) => !isBlank(cellValue(sheet, row, c.sourceCol)))
    ) {
      result.errors.push({
        sheet: sheet.name,
        row,
        message: `Only ${MAX_EXPENSE_ROWS} expense rows per sheet are supported (rows ${EXPENSE_DATA_START_ROW}–${lastScannedRow}). Move the extra rows into a separate file.`,
      });
      break;
    }
  }

  for (let row = EXPENSE_DATA_START_ROW; row <= lastScannedRow; row++) {
    // The hidden Expense ID doesn't count: a row whose visible cells were
    // all cleared is a deleted row, not an invalid one.
    if (
      visibleColumns.every((c) => isBlank(cellValue(sheet, row, c.sourceCol)))
    ) {
      continue;
    }

    const expense: Record<string, unknown> = {};
    let valid = true;
    const push = (list: ImportIssue[], message: string, col?: number) =>
      list.push({
        sheet: sheet.name,
        row,
        ...(col !== undefined && { cell: `${colLetter(col)}${row}` }),
        message,
      });

    for (const col of columns) {
      const { value, error } = validateCell(
        cellValue(sheet, row, col.sourceCol),
        col,
        now,
      );
      if (error) {
        valid = false;
        push(result.errors, error, col.sourceCol);
      } else if (value !== undefined) {
        expense[col.key] = value;
      }
    }

    const category = expense.category as string | undefined;
    if (category) {
      for (const col of columns) {
        if (
          col.categories &&
          expense[col.key] !== undefined &&
          !col.categories.includes(category)
        ) {
          delete expense[col.key];
          push(
            result.warnings,
            `"${col.label}" is only used for ${col.categories.join('/')} expenses, not ${category} — it was ignored`,
            col.sourceCol,
          );
        }
      }
    }

    if (
      (expense.litres === undefined) !==
      (expense.fuelPricePerLitre === undefined)
    ) {
      valid = false;
      push(
        result.errors,
        '"Litres" and "Fuel Price/Litre" must both be filled in, or both left blank',
      );
    }

    const expenseId = expense.expenseId as string | undefined;
    if (expenseId) {
      const first = expenseIdRows.get(expenseId);
      if (first) {
        valid = false;
        push(
          result.errors,
          `This row is a copy of "${first.sheet}" row ${first.row} (same hidden Expense ID). Delete one of them — to add a similar expense, type it into a blank row instead of copying.`,
        );
      } else {
        expenseIdRows.set(expenseId, { sheet: sheet.name, row });
      }
      if (!isExistingCar) {
        valid = false;
        push(
          result.errors,
          'This row was copied from an exported file, but this sheet is a new car. Type the expense into a blank row instead of copying it.',
        );
      }
    }

    if (valid) {
      expenses.push({ row, expense: expense as unknown as ExpenseRow });
    }
  }

  return expenses;
}
