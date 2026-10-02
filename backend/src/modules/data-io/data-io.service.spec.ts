import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataIoService } from './data-io.service';
import { ImportResultDto } from './dto/import-result.dto';
import {
  CAR_HEADER_FIELDS,
  EXAMPLE_SHEET_NAME,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
  EXPENSE_HEADER_ROW,
  MAX_EXPENSE_ROWS,
  READ_ME_SHEET_NAME,
} from './workbook/workbook-columns';

// Fixed clock, so "can't be in the future" is deterministic.
const NOW = new Date('2026-10-02T12:00:00Z');

const CAR_FIXTURE = {
  id: 'car-1',
  make: 'Maruti Suzuki',
  model: 'Swift',
  year: 2022,
  variant: 'ZXI+',
  vin: 'MA3ERLF1S00123456',
  engine: '1.2L K-Series',
  fuelType: 'Petrol',
  transmission: 'Manual',
  bodyType: 'Hatchback',
  powerBhp: 89,
  odometerKm: 24500,
};

const EXPENSE_FIXTURE = {
  id: 'exp-1',
  carId: 'car-1',
  category: 'FUEL',
  amount: 1000,
  currency: 'INR',
  expenseDate: new Date('2026-08-01'),
  odometerKm: 24500,
  notes: 'Full tank',
  workshopName: null,
  workPerformed: null,
  whatBroke: null,
  litres: 10.5,
  fuelPricePerLitre: 95.24,
  fuelStation: 'Indian Oil',
  tyreBrand: null,
  tyreSize: null,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
};

const VALID_ROW = {
  expenseDate: '2026-08-01',
  category: 'SERVICE',
  amount: 2000,
};

const colOf = (key: string) => EXPENSE_COLUMNS.find((c) => c.key === key)!.col;
const rowOf = (key: string) =>
  CAR_HEADER_FIELDS.find((f) => f.key === key)!.row;

function fullCarSheet(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    carId: '',
    make: 'Maruti Suzuki',
    model: 'Swift',
    year: 2022,
    variant: 'ZXI+',
    vin: '',
    engine: '1.2L K-Series',
    fuelType: 'Petrol',
    transmission: 'Manual',
    bodyType: 'Hatchback',
    powerBhp: 89,
    odometerKm: 24500,
    ...overrides,
  };
}

type SheetDef = {
  name: string;
  car: Record<string, unknown>;
  expenses?: Array<Record<string, unknown>>;
  // Write the expense header row (labels), as a real export/template has.
  header?: boolean;
};

async function buildTestWorkbook(sheets: SheetDef[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name);
    for (const field of CAR_HEADER_FIELDS) {
      const value = sheetDef.car[field.key];
      sheet.getCell(field.row, 2).value =
        value === undefined ? null : (value as ExcelJS.CellValue);
    }
    if (sheetDef.header) {
      for (const col of EXPENSE_COLUMNS) {
        sheet.getCell(EXPENSE_HEADER_ROW, col.col).value = col.label;
      }
    }
    (sheetDef.expenses ?? []).forEach((expense, index) => {
      const row = EXPENSE_DATA_START_ROW + index;
      for (const col of EXPENSE_COLUMNS) {
        const value = expense[col.key];
        sheet.getCell(row, col.col).value =
          value === undefined ? null : (value as ExcelJS.CellValue);
      }
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function expectIssue(
  issues: ImportResultDto['errors'],
  message: string,
  extra: Record<string, unknown> = {},
) {
  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: expect.stringContaining(message),
        ...extra,
      }),
    ]),
  );
}

describe('DataIoService', () => {
  let service: DataIoService;
  let prisma: {
    car: { findMany: jest.Mock; deleteMany: jest.Mock };
    expense: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let carsService: { create: jest.Mock };

  beforeEach(() => {
    prisma = {
      car: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      expense: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'new-exp-id' }),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    carsService = { create: jest.fn().mockResolvedValue({ id: 'new-car-id' }) };
    service = new DataIoService(prisma as any, carsService as any);
  });

  const importSheets = async (sheets: SheetDef[]) =>
    service.importWorkbook('user-1', await buildTestWorkbook(sheets), NOW);

  // A new-car sheet with one expense row built from VALID_ROW + overrides.
  const importRow = (overrides: Record<string, unknown>) =>
    importSheets([
      {
        name: 'Car',
        car: fullCarSheet(),
        expenses: [{ ...VALID_ROW, ...overrides }],
      },
    ]);

  const createdExpense = () =>
    prisma.expense.create.mock.calls[0][0].data as Record<string, unknown>;

  const expectNothingWritten = () => {
    expect(carsService.create).not.toHaveBeenCalled();
    expect(prisma.expense.create).not.toHaveBeenCalled();
    expect(prisma.expense.update).not.toHaveBeenCalled();
  };

  describe('exportWorkbook', () => {
    it('produces one correctly-named sheet per car with header block + expense rows', async () => {
      prisma.car.findMany.mockResolvedValue([
        CAR_FIXTURE,
        { ...CAR_FIXTURE, id: 'car-2', model: 'Creta', year: 2023, vin: null },
      ]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);

      const buffer = await service.exportWorkbook('user-1');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Swift 2022',
        'Creta 2023',
      ]);
      const sheet1 = wb.getWorksheet('Swift 2022')!;
      expect(sheet1.getCell(3, 2).value).toBe('Maruti Suzuki');
      expect(
        sheet1.getCell(EXPENSE_DATA_START_ROW, colOf('category')).value,
      ).toBe('FUEL');
      expect(
        sheet1.getCell(EXPENSE_DATA_START_ROW, colOf('amount')).value,
      ).toBe(1000);
      const sheet2 = wb.getWorksheet('Creta 2023')!;
      expect(sheet2.getCell(4, 2).value).toBe('Creta');
      expect(sheet2.getCell(EXPENSE_DATA_START_ROW, 1).value).toBeNull();
    });

    it('de-duplicates sheet names for two cars sharing model + year', async () => {
      prisma.car.findMany.mockResolvedValue([
        { ...CAR_FIXTURE, id: 'car-1' },
        { ...CAR_FIXTURE, id: 'car-2' },
      ]);

      const buffer = await service.exportWorkbook('user-1');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Swift 2022',
        'Swift 2022 (2)',
      ]);
    });

    it('keeps IDs in the file but hides and locks them, leaving expenses editable', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);

      const buffer = await service.exportWorkbook('user-1');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = wb.getWorksheet('Swift 2022')!;
      const carIdRow = rowOf('carId');

      expect(sheet.getCell(carIdRow, 2).value).toBe('car-1');
      expect(sheet.getRow(carIdRow).hidden).toBe(true);
      expect(sheet.getCell(carIdRow, 2).protection?.locked).not.toBe(false);

      const idCol = colOf('expenseId');
      expect(sheet.getCell(EXPENSE_DATA_START_ROW, idCol).value).toBe('exp-1');
      expect(sheet.getColumn(idCol).hidden).toBe(true);

      const protection = (
        sheet as unknown as {
          sheetProtection?: { sheet?: boolean; formatColumns?: boolean };
        }
      ).sheetProtection;
      expect(protection?.sheet).toBe(true);
      // Unhiding the ID column/row would need format permission.
      expect(protection?.formatColumns).toBeUndefined();

      // Car Details of an existing car are read-only; expenses stay editable.
      expect(sheet.getCell(3, 2).protection?.locked).not.toBe(false);
      expect(
        sheet.getCell(EXPENSE_DATA_START_ROW, colOf('amount')).protection
          ?.locked,
      ).toBe(false);
    });

    it('round-trips: re-importing an export updates records in place', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);

      const buffer = await service.exportWorkbook('user-1');
      const result = await service.importWorkbook('user-1', buffer, NOW);

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.expensesUpdated).toBe(1);
      expect(carsService.create).not.toHaveBeenCalled();
      expect(prisma.expense.create).not.toHaveBeenCalled();
      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({
          category: 'FUEL',
          amount: 1000,
          expenseDate: new Date('2026-08-01'),
          notes: 'Full tank',
        }),
      });
    });
  });

  describe('buildTemplate', () => {
    it('produces exactly a Read Me sheet and one Example Car sheet with dropdowns', async () => {
      const buffer = await service.buildTemplate();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      expect(wb.worksheets.map((s) => s.name)).toEqual([
        READ_ME_SHEET_NAME,
        EXAMPLE_SHEET_NAME,
      ]);
      const example = wb.getWorksheet(EXAMPLE_SHEET_NAME)!;
      expect(example.getCell(rowOf('fuelType'), 2).dataValidation?.type).toBe(
        'list',
      );
      expect(
        example.getCell(EXPENSE_DATA_START_ROW, colOf('currency'))
          .dataValidation?.type,
      ).toBe('list');
      expect(
        example.getCell(EXPENSE_DATA_START_ROW, colOf('category')).value,
      ).toBe('FUEL');
      // A new car's details must be fillable.
      expect(example.getCell(3, 2).protection?.locked).toBe(false);
    });

    it('imports cleanly as-is', async () => {
      const result = await service.importWorkbook(
        'user-1',
        await service.buildTemplate(),
        NOW,
      );
      expect(result.errors).toEqual([]);
      expect(result.carsCreated).toBe(1);
      expect(result.expensesCreated).toBe(1);
    });
  });

  describe('importWorkbook — writes', () => {
    it('creates a new car and its expenses, filling defaults and nulls', async () => {
      const result = await importRow({});

      expect(carsService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          make: 'Maruti Suzuki',
          model: 'Swift',
          year: 2022,
        }),
      );
      expect(createdExpense()).toEqual(
        expect.objectContaining({
          carId: 'new-car-id',
          category: 'SERVICE',
          amount: 2000,
          currency: 'INR',
          expenseDate: new Date('2026-08-01'),
          notes: null,
          litres: null,
        }),
      );
      expect(result).toEqual({
        carsCreated: 1,
        expensesCreated: 1,
        expensesUpdated: 0,
        errors: [],
        warnings: [],
      });
    });

    it('updates an existing expense with exactly what the sheet shows — cleared cells clear the field', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);

      const result = await importSheets([
        {
          name: 'Swift',
          car: fullCarSheet({ carId: 'car-1' }),
          // Notes and odometer cleared, fuel station removed, amount changed.
          expenses: [
            {
              expenseId: 'exp-1',
              expenseDate: '2026-08-01',
              category: 'FUEL',
              amount: 1200,
              litres: 10.5,
              fuelPricePerLitre: 95.24,
            },
          ],
        },
      ]);

      expect(result.errors).toEqual([]);
      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({
          amount: 1200,
          notes: null,
          odometerKm: null,
          fuelStation: null,
        }),
      });
    });

    it("ignores an existing car's details, even invalid ones, and still imports its expenses", async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);

      const result = await importSheets([
        {
          name: 'Tampered',
          car: fullCarSheet({ carId: 'car-1', make: '', fuelType: 'Steam' }),
          expenses: [VALID_ROW],
        },
      ]);

      expect(result.errors).toEqual([]);
      expect(createdExpense()).toEqual(
        expect.objectContaining({ carId: 'car-1' }),
      );
    });
  });

  describe('importWorkbook — all-or-nothing', () => {
    it('imports nothing from any sheet when one row has an error, and reports every error', async () => {
      const result = await importSheets([
        { name: 'Good', car: fullCarSheet(), expenses: [VALID_ROW] },
        {
          name: 'Bad',
          car: fullCarSheet({ model: 'Creta' }),
          expenses: [
            { ...VALID_ROW, amount: 'abc' },
            { ...VALID_ROW, category: 'Snacks' },
          ],
        },
      ]);

      expectNothingWritten();
      expect(
        result.carsCreated + result.expensesCreated + result.expensesUpdated,
      ).toBe(0);
      expect(result.errors).toHaveLength(2);
      expectIssue(result.errors, '"Amount" must be a number', {
        sheet: 'Bad',
        cell: `C${EXPENSE_DATA_START_ROW}`,
      });
      expectIssue(result.errors, '"Category" value "Snacks"', {
        cell: `B${EXPENSE_DATA_START_ROW + 1}`,
      });
    });

    it('undoes everything already written when a write fails partway', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);
      prisma.expense.create
        .mockResolvedValueOnce({ id: 'created-1' })
        .mockRejectedValueOnce(new Error('connection reset'));

      await expect(
        importSheets([
          {
            name: 'Swift',
            car: fullCarSheet({ carId: 'car-1' }),
            expenses: [{ expenseId: 'exp-1', ...VALID_ROW }, VALID_ROW],
          },
          {
            name: 'New',
            car: fullCarSheet({ model: 'Creta' }),
            expenses: [VALID_ROW],
          },
        ]),
      ).rejects.toThrow(InternalServerErrorException);

      // The update to exp-1 is restored from its original values…
      expect(prisma.expense.update).toHaveBeenLastCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({ amount: 1000, notes: 'Full tank' }),
      });
      // …and everything created is deleted.
      expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['created-1'] } },
      });
      // The "New" sheet's car was created just before its expense failed.
      expect(prisma.car.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['new-car-id'] } },
      });
    });
  });

  // Each of these used to save wrong data silently or crash mid-import.
  describe('importWorkbook — previously-silent bugs', () => {
    it('reads 03/04/2026 day-first, as 3 April', async () => {
      await importRow({ expenseDate: '03/04/2026' });
      expect(createdExpense().expenseDate).toEqual(new Date('2026-04-03'));
    });

    it.each([
      ['2026-02-30', 'impossible ISO date'],
      ['31/02/2026', 'impossible day-first date'],
      ['5', 'a bare number typed as text'],
      ['1 Aug', 'a date with no year'],
      ['next tuesday', 'free text'],
    ])('rejects %s (%s) instead of guessing a date', async (value) => {
      const result = await importRow({ expenseDate: value });
      expectNothingWritten();
      expectIssue(result.errors, "isn't a valid date", {
        cell: `A${EXPENSE_DATA_START_ROW}`,
      });
    });

    it('rejects a fractional odometer instead of crashing the import', async () => {
      const result = await importRow({ odometerKm: 12.5 });
      expectIssue(result.errors, '"Odometer (km)" must be a whole number');
    });

    it('rejects a fractional car year', async () => {
      const result = await importSheets([
        {
          name: 'Car',
          car: fullCarSheet({ year: 2022.5 }),
          expenses: [VALID_ROW],
        },
      ]);
      expectIssue(result.errors, '"Year" must be a whole number', {
        cell: `B${rowOf('year')}`,
      });
    });

    it.each([
      ['amount', 150_000_000, '"Amount" must be at most'],
      ['amount', 12.345, '"Amount" can have at most 2 decimal places'],
      ['amount', 0, '"Amount" must be at least 0.01'],
      ['litres', 1_000_000, '"Litres" must be at most'],
    ])(
      'rejects %s = %s beyond what the database can store',
      async (key, value, message) => {
        const result = await importRow(
          key === 'litres'
            ? { category: 'FUEL', litres: value, fuelPricePerLitre: 100 }
            : { [key]: value },
        );
        expectIssue(result.errors, message);
      },
    );

    it.each(['Infinity', '0x10', '1e5', '12abc', 'true'])(
      'rejects "%s" as a number',
      async (value) => {
        const result = await importRow({ amount: value });
        expectIssue(result.errors, '"Amount" must be a number, e.g. 1500');
      },
    );

    it.each([
      ['1,500', 1500],
      ['₹1,500', 1500],
      ['Rs. 1500.50', 1500.5],
      [' 2000 ', 2000],
    ])('accepts "%s" as %s', async (value, expected) => {
      const result = await importRow({ amount: value });
      expect(result.errors).toEqual([]);
      expect(createdExpense().amount).toBe(expected);
    });

    it('rejects the same expense row pasted twice (same hidden ID)', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);
      const row = { expenseId: 'exp-1', ...VALID_ROW };

      const result = await importSheets([
        {
          name: 'Swift',
          car: fullCarSheet({ carId: 'car-1' }),
          expenses: [row, row],
        },
      ]);

      expectNothingWritten();
      expectIssue(result.errors, 'is a copy of "Swift" row 17', {
        row: EXPENSE_DATA_START_ROW + 1,
      });
    });

    it("rejects an expense row copied onto another car's sheet", async () => {
      prisma.car.findMany.mockResolvedValue([
        CAR_FIXTURE,
        { ...CAR_FIXTURE, id: 'car-2', model: 'Creta' },
      ]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]); // belongs to car-1

      const result = await importSheets([
        {
          name: 'Creta',
          car: fullCarSheet({ carId: 'car-2' }),
          expenses: [{ expenseId: 'exp-1', ...VALID_ROW }],
        },
      ]);

      expectNothingWritten();
      expectIssue(result.errors, 'belongs to a different car');
    });

    it('rejects a duplicated exported car sheet', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      const sheet = {
        car: fullCarSheet({ carId: 'car-1' }),
        expenses: [VALID_ROW],
      };

      const result = await importSheets([
        { name: 'Swift 2022', ...sheet },
        { name: 'Swift 2022 (copy)', ...sheet },
      ]);

      expectNothingWritten();
      expectIssue(result.errors, 'is a copy of "Swift 2022"', {
        sheet: 'Swift 2022 (copy)',
      });
    });
  });

  describe('importWorkbook — cell rules', () => {
    it.each([
      ['tyre', 'TYRES'],
      ['fuel', 'FUEL'],
      ['Mods', 'MOD'],
    ])('accepts category "%s" as %s', async (value, expected) => {
      await importRow({ category: value });
      expect(createdExpense().category).toBe(expected);
    });

    it('lists the valid categories when one is wrong', async () => {
      const result = await importRow({ category: 'Snacks' });
      expectIssue(result.errors, "isn't one of: PURCHASE, FUEL");
    });

    it('normalizes currency case and rejects unknown currencies', async () => {
      await importRow({ currency: 'usd' });
      expect(createdExpense().currency).toBe('USD');

      const result = await importRow({ currency: 'Rupees' });
      expectIssue(
        result.errors,
        '"Currency" value "Rupees" isn\'t one of: INR',
      );
    });

    it('rejects a future expense date, allowing one day of timezone leeway', async () => {
      expect((await importRow({ expenseDate: '2026-10-03' })).errors).toEqual(
        [],
      );
      const result = await importRow({ expenseDate: '2026-10-05' });
      expectIssue(result.errors, "can't be in the future");
    });

    it('rejects a date before 1900', async () => {
      const result = await importRow({ expenseDate: '1899-12-01' });
      expectIssue(result.errors, "can't be before 1900");
    });

    it('converts a numeric Excel date serial', async () => {
      await importRow({ expenseDate: 46235 }); // 2026-08-01
      expect(createdExpense().expenseDate).toEqual(new Date('2026-08-01'));
    });

    it('rejects text over the length limit', async () => {
      const result = await importRow({ notes: 'x'.repeat(1001) });
      expectIssue(
        result.errors,
        '"Notes" is too long (1001 characters, max 1000)',
      );
    });

    it('rejects an Excel error cell rather than treating it as blank', async () => {
      const result = await importRow({ amount: { error: '#DIV/0!' } });
      expectIssue(result.errors, '"Amount" contains an Excel error (#DIV/0!)');
    });

    it("uses a formula cell's calculated result", async () => {
      await importRow({ amount: { formula: '1000*2', result: 2000 } });
      expect(createdExpense().amount).toBe(2000);
    });

    it("validates and upper-cases a new car's VIN", async () => {
      const bad = await importSheets([
        { name: 'Car', car: fullCarSheet({ vin: 'ABC123' }), expenses: [] },
      ]);
      expectIssue(bad.errors, '"VIN" must be 17 letters/digits');

      await importSheets([
        {
          name: 'Car',
          car: fullCarSheet({ vin: 'ma3erlf1s00123456' }),
          expenses: [],
        },
      ]);
      expect(carsService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ vin: 'MA3ERLF1S00123456' }),
      );
    });

    it('drops a field that does not apply to the category, with a warning', async () => {
      const result = await importRow({
        category: 'SERVICE',
        fuelStation: 'HP',
      });

      expect(result.errors).toEqual([]);
      expectIssue(
        result.warnings,
        '"Fuel Station" is only used for FUEL expenses',
        {
          cell: `L${EXPENSE_DATA_START_ROW}`,
        },
      );
      expect(createdExpense().fuelStation).toBeNull();
    });

    it('requires litres and fuel price together on a FUEL row', async () => {
      const result = await importRow({ category: 'FUEL', litres: 5 });
      expectIssue(result.errors, 'must both be filled in');
    });
  });

  describe('importWorkbook — sheet and file checks', () => {
    it('reports a missing required column once, not on every row', async () => {
      const buffer = await buildTestWorkbook([
        {
          name: 'Car',
          car: fullCarSheet(),
          header: true,
          expenses: [VALID_ROW, VALID_ROW],
        },
      ]);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      wb
        .getWorksheet('Car')!
        .getCell(EXPENSE_HEADER_ROW, colOf('category')).value = 'Type';

      const result = await service.importWorkbook(
        'user-1',
        Buffer.from(await wb.xlsx.writeBuffer()),
        NOW,
      );

      expect(result.errors).toEqual([
        expect.objectContaining({
          message: expect.stringContaining('missing the "Category" column'),
        }),
      ]);
    });

    it('rejects data past the row limit instead of silently ignoring it', async () => {
      const buffer = await buildTestWorkbook([
        { name: 'Car', car: fullCarSheet(), expenses: [VALID_ROW] },
      ]);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      wb
        .getWorksheet('Car')!
        .getCell(EXPENSE_DATA_START_ROW + MAX_EXPENSE_ROWS, 2).value = 'FUEL';

      const result = await service.importWorkbook(
        'user-1',
        Buffer.from(await wb.xlsx.writeBuffer()),
        NOW,
      );
      expectIssue(
        result.errors,
        `Only ${MAX_EXPENSE_ROWS} expense rows per sheet`,
      );
    });

    it('skips blank sheets and the Read Me sheet', async () => {
      const buffer = await buildTestWorkbook([
        { name: 'Car', car: fullCarSheet(), expenses: [VALID_ROW] },
      ]);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      wb.addWorksheet('Sheet1');
      wb.addWorksheet(READ_ME_SHEET_NAME).getCell(1, 1).value = 'Instructions';

      const result = await service.importWorkbook(
        'user-1',
        Buffer.from(await wb.xlsx.writeBuffer()),
        NOW,
      );
      expect(result.errors).toEqual([]);
      expect(result.carsCreated).toBe(1);
    });

    it.each([
      [
        'a CSV renamed to .xlsx',
        Buffer.from('date,amount\n2026-08-01,500'),
        'isn’t an Excel .xlsx file',
      ],
      [
        'an old .xls / password-protected file',
        Buffer.concat([
          Buffer.from('d0cf11e0a1b11ae1', 'hex'),
          Buffer.alloc(32),
        ]),
        'old .xls file or a password-protected',
      ],
      [
        'a damaged .xlsx',
        Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(32)]),
        'may be damaged',
      ],
    ])(
      'rejects %s with a specific message',
      async (_label, buffer, message) => {
        const promise = service.importWorkbook('user-1', buffer, NOW);
        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(promise).rejects.toThrow(message);
      },
    );

    it("rejects a sheet for a car that isn't the user's", async () => {
      const result = await importSheets([
        {
          name: 'Not Mine',
          car: fullCarSheet({ carId: 'someone-elses' }),
          expenses: [VALID_ROW],
        },
      ]);
      expectNothingWritten();
      expectIssue(result.errors, 'not found or is not yours', {
        sheet: 'Not Mine',
      });
    });

    it('rejects an expense that no longer exists', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      const result = await importSheets([
        {
          name: 'Swift',
          car: fullCarSheet({ carId: 'car-1' }),
          expenses: [{ expenseId: 'deleted-exp', ...VALID_ROW }],
        },
      ]);
      expectIssue(result.errors, 'no longer exists in your account');
    });

    it('rejects an exported row pasted into a new-car sheet', async () => {
      const result = await importSheets([
        {
          name: 'New',
          car: fullCarSheet(),
          expenses: [{ expenseId: 'exp-1', ...VALID_ROW }],
        },
      ]);
      expectIssue(result.errors, 'this sheet is a new car');
    });

    it('warns (but imports) when a new car matches one the user already has', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      const result = await importRow({});
      expect(result.errors).toEqual([]);
      expect(result.carsCreated).toBe(1);
      expectIssue(
        result.warnings,
        'You already have a 2022 Maruti Suzuki Swift ZXI+',
      );
    });

    it('imports files exported with the old layout (Expense ID in column A)', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      prisma.expense.findMany.mockResolvedValue([EXPENSE_FIXTURE]);
      const oldOrder = [
        ['Expense ID', 'exp-1'],
        ['Category', 'SERVICE'],
        ['Amount', 2000],
        ['Currency', 'INR'],
        ['Expense Date', '2026-07-01'],
      ] as const;
      const buffer = await buildTestWorkbook([
        { name: 'Old Export', car: fullCarSheet({ carId: 'car-1' }) },
      ]);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = wb.getWorksheet('Old Export')!;
      oldOrder.forEach(([label, value], index) => {
        sheet.getCell(EXPENSE_HEADER_ROW, index + 1).value = label;
        sheet.getCell(EXPENSE_DATA_START_ROW, index + 1).value = value;
      });

      const result = await service.importWorkbook(
        'user-1',
        Buffer.from(await wb.xlsx.writeBuffer()),
        NOW,
      );

      expect(result.errors).toEqual([]);
      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({
          category: 'SERVICE',
          amount: 2000,
          expenseDate: new Date('2026-07-01'),
        }),
      });
    });

    it('skips a row whose visible cells were cleared, leaving only its hidden ID', async () => {
      prisma.car.findMany.mockResolvedValue([CAR_FIXTURE]);
      const result = await importSheets([
        {
          name: 'Cleared',
          car: fullCarSheet({ carId: 'car-1' }),
          expenses: [{ expenseId: 'exp-1' }],
        },
      ]);
      expect(result.errors).toEqual([]);
      expectNothingWritten();
    });
  });
});
