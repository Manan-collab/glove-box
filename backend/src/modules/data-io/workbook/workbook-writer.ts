import ExcelJS from 'exceljs';
import { Car, Expense } from '../../../../generated/prisma/client';
import { CarRow, ExpenseRow } from './workbook-columns';
import {
  CAR_DETAILS_LABEL_ROW,
  CAR_HEADER_FIELDS,
  EXAMPLE_SHEET_NAME,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
  EXPENSE_HEADER_ROW,
  EXPENSES_LABEL_ROW,
  READ_ME_SHEET_NAME,
} from './workbook-columns';

const COLUMN_WIDTH = 20;
const DROPDOWN_ROW_BUFFER = 200; // rows of validation applied beyond current data, for future manual additions

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

function writeCarHeaderBlock(sheet: ExcelJS.Worksheet, car: Partial<CarRow>) {
  sheet.getCell(CAR_DETAILS_LABEL_ROW, 1).value = 'Car Details';
  sheet.getCell(CAR_DETAILS_LABEL_ROW, 1).font = { bold: true };

  for (const field of CAR_HEADER_FIELDS) {
    sheet.getCell(field.row, 1).value = field.label;
    sheet.getCell(field.row, 1).font = { bold: true };
    const raw = car[field.key];
    sheet.getCell(field.row, 2).value =
      raw === null || raw === undefined ? null : raw;
    if (field.enumValues) {
      sheet.getCell(field.row, 2).dataValidation = {
        type: 'list',
        allowBlank: !field.required,
        formulae: [`"${field.enumValues.join(',')}"`],
      };
    }
  }
}

function writeExpenseTable(
  sheet: ExcelJS.Worksheet,
  expenses: Array<Partial<ExpenseRow>>,
) {
  sheet.getCell(EXPENSES_LABEL_ROW, 1).value = 'Expenses';
  sheet.getCell(EXPENSES_LABEL_ROW, 1).font = { bold: true };

  for (const col of EXPENSE_COLUMNS) {
    const cell = sheet.getCell(EXPENSE_HEADER_ROW, col.col);
    cell.value = col.label;
    cell.font = { bold: true };
  }

  const rowCount = Math.max(expenses.length, 0) + DROPDOWN_ROW_BUFFER;
  for (const col of EXPENSE_COLUMNS) {
    if (!col.enumValues) continue;
    for (let i = 0; i < rowCount; i++) {
      const cell = sheet.getCell(EXPENSE_DATA_START_ROW + i, col.col);
      cell.dataValidation = {
        type: 'list',
        allowBlank: !col.required,
        formulae: [`"${col.enumValues.join(',')}"`],
      };
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
        cell.numFmt = 'yyyy-mm-dd';
      } else {
        cell.value = raw;
      }
    }
  });
}

function applyColumnWidths(sheet: ExcelJS.Worksheet, columnCount: number) {
  for (let i = 1; i <= columnCount; i++) {
    sheet.getColumn(i).width = COLUMN_WIDTH;
  }
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

export function buildExportWorkbook(
  cars: Array<Car & { expenses: Expense[] }>,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const takenNames = new Set<string>();

  for (const car of cars) {
    const sheet = workbook.addWorksheet(sheetNameFor(car, takenNames));
    writeCarHeaderBlock(sheet, toCarRow(car));
    writeExpenseTable(sheet, car.expenses.map(toExpenseRow));
    applyColumnWidths(sheet, EXPENSE_COLUMNS.length);
  }

  return workbook;
}

export function buildTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const readMe = workbook.addWorksheet(READ_ME_SHEET_NAME);
  readMe.getColumn(1).width = 100;
  const lines = [
    'How to use this template',
    '',
    'Each sheet in this workbook is one car. Duplicate the "Example Car" sheet once for every car you own.',
    "Fill in the Car Details block at the top of the sheet, then list that car's expenses in the table below the line.",
    'Leave "Car ID" blank for a new car — it will be assigned automatically on import.',
    'To add an expense to a car you already track in Glovebox, export your data first and edit that file instead of starting from this template.',
    'This "Read Me" sheet is ignored on import — you can delete it or leave it in, either is fine.',
  ];
  lines.forEach((line, index) => {
    readMe.getCell(index + 1, 1).value = line;
  });
  readMe.getCell(1, 1).font = { bold: true, size: 14 };

  const example = workbook.addWorksheet(EXAMPLE_SHEET_NAME);
  writeCarHeaderBlock(example, {
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
  });
  writeExpenseTable(example, [
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
  ]);
  applyColumnWidths(example, EXPENSE_COLUMNS.length);

  return workbook;
}
