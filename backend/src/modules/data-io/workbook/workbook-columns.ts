import { ExpenseCategory } from '../../../../generated/prisma/enums';

// Kept in sync by hand with frontend/features/cars/car-form-schema.ts — these
// are UI-convenience enums, not DB constraints (CreateCarDto accepts any
// non-empty string), but import is a much higher-error-rate input surface
// than a dropdown, so we validate strictly against the same known lists here.
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];
export const TRANSMISSIONS = ['Manual', 'Automatic', 'CVT', 'AMT', 'DCT'];
export const BODY_TYPES = [
  'Hatchback',
  'Sedan',
  'SUV',
  'MPV',
  'Coupe',
  'Convertible',
  'Pickup',
  'Van',
];
export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

export type FieldType = 'string' | 'number' | 'date';

export interface CarHeaderField {
  row: number;
  label: string;
  key:
    | 'carId'
    | 'make'
    | 'model'
    | 'year'
    | 'variant'
    | 'vin'
    | 'engine'
    | 'fuelType'
    | 'transmission'
    | 'bodyType'
    | 'powerBhp'
    | 'odometerKm';
  required: boolean;
  type: FieldType;
  enumValues?: string[];
  // Mirrors the class-validator rules on CreateCarDto (Min/Max/IsPositive) —
  // import goes straight through the service layer, bypassing the global
  // ValidationPipe entirely, so these checks are the only enforcement.
  min?: number;
  max?: number;
}

export interface ExpenseColumn {
  col: number;
  label: string;
  key:
    | 'expenseId'
    | 'category'
    | 'amount'
    | 'currency'
    | 'expenseDate'
    | 'odometerKm'
    | 'notes'
    | 'workshopName'
    | 'workPerformed'
    | 'whatBroke'
    | 'litres'
    | 'fuelPricePerLitre'
    | 'fuelStation'
    | 'tyreBrand'
    | 'tyreSize';
  required: boolean;
  type: FieldType;
  enumValues?: string[];
  min?: number;
  max?: number;
}

const CURRENT_YEAR = new Date().getFullYear();

// Row layout within a car's sheet: 1 = section label, 2-13 = header fields,
// 14 = blank separator, 15 = section label, 16 = expense table header,
// 17+ = expense data rows.
export const CAR_DETAILS_LABEL_ROW = 1;
export const CAR_HEADER_FIELDS: CarHeaderField[] = [
  { row: 2, label: 'Car ID', key: 'carId', required: false, type: 'string' },
  { row: 3, label: 'Make', key: 'make', required: true, type: 'string' },
  { row: 4, label: 'Model', key: 'model', required: true, type: 'string' },
  {
    row: 5,
    label: 'Year',
    key: 'year',
    required: true,
    type: 'number',
    min: 1900,
    max: CURRENT_YEAR + 1,
  },
  { row: 6, label: 'Variant', key: 'variant', required: true, type: 'string' },
  { row: 7, label: 'VIN', key: 'vin', required: false, type: 'string' },
  { row: 8, label: 'Engine', key: 'engine', required: true, type: 'string' },
  {
    row: 9,
    label: 'Fuel Type',
    key: 'fuelType',
    required: true,
    type: 'string',
    enumValues: FUEL_TYPES,
  },
  {
    row: 10,
    label: 'Transmission',
    key: 'transmission',
    required: true,
    type: 'string',
    enumValues: TRANSMISSIONS,
  },
  {
    row: 11,
    label: 'Body Type',
    key: 'bodyType',
    required: true,
    type: 'string',
    enumValues: BODY_TYPES,
  },
  {
    row: 12,
    label: 'Power (bhp)',
    key: 'powerBhp',
    required: false,
    type: 'number',
    min: 1,
  },
  {
    row: 13,
    label: 'Odometer (km)',
    key: 'odometerKm',
    required: true,
    type: 'number',
    min: 0,
  },
];
export const SEPARATOR_ROW = 14;
export const EXPENSES_LABEL_ROW = 15;
export const EXPENSE_HEADER_ROW = 16;
export const EXPENSE_DATA_START_ROW = 17;
// Bound on how many expense rows a sheet is scanned for — generous for a
// personal car's multi-year expense history, and a backstop against an
// unbounded scan on a maliciously large file. Blank rows within this range
// are skipped (not treated as "end of table") so an accidental blank row
// doesn't silently truncate real data below it.
export const MAX_EXPENSE_ROWS = 2000;

export const EXPENSE_COLUMNS: ExpenseColumn[] = [
  {
    col: 1,
    label: 'Expense ID',
    key: 'expenseId',
    required: false,
    type: 'string',
  },
  {
    col: 2,
    label: 'Category',
    key: 'category',
    required: true,
    type: 'string',
    enumValues: EXPENSE_CATEGORIES,
  },
  {
    col: 3,
    label: 'Amount',
    key: 'amount',
    required: true,
    type: 'number',
    min: 0.01,
  },
  {
    col: 4,
    label: 'Currency',
    key: 'currency',
    required: false,
    type: 'string',
  },
  {
    col: 5,
    label: 'Expense Date',
    key: 'expenseDate',
    required: true,
    type: 'date',
  },
  {
    col: 6,
    label: 'Odometer (km)',
    key: 'odometerKm',
    required: false,
    type: 'number',
    min: 0,
  },
  { col: 7, label: 'Notes', key: 'notes', required: false, type: 'string' },
  {
    col: 8,
    label: 'Workshop Name',
    key: 'workshopName',
    required: false,
    type: 'string',
  },
  {
    col: 9,
    label: 'Work Performed',
    key: 'workPerformed',
    required: false,
    type: 'string',
  },
  {
    col: 10,
    label: 'What Broke',
    key: 'whatBroke',
    required: false,
    type: 'string',
  },
  {
    col: 11,
    label: 'Litres',
    key: 'litres',
    required: false,
    type: 'number',
    min: 0.01,
  },
  {
    col: 12,
    label: 'Fuel Price/Litre',
    key: 'fuelPricePerLitre',
    required: false,
    type: 'number',
    min: 0.01,
  },
  {
    col: 13,
    label: 'Fuel Station',
    key: 'fuelStation',
    required: false,
    type: 'string',
  },
  {
    col: 14,
    label: 'Tyre Brand',
    key: 'tyreBrand',
    required: false,
    type: 'string',
  },
  {
    col: 15,
    label: 'Tyre Size',
    key: 'tyreSize',
    required: false,
    type: 'string',
  },
];

export const READ_ME_SHEET_NAME = 'Read Me';
export const EXAMPLE_SHEET_NAME = 'Example Car';

export interface CarRow {
  carId?: string;
  make: string;
  model: string;
  year: number;
  variant: string;
  vin?: string;
  engine: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  powerBhp?: number;
  odometerKm: number;
}

export interface ExpenseRow {
  expenseId?: string;
  category: string;
  amount: number;
  currency?: string;
  expenseDate: string;
  odometerKm?: number;
  notes?: string;
  workshopName?: string;
  workPerformed?: string;
  whatBroke?: string;
  litres?: number;
  fuelPricePerLitre?: number;
  fuelStation?: string;
  tyreBrand?: string;
  tyreSize?: string;
}

export interface ParsedCarSheet {
  sheetName: string;
  car: CarRow;
  expenses: ExpenseRow[];
}
