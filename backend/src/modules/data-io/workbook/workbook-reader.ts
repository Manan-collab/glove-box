import ExcelJS from 'exceljs';
import {
  CAR_HEADER_FIELDS,
  CarRow,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
  EXPENSE_HEADER_ROW,
  ExpenseColumn,
  ExpenseRow,
  MAX_EXPENSE_ROWS,
  ParsedCarSheet,
  READ_ME_SHEET_NAME,
} from './workbook-columns';
import {
  coerceDate,
  coerceNumber,
  coerceString,
  matchEnum,
} from './workbook-validators';

export interface RowErrorLike {
  sheet: string;
  row?: number;
  message: string;
}

export interface ReadWorkbookResult {
  sheets: ParsedCarSheet[];
  errors: RowErrorLike[];
}

export class WorkbookParseError extends Error {}

export async function readWorkbook(
  buffer: Buffer,
): Promise<ReadWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new WorkbookParseError(
      'The uploaded file is not a readable .xlsx workbook.',
    );
  }

  const usableSheets = workbook.worksheets.filter(
    (ws) => ws.name.trim().toLowerCase() !== READ_ME_SHEET_NAME.toLowerCase(),
  );
  if (usableSheets.length === 0) {
    throw new WorkbookParseError('The workbook has no car sheets to import.');
  }

  const sheets: ParsedCarSheet[] = [];
  const errors: RowErrorLike[] = [];

  for (const sheet of usableSheets) {
    const { car, carErrors } = readCarHeader(sheet);
    if (carErrors.length > 0) {
      for (const message of carErrors) {
        errors.push({ sheet: sheet.name, message });
      }
      continue;
    }

    const { expenses, expenseErrors } = readExpenseRows(sheet);
    errors.push(...expenseErrors.map((e) => ({ ...e, sheet: sheet.name })));
    sheets.push({ sheetName: sheet.name, car: car!, expenses });
  }

  return { sheets, errors };
}

function readCarHeader(sheet: ExcelJS.Worksheet): {
  car?: CarRow;
  carErrors: string[];
} {
  const carErrors: string[] = [];
  const car: Partial<CarRow> = {};

  for (const field of CAR_HEADER_FIELDS) {
    const raw = sheet.getCell(field.row, 2).value;

    if (field.type === 'number') {
      const { value, invalid } = coerceNumber(raw);
      if (invalid) {
        carErrors.push(`"${field.label}" must be a number`);
      } else if (value === undefined) {
        if (field.required) carErrors.push(`"${field.label}" is required`);
      } else if (field.min !== undefined && value < field.min) {
        carErrors.push(`"${field.label}" must be at least ${field.min}`);
      } else if (field.max !== undefined && value > field.max) {
        carErrors.push(`"${field.label}" must be at most ${field.max}`);
      } else {
        (car as Record<string, unknown>)[field.key] = value;
      }
      continue;
    }

    const value = coerceString(raw);
    if (value === undefined) {
      if (field.required) carErrors.push(`"${field.label}" is required`);
      continue;
    }
    if (field.enumValues) {
      const matched = matchEnum(value, field.enumValues);
      if (!matched) {
        carErrors.push(
          `"${field.label}" value "${value}" is not one of: ${field.enumValues.join(', ')}`,
        );
        continue;
      }
      (car as Record<string, unknown>)[field.key] = matched;
    } else {
      (car as Record<string, unknown>)[field.key] = value;
    }
  }

  return carErrors.length > 0
    ? { carErrors }
    : { car: car as CarRow, carErrors };
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

function readExpenseRows(sheet: ExcelJS.Worksheet): {
  expenses: ExpenseRow[];
  expenseErrors: RowErrorLike[];
} {
  const expenses: ExpenseRow[] = [];
  const expenseErrors: RowErrorLike[] = [];
  const columns = resolveExpenseColumns(sheet);

  for (
    let row = EXPENSE_DATA_START_ROW;
    row < EXPENSE_DATA_START_ROW + MAX_EXPENSE_ROWS;
    row++
  ) {
    // The hidden Expense ID doesn't count: a row whose visible cells were
    // all cleared is a deleted row, not an invalid one.
    const isBlank = columns
      .filter((c) => c.key !== 'expenseId')
      .map((c) => cellValue(sheet, row, c.sourceCol))
      .every((v) => v === null || v === undefined || v === '');
    if (isBlank) continue;

    const expense: Partial<ExpenseRow> = {};
    const rowErrors: string[] = [];

    for (const col of columns) {
      const raw = cellValue(sheet, row, col.sourceCol);

      if (col.type === 'number') {
        const { value, invalid } = coerceNumber(raw);
        if (invalid) {
          rowErrors.push(`"${col.label}" must be a number`);
        } else if (value === undefined) {
          if (col.required) rowErrors.push(`"${col.label}" is required`);
        } else if (col.min !== undefined && value < col.min) {
          rowErrors.push(`"${col.label}" must be at least ${col.min}`);
        } else if (col.max !== undefined && value > col.max) {
          rowErrors.push(`"${col.label}" must be at most ${col.max}`);
        } else {
          (expense as Record<string, unknown>)[col.key] = value;
        }
        continue;
      }

      if (col.type === 'date') {
        const { iso, invalid } = coerceDate(raw);
        if (invalid) {
          rowErrors.push(`"${col.label}" is not a recognizable date`);
        } else if (iso === undefined) {
          if (col.required) rowErrors.push(`"${col.label}" is required`);
        } else {
          (expense as Record<string, unknown>)[col.key] = iso;
        }
        continue;
      }

      const value = coerceString(raw);
      if (value === undefined) {
        if (col.required) rowErrors.push(`"${col.label}" is required`);
        continue;
      }
      if (col.enumValues) {
        const matched = matchEnum(value, col.enumValues);
        if (!matched) {
          rowErrors.push(
            `"${col.label}" value "${value}" is not one of: ${col.enumValues.join(', ')}`,
          );
          continue;
        }
        (expense as Record<string, unknown>)[col.key] = matched;
      } else {
        (expense as Record<string, unknown>)[col.key] = value;
      }
    }

    const hasLitres = expense.litres !== undefined;
    const hasPrice = expense.fuelPricePerLitre !== undefined;
    if (hasLitres !== hasPrice) {
      rowErrors.push(
        '"Litres" and "Fuel Price/Litre" must both be set or both left blank',
      );
    }

    if (rowErrors.length > 0) {
      for (const message of rowErrors) {
        expenseErrors.push({ sheet: sheet.name, row, message });
      }
    } else {
      expenses.push(expense as ExpenseRow);
    }
  }

  return { expenses, expenseErrors };
}
