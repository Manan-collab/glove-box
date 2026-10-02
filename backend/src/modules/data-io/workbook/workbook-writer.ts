import ExcelJS from 'exceljs';
import { Car, Expense } from '../../../../generated/prisma/client';
import { CarRow, ExpenseColumn, ExpenseRow } from './workbook-columns';
import {
  CAR_DETAILS_LABEL_ROW,
  CAR_HEADER_FIELDS,
  EXAMPLE_SHEET_NAME,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
  EXPENSE_HEADER_ROW,
  EXPENSES_LABEL_ROW,
  MAX_EXPENSE_ROWS,
  READ_ME_SHEET_NAME,
} from './workbook-columns';

const DROPDOWN_ROW_BUFFER = 200; // rows of validation applied beyond current data, for future manual additions

// ARGB, mirroring the frontend's light palette (frontend/app/theme.ts).
const COLOR = {
  brand: 'FF2F6BFF',
  navy: 'FF181A2A',
  labelFill: 'FFEBEEF8',
  zebra: 'FFF5F7FC',
  border: 'FFDBDFEC',
  muted: 'FF5B5E6B',
  white: 'FFFFFFFF',
};

// Same grouping as categoryAccent() in frontend/features/expenses/expense-categories.ts.
const ACCENT = {
  warning: { fill: 'FFFDF1DC', font: 'FF8A5A00' },
  primary: { fill: 'FFE3EBFF', font: 'FF1E52D6' },
  error: { fill: 'FFFBE3E4', font: 'FFA3262D' },
  success: { fill: 'FFDDF3E9', font: 'FF146B47' },
  default: { fill: 'FFEEEFF2', font: 'FF5B5E6B' },
};
const CATEGORY_ACCENTS: Record<string, keyof typeof ACCENT> = {
  FUEL: 'warning',
  SERVICE: 'primary',
  MOD: 'primary',
  INSURANCE: 'primary',
  REPAIR: 'error',
  BATTERY: 'success',
  PURCHASE: 'success',
  TYRES: 'default',
  OTHER: 'default',
};

// Column A and B double as the Car Details label/value columns, so they're
// sized for whichever of the two needs more room.
const COLUMN_WIDTHS: Record<ExpenseColumn['key'], number> = {
  expenseDate: 18,
  category: 24,
  amount: 14,
  currency: 10,
  odometerKm: 15,
  notes: 34,
  workshopName: 22,
  workPerformed: 30,
  whatBroke: 24,
  litres: 10,
  fuelPricePerLitre: 16,
  fuelStation: 24,
  tyreBrand: 16,
  tyreSize: 12,
  expenseId: 12,
};

const NUMBER_FORMATS: Partial<Record<string, string>> = {
  amount: '#,##0.00',
  odometerKm: '#,##0',
  litres: '0.00',
  fuelPricePerLitre: '#,##0.00',
  expenseDate: 'dd mmm yyyy',
};

const VISIBLE_EXPENSE_COLUMNS = EXPENSE_COLUMNS.filter(
  (c) => c.key !== 'expenseId',
);
const LAST_VISIBLE_COL = Math.max(...VISIBLE_EXPENSE_COLUMNS.map((c) => c.col));
const ID_COL = EXPENSE_COLUMNS.find((c) => c.key === 'expenseId')!.col;
const CAR_ID_ROW = CAR_HEADER_FIELDS.find((f) => f.key === 'carId')!.row;
// "At a Glance" sits right of Car Details with one empty column between; its
// labels span two columns since D alone (Currency) is too narrow.
const SUMMARY_LABEL_COL = 4;
const SUMMARY_LABEL_END_COL = 5;
const SUMMARY_VALUE_COL = 6;
const FONT = 'Calibri';

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLOR.border } },
  left: { style: 'thin', color: { argb: COLOR.border } },
  bottom: { style: 'thin', color: { argb: COLOR.border } },
  right: { style: 'thin', color: { argb: COLOR.border } },
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function colLetter(col: number): string {
  return String.fromCharCode(64 + col);
}

function sheetNameFor(
  car: Pick<Car, 'model' | 'year'>,
  taken: Set<string>,
): string {
  const base = `${car.model} ${car.year}`.slice(0, 31).trim() || 'Car';
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffixText = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function writeSectionBanner(
  sheet: ExcelJS.Worksheet,
  row: number,
  fromCol: number,
  toCol: number,
  text: string,
) {
  sheet.mergeCells(row, fromCol, row, toCol);
  const cell = sheet.getCell(row, fromCol);
  cell.value = text;
  cell.font = {
    name: FONT,
    bold: true,
    size: 12,
    color: { argb: COLOR.white },
  };
  cell.fill = solidFill(COLOR.brand);
  cell.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(row).height = 24;
}

function writeCarHeaderBlock(sheet: ExcelJS.Worksheet, car: Partial<CarRow>) {
  writeSectionBanner(sheet, CAR_DETAILS_LABEL_ROW, 1, 2, 'Car Details');

  for (const field of CAR_HEADER_FIELDS) {
    const labelCell = sheet.getCell(field.row, 1);
    labelCell.value = field.label;
    labelCell.font = { name: FONT, bold: true, color: { argb: COLOR.navy } };
    labelCell.fill = solidFill(COLOR.labelFill);
    labelCell.border = thinBorder;
    labelCell.alignment = { vertical: 'middle', indent: 1 };

    const raw = car[field.key];
    const valueCell = sheet.getCell(field.row, 2);
    valueCell.value = raw === null || raw === undefined ? null : raw;
    valueCell.font = { name: FONT, color: { argb: COLOR.navy } };
    valueCell.border = thinBorder;
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
    if (field.key === 'odometerKm') valueCell.numFmt = '#,##0';

    // Exported cars are locked: import ignores an existing car's details
    // (cars are edited in the app). Only a template's new-car sheet, which
    // has no Car ID, is fillable. The Car ID row itself is always hidden.
    if (!car.carId && field.key !== 'carId') {
      valueCell.protection = { locked: false };
    }

    if (field.enumValues) {
      valueCell.dataValidation = {
        type: 'list',
        allowBlank: !field.required,
        formulae: [`"${field.enumValues.join(',')}"`],
      };
    }
  }
  sheet.getRow(CAR_ID_ROW).hidden = true;
}

// Live formulas over the expense table, so the totals stay right as the user
// edits. Each also carries a precomputed result, because previewers (Quick
// Look, Gmail, most phone viewers) show cached values and never recalculate.
// Import never reads these cells.
function writeSummaryBlock(
  sheet: ExcelJS.Worksheet,
  expenses: Array<Partial<ExpenseRow>>,
) {
  const first = EXPENSE_DATA_START_ROW;
  const last = EXPENSE_DATA_START_ROW + MAX_EXPENSE_ROWS - 1;
  const col = (key: ExpenseColumn['key']) => {
    const letter = colLetter(EXPENSE_COLUMNS.find((c) => c.key === key)!.col);
    return `${letter}${first}:${letter}${last}`;
  };

  writeSectionBanner(
    sheet,
    CAR_DETAILS_LABEL_ROW,
    SUMMARY_LABEL_COL,
    SUMMARY_VALUE_COL,
    'At a Glance',
  );

  const sumAmount = (list: Array<Partial<ExpenseRow>>) =>
    list.reduce((total, e) => total + (e.amount ?? 0), 0);
  const dates = expenses
    .map((e) => e.expenseDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const lastDate = dates.at(-1);

  const rows: Array<{
    label: string;
    formula: string;
    result: number | string | Date;
    numFmt: string;
  }> = [
    {
      label: 'Total spent',
      formula: `SUM(${col('amount')})`,
      result: sumAmount(expenses),
      numFmt: '#,##0.00',
    },
    {
      label: 'Fuel spend',
      formula: `SUMIF(${col('category')},"FUEL",${col('amount')})`,
      result: sumAmount(expenses.filter((e) => e.category === 'FUEL')),
      numFmt: '#,##0.00',
    },
    {
      label: 'Expenses logged',
      formula: `COUNTA(${col('category')})`,
      result: expenses.filter((e) => e.category).length,
      numFmt: '#,##0',
    },
    {
      label: 'Last expense',
      formula: `IF(COUNT(${col('expenseDate')})=0,"—",MAX(${col('expenseDate')}))`,
      result: lastDate ? new Date(lastDate) : '—',
      numFmt: 'dd mmm yyyy',
    },
  ];

  rows.forEach((row, index) => {
    const r = CAR_DETAILS_LABEL_ROW + 2 + index;
    sheet.mergeCells(r, SUMMARY_LABEL_COL, r, SUMMARY_LABEL_END_COL);
    const labelCell = sheet.getCell(r, SUMMARY_LABEL_COL);
    labelCell.value = row.label;
    labelCell.font = { name: FONT, bold: true, color: { argb: COLOR.navy } };
    labelCell.fill = solidFill(COLOR.labelFill);
    labelCell.border = thinBorder;
    labelCell.alignment = { vertical: 'middle', indent: 1 };

    const valueCell = sheet.getCell(r, SUMMARY_VALUE_COL);
    valueCell.value = { formula: row.formula, result: row.result };
    valueCell.numFmt = row.numFmt;
    valueCell.font = { name: FONT, bold: true, color: { argb: COLOR.brand } };
    valueCell.border = thinBorder;
    valueCell.alignment = { vertical: 'middle', horizontal: 'right' };
  });
}

function writeExpenseTable(
  sheet: ExcelJS.Worksheet,
  expenses: Array<Partial<ExpenseRow>>,
) {
  writeSectionBanner(
    sheet,
    EXPENSES_LABEL_ROW,
    1,
    LAST_VISIBLE_COL,
    'Expenses',
  );

  const headerRow = sheet.getRow(EXPENSE_HEADER_ROW);
  headerRow.height = 22;
  for (const col of EXPENSE_COLUMNS) {
    const cell = sheet.getCell(EXPENSE_HEADER_ROW, col.col);
    cell.value = col.label;
    cell.font = { name: FONT, bold: true, color: { argb: COLOR.white } };
    cell.fill = solidFill(COLOR.navy);
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  const rowCount = expenses.length + DROPDOWN_ROW_BUFFER;
  const lastRow = EXPENSE_DATA_START_ROW + rowCount - 1;

  // Style the whole entry area (data + blank buffer rows) up front, so rows
  // the user types into later look like the rest of the table. Every cell is
  // unlocked — including the hidden Expense ID — because Excel refuses to
  // delete a row on a protected sheet if any cell in it is locked. The ID
  // still can't be edited: its column is hidden and the sheet disallows
  // unhiding columns.
  for (let i = 0; i < rowCount; i++) {
    const row = EXPENSE_DATA_START_ROW + i;
    for (const col of EXPENSE_COLUMNS) {
      const cell = sheet.getCell(row, col.col);
      cell.font = { name: FONT, color: { argb: COLOR.navy } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      cell.protection = { locked: false };
      const numFmt = NUMBER_FORMATS[col.key];
      if (numFmt) cell.numFmt = numFmt;
      if (col.enumValues) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: !col.required,
          formulae: [`"${col.enumValues.join(',')}"`],
        };
      }
    }
  }

  expenses.forEach((expense, index) => {
    const row = EXPENSE_DATA_START_ROW + index;
    for (const col of EXPENSE_COLUMNS) {
      const raw = expense[col.key];
      const cell = sheet.getCell(row, col.col);
      if (raw === null || raw === undefined) {
        cell.value = null;
      } else if (col.type === 'date') {
        cell.value = new Date(raw);
      } else {
        cell.value = raw;
      }

      // Static copies of the conditional formatting below, for previewers
      // that don't evaluate it. In Excel/Sheets the conditional rules take
      // precedence, so these never go stale there after edits.
      if (row % 2 === 0 && col.key !== 'expenseId') {
        cell.fill = solidFill(COLOR.zebra);
      }
      const accent =
        col.key === 'category' && typeof raw === 'string'
          ? CATEGORY_ACCENTS[raw]
          : undefined;
      if (accent) {
        cell.fill = solidFill(ACCENT[accent].fill);
        cell.font = {
          name: FONT,
          bold: true,
          color: { argb: ACCENT[accent].font },
        };
      }
    }
  });

  // Conditional formatting rather than static fills, so zebra striping and
  // category colours stay correct after the user inserts, deletes or edits rows.
  const lastVisibleLetter = colLetter(LAST_VISIBLE_COL);
  const categoryLetter = colLetter(
    EXPENSE_COLUMNS.find((c) => c.key === 'category')!.col,
  );
  const first = EXPENSE_DATA_START_ROW;
  sheet.addConditionalFormatting({
    ref: `${categoryLetter}${first}:${categoryLetter}${lastRow}`,
    rules: Object.entries(CATEGORY_ACCENTS).map(([category, accent], i) => ({
      type: 'expression',
      priority: i + 1,
      formulae: [`$${categoryLetter}${first}="${category}"`],
      style: {
        fill: {
          type: 'pattern',
          pattern: 'solid',
          bgColor: { argb: ACCENT[accent].fill },
        },
        font: { bold: true, color: { argb: ACCENT[accent].font } },
      },
    })),
  });
  sheet.addConditionalFormatting({
    ref: `A${first}:${lastVisibleLetter}${lastRow}`,
    rules: [
      {
        type: 'expression',
        priority: Object.keys(CATEGORY_ACCENTS).length + 1,
        formulae: [`MOD(ROW(),2)=0`],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: COLOR.zebra },
          },
        },
      },
    ],
  });

  sheet.autoFilter = `A${EXPENSE_HEADER_ROW}:${colLetter(ID_COL)}${lastRow}`;
}

function applyColumnLayout(sheet: ExcelJS.Worksheet) {
  for (const col of EXPENSE_COLUMNS) {
    sheet.getColumn(col.col).width = COLUMN_WIDTHS[col.key];
  }
  sheet.getColumn(ID_COL).hidden = true;
}

// No password: this guards against accidental edits to the hidden IDs, not a
// determined user — the server already rejects IDs that aren't the
// importer's own. Sorting is disallowed because a sort that excluded the
// hidden ID column would silently re-pair IDs with the wrong rows.
async function protectSheet(sheet: ExcelJS.Worksheet) {
  await sheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    deleteColumns: false,
    insertRows: true,
    deleteRows: true,
    insertHyperlinks: false,
    sort: false,
    autoFilter: true,
    pivotTables: false,
  });
}

async function writeCarSheet(
  sheet: ExcelJS.Worksheet,
  car: Partial<CarRow>,
  expenses: Array<Partial<ExpenseRow>>,
) {
  sheet.properties.tabColor = { argb: COLOR.brand };
  sheet.views = [{ showGridLines: false }];
  writeCarHeaderBlock(sheet, car);
  writeSummaryBlock(sheet, expenses);
  writeExpenseTable(sheet, expenses);
  applyColumnLayout(sheet);
  await protectSheet(sheet);
}

function toExpenseRow(expense: Expense): ExpenseRow {
  return {
    expenseId: expense.id,
    category: expense.category,
    amount: Number(expense.amount),
    currency: expense.currency,
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    odometerKm: expense.odometerKm ?? undefined,
    notes: expense.notes ?? undefined,
    workshopName: expense.workshopName ?? undefined,
    workPerformed: expense.workPerformed ?? undefined,
    whatBroke: expense.whatBroke ?? undefined,
    litres: expense.litres ? Number(expense.litres) : undefined,
    fuelPricePerLitre: expense.fuelPricePerLitre
      ? Number(expense.fuelPricePerLitre)
      : undefined,
    fuelStation: expense.fuelStation ?? undefined,
    tyreBrand: expense.tyreBrand ?? undefined,
    tyreSize: expense.tyreSize ?? undefined,
  };
}

function toCarRow(car: Car): CarRow {
  return {
    carId: car.id,
    make: car.make,
    model: car.model,
    year: car.year,
    variant: car.variant,
    vin: car.vin ?? undefined,
    engine: car.engine,
    fuelType: car.fuelType,
    transmission: car.transmission,
    bodyType: car.bodyType,
    powerBhp: car.powerBhp ?? undefined,
    odometerKm: car.odometerKm,
  };
}

function newWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Glovebox';
  workbook.created = new Date();
  // The summary formulas are written without cached results.
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export async function buildExportWorkbook(
  cars: Array<Car & { expenses: Expense[] }>,
): Promise<ExcelJS.Workbook> {
  const workbook = newWorkbook();
  const takenNames = new Set<string>();

  for (const car of cars) {
    const sheet = workbook.addWorksheet(sheetNameFor(car, takenNames));
    await writeCarSheet(sheet, toCarRow(car), car.expenses.map(toExpenseRow));
  }

  return workbook;
}

export async function buildTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = newWorkbook();

  const readMe = workbook.addWorksheet(READ_ME_SHEET_NAME);
  readMe.properties.tabColor = { argb: COLOR.navy };
  readMe.views = [{ showGridLines: false }];
  readMe.getColumn(1).width = 110;
  const lines = [
    'Each sheet in this workbook is one car. Duplicate the "Example Car" sheet once for every car you own.',
    "Fill in the Car Details block at the top of the sheet, then list that car's expenses in the table below it.",
    'Pick Category, Currency, Fuel Type, Transmission and Body Type from the dropdowns — other values are rejected on import.',
    'Type dates day-first (DD/MM/YYYY, e.g. 25/08/2026) or as YYYY-MM-DD. Amounts are plain numbers — "1,500" and "₹1500" are fine.',
    'Import is all-or-nothing: if any cell has a problem, nothing is imported and you get a list of every cell to fix.',
    'To add an expense to a car you already track in Glovebox, export your data first and edit that file instead of starting from this template.',
    "In an exported file, each car's details are read-only — edit the car itself in the app. Its expenses can be edited and added to freely.",
    'This "Read Me" sheet is ignored on import — you can delete it or leave it in, either is fine.',
  ];
  const title = readMe.getCell(1, 1);
  title.value = 'How to use this template';
  title.font = {
    name: FONT,
    bold: true,
    size: 16,
    color: { argb: COLOR.white },
  };
  title.fill = solidFill(COLOR.brand);
  title.alignment = { vertical: 'middle', indent: 1 };
  readMe.getRow(1).height = 32;
  lines.forEach((line, index) => {
    const cell = readMe.getCell(index + 3, 1);
    cell.value = `${index + 1}.  ${line}`;
    cell.font = { name: FONT, color: { argb: COLOR.navy } };
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    readMe.getRow(index + 3).height = 22;
  });

  const example = workbook.addWorksheet(EXAMPLE_SHEET_NAME);
  await writeCarSheet(
    example,
    {
      carId: undefined,
      make: 'Maruti Suzuki',
      model: 'Swift',
      year: 2022,
      variant: 'ZXI+',
      vin: undefined,
      engine: '1.2L K-Series',
      fuelType: 'Petrol',
      transmission: 'Manual',
      bodyType: 'Hatchback',
      powerBhp: 89,
      odometerKm: 24500,
    },
    [
      {
        expenseId: undefined,
        category: 'FUEL',
        amount: 1000,
        currency: 'INR',
        expenseDate: '2026-08-01',
        odometerKm: 24500,
        litres: 10.5,
        fuelPricePerLitre: 95.24,
        fuelStation: 'Indian Oil, MG Road',
      },
    ],
  );

  return workbook;
}
