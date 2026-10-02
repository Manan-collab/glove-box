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
// The app never asks for a currency (everything defaults to INR), so import
// accepts a short fixed list rather than any 3-letter string. Blank = INR.
export const CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'AUD',
  'CAD',
];
export const DEFAULT_CURRENCY = 'INR';

// Common ways people write a category that aren't the exact enum value.
const CATEGORY_ALIASES: Record<string, string> = {
  tyre: 'TYRES',
  tire: 'TYRES',
  tires: 'TYRES',
  mods: 'MOD',
  modification: 'MOD',
  modifications: 'MOD',
  petrol: 'FUEL',
  diesel: 'FUEL',
};

export type FieldType = 'string' | 'number' | 'date';

// Every rule for one cell, shared by the Car Details block and the expense
// table so both are checked by the same code (validateCell in
// workbook-validators.ts). Numeric bounds mirror the DB column types —
// Decimal(10,2) for amounts, Decimal(8,2) for litres/price, Int for
// odometer/year/power — since import bypasses the global ValidationPipe and a
// value the DB rejects would otherwise fail mid-write.
export interface FieldRules {
  label: string;
  required: boolean;
  type: FieldType;
  enumValues?: string[];
  aliases?: Record<string, string>;
  // Normalize matched/free text to upper case (currency codes, VINs).
  uppercase?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  maxDecimals?: number;
  maxLength?: number;
  pattern?: { regex: RegExp; hint: string };
  // Example shown in error messages, e.g. "must be a number, e.g. 1500".
  example?: string;
}

export interface CarHeaderField extends FieldRules {
  row: number;
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
}

export interface ExpenseColumn extends FieldRules {
  col: number;
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
  // Only meaningful for these categories (matching the app's expense form).
  // Set on any other category, the value is dropped with a warning.
  categories?: string[];
}

const CURRENT_YEAR = new Date().getFullYear();
const MAX_ODOMETER_KM = 2_000_000;
const SHORT_TEXT = 100;
const LONG_TEXT = 500;
const NOTES_TEXT = 1000;
const MAX_AMOUNT = 99_999_999.99; // Decimal(10, 2)
const MAX_FUEL_VALUE = 999_999.99; // Decimal(8, 2)

// Row layout within a car's sheet: 1 = section label, 2-13 = header fields,
// 14 = blank separator, 15 = section label, 16 = expense table header,
// 17+ = expense data rows.
export const CAR_DETAILS_LABEL_ROW = 1;
export const CAR_HEADER_FIELDS: CarHeaderField[] = [
  { row: 2, label: 'Car ID', key: 'carId', required: false, type: 'string' },
  {
    row: 3,
    label: 'Make',
    key: 'make',
    required: true,
    type: 'string',
    maxLength: SHORT_TEXT,
  },
  {
    row: 4,
    label: 'Model',
    key: 'model',
    required: true,
    type: 'string',
    maxLength: SHORT_TEXT,
  },
  {
    row: 5,
    label: 'Year',
    key: 'year',
    required: true,
    type: 'number',
    integer: true,
    min: 1900,
    max: CURRENT_YEAR + 1,
    example: '2022',
  },
  {
    row: 6,
    label: 'Variant',
    key: 'variant',
    required: true,
    type: 'string',
    maxLength: SHORT_TEXT,
  },
  {
    row: 7,
    label: 'VIN',
    key: 'vin',
    required: false,
    type: 'string',
    uppercase: true,
    pattern: {
      // 17 characters; I, O and Q are never used in a VIN.
      regex: /^[A-HJ-NPR-Z0-9]{17}$/,
      hint: 'must be 17 letters/digits (no I, O or Q)',
    },
  },
  {
    row: 8,
    label: 'Engine',
    key: 'engine',
    required: true,
    type: 'string',
    maxLength: SHORT_TEXT,
  },
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
    integer: true,
    min: 1,
    max: 2000,
    example: '89',
  },
  {
    row: 13,
    label: 'Odometer (km)',
    key: 'odometerKm',
    required: true,
    type: 'number',
    integer: true,
    min: 0,
    max: MAX_ODOMETER_KM,
    example: '24500',
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
export const MAX_CAR_SHEETS = 50;

// Expense ID is last so it can be a hidden, locked column without hiding
// column A (which also carries the Car Details labels). The reader locates
// columns by header label, so files exported with the older layout (ID in
// column A) still import correctly.
export const EXPENSE_COLUMNS: ExpenseColumn[] = [
  {
    col: 1,
    label: 'Expense Date',
    key: 'expenseDate',
    required: true,
    type: 'date',
  },
  {
    col: 2,
    label: 'Category',
    key: 'category',
    required: true,
    type: 'string',
    enumValues: EXPENSE_CATEGORIES,
    aliases: CATEGORY_ALIASES,
  },
  {
    col: 3,
    label: 'Amount',
    key: 'amount',
    required: true,
    type: 'number',
    min: 0.01,
    max: MAX_AMOUNT,
    maxDecimals: 2,
    example: '1500',
  },
  {
    col: 4,
    label: 'Currency',
    key: 'currency',
    required: false,
    type: 'string',
    enumValues: CURRENCIES,
    uppercase: true,
  },
  {
    col: 5,
    label: 'Odometer (km)',
    key: 'odometerKm',
    required: false,
    type: 'number',
    integer: true,
    min: 0,
    max: MAX_ODOMETER_KM,
    example: '24500',
  },
  {
    col: 6,
    label: 'Notes',
    key: 'notes',
    required: false,
    type: 'string',
    maxLength: NOTES_TEXT,
  },
  {
    col: 7,
    label: 'Workshop Name',
    key: 'workshopName',
    required: false,
    type: 'string',
    maxLength: SHORT_TEXT,
    categories: ['SERVICE', 'REPAIR'],
  },
  {
    col: 8,
    label: 'Work Performed',
    key: 'workPerformed',
    required: false,
    type: 'string',
    maxLength: LONG_TEXT,
    categories: ['SERVICE'],
  },
  {
    col: 9,
    label: 'What Broke',
    key: 'whatBroke',
    required: false,
    type: 'string',
    maxLength: LONG_TEXT,
    categories: ['REPAIR'],
  },
  {
    col: 10,
    label: 'Litres',
    key: 'litres',
    required: false,
    type: 'number',
    min: 0.01,
    max: MAX_FUEL_VALUE,
    maxDecimals: 2,
    example: '10.5',
    categories: ['FUEL'],
  },
  {
    col: 11,
    label: 'Fuel Price/Litre',
    key: 'fuelPricePerLitre',
    required: false,
    type: 'number',
    min: 0.01,
    max: MAX_FUEL_VALUE,
    maxDecimals: 2,
    example: '95.24',
    categories: ['FUEL'],
  },
  {
    col: 12,
    label: 'Fuel Station',
    key: 'fuelStation',
    required: false,
    type: 'string',
    maxLength: SHORT_TEXT,
    categories: ['FUEL'],
  },
  {
    col: 13,
    label: 'Tyre Brand',
    key: 'tyreBrand',
    required: false,
    type: 'string',
    maxLength: SHORT_TEXT,
    categories: ['TYRES'],
  },
  {
    col: 14,
    label: 'Tyre Size',
    key: 'tyreSize',
    required: false,
    type: 'string',
    maxLength: SHORT_TEXT,
    categories: ['TYRES'],
  },
  {
    col: 15,
    label: 'Expense ID',
    key: 'expenseId',
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

// A sheet either points at a car the user already has, via its hidden Car ID
// (Car Details are locked in exports and ignored on import — cars are edited
// in the app, not the spreadsheet), or describes a new car to create.
export interface ParsedExpense {
  // Spreadsheet row, for error messages raised after parsing (DB checks).
  row: number;
  expense: ExpenseRow;
}

export type ParsedCarSheet = {
  sheetName: string;
  expenses: ParsedExpense[];
} & ({ existingCarId: string } | { newCar: Omit<CarRow, 'carId'> });
