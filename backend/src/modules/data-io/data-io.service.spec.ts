import { NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataIoService } from './data-io.service';
import {
  CAR_HEADER_FIELDS,
  EXAMPLE_SHEET_NAME,
  EXPENSE_COLUMNS,
  EXPENSE_DATA_START_ROW,
  READ_ME_SHEET_NAME,
} from './workbook/workbook-columns';

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

function fullCarSheet(overrides: Partial<Record<string, unknown>> = {}) {
  const values: Record<string, unknown> = {
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
  return values;
}

async function buildTestWorkbook(
  sheets: Array<{
    name: string;
    car: Record<string, unknown>;
    expenses?: Array<Record<string, unknown>>;
  }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name);
    for (const field of CAR_HEADER_FIELDS) {
      const value = sheetDef.car[field.key];
      sheet.getCell(field.row, 2).value =
        value === undefined ? null : (value as string | number);
    }
    (sheetDef.expenses ?? []).forEach((expense, index) => {
      const row = EXPENSE_DATA_START_ROW + index;
      for (const col of EXPENSE_COLUMNS) {
        const value = expense[col.key];
        sheet.getCell(row, col.col).value =
          value === undefined ? null : (value as string | number);
      }
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('DataIoService', () => {
  let service: DataIoService;
  let prisma: {
    car: { findMany: jest.Mock };
    expense: { findMany: jest.Mock };
  };
  let carsService: { create: jest.Mock; update: jest.Mock };
  let expensesService: { create: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    prisma = { car: { findMany: jest.fn() }, expense: { findMany: jest.fn() } };
    carsService = { create: jest.fn(), update: jest.fn() };
    expensesService = { create: jest.fn(), update: jest.fn() };
    service = new DataIoService(
      prisma as any,
      carsService as any,
      expensesService as any,
    );
  });

  describe('exportWorkbook', () => {
    it('produces one correctly-named sheet per car with header block + expense rows', async () => {
      prisma.car.findMany.mockResolvedValue([
        CAR_FIXTURE,
        { ...CAR_FIXTURE, id: 'car-2', model: 'Creta', year: 2023, vin: null },
      ]);
      prisma.expense.findMany.mockResolvedValue([
        {
          id: 'exp-1',
          carId: 'car-1',
          category: 'FUEL',
          amount: 1000,
          currency: 'INR',
          expenseDate: new Date('2026-08-01'),
          odometerKm: 24500,
          notes: null,
          workshopName: null,
          workPerformed: null,
          whatBroke: null,
          litres: 10.5,
          fuelPricePerLitre: 95.24,
          fuelStation: 'Indian Oil',
          tyreBrand: null,
          tyreSize: null,
        },
      ]);

      const buffer = await service.exportWorkbook('user-1');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Swift 2022',
        'Creta 2023',
      ]);

      const sheet1 = wb.getWorksheet('Swift 2022')!;
      expect(sheet1.getCell(3, 2).value).toBe('Maruti Suzuki');
      expect(sheet1.getCell(EXPENSE_DATA_START_ROW, 2).value).toBe('FUEL');
      expect(sheet1.getCell(EXPENSE_DATA_START_ROW, 3).value).toBe(1000);

      const sheet2 = wb.getWorksheet('Creta 2023')!;
      expect(sheet2.getCell(4, 2).value).toBe('Creta');
      // Car with zero expenses still produces a valid, headerless-but-present table
      expect(sheet2.getCell(EXPENSE_DATA_START_ROW, 1).value).toBeNull();
    });

    it('de-duplicates sheet names for two cars sharing model + year', async () => {
      prisma.car.findMany.mockResolvedValue([
        { ...CAR_FIXTURE, id: 'car-1' },
        { ...CAR_FIXTURE, id: 'car-2' },
      ]);
      prisma.expense.findMany.mockResolvedValue([]);

      const buffer = await service.exportWorkbook('user-1');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Swift 2022',
        'Swift 2022 (2)',
      ]);
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
      expect(example.getCell(9, 2).dataValidation?.type).toBe('list');
      expect(example.getCell(EXPENSE_DATA_START_ROW, 2).value).toBe('FUEL');
    });
  });

  describe('importWorkbook', () => {
    it('creates a new car and its expenses when Car ID is blank', async () => {
      carsService.create.mockResolvedValue({ id: 'new-car-id' });
      const buffer = await buildTestWorkbook([
        {
          name: 'New Car',
          car: fullCarSheet(),
          expenses: [
            {
              expenseId: '',
              category: 'FUEL',
              amount: 500,
              currency: 'INR',
              expenseDate: '2026-08-01',
              odometerKm: 100,
              litres: 5,
              fuelPricePerLitre: 100,
            },
          ],
        },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(carsService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ make: 'Maruti Suzuki', model: 'Swift' }),
      );
      expect(expensesService.create).toHaveBeenCalledWith(
        'user-1',
        'new-car-id',
        expect.objectContaining({ category: 'FUEL', amount: 500 }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          carsCreated: 1,
          carsUpdated: 0,
          expensesCreated: 1,
          expensesUpdated: 0,
          errors: [],
        }),
      );
    });

    it('updates an existing car and expense when IDs are present', async () => {
      carsService.update.mockResolvedValue({ id: 'car-1' });
      expensesService.update.mockResolvedValue({ id: 'exp-1' });
      const buffer = await buildTestWorkbook([
        {
          name: 'Existing Car',
          car: fullCarSheet({ carId: 'car-1' }),
          expenses: [
            {
              expenseId: 'exp-1',
              category: 'SERVICE',
              amount: 2000,
              expenseDate: '2026-07-01',
              workshopName: 'Local Garage',
            },
          ],
        },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(carsService.update).toHaveBeenCalledWith(
        'user-1',
        'car-1',
        expect.objectContaining({ make: 'Maruti Suzuki' }),
      );
      expect(expensesService.update).toHaveBeenCalledWith(
        'user-1',
        'exp-1',
        expect.objectContaining({ category: 'SERVICE', amount: 2000 }),
      );
      expect(result.carsUpdated).toBe(1);
      expect(result.expensesUpdated).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('records a sheet-level error and skips the sheet when Car ID is not owned', async () => {
      carsService.update.mockRejectedValue(
        new NotFoundException('Car not found'),
      );
      const buffer = await buildTestWorkbook([
        {
          name: 'Not Mine',
          car: fullCarSheet({ carId: 'someone-elses-car' }),
          expenses: [
            {
              expenseId: '',
              category: 'FUEL',
              amount: 100,
              expenseDate: '2026-08-01',
            },
          ],
        },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(expensesService.create).not.toHaveBeenCalled();
      expect(result.carsUpdated).toBe(0);
      expect(result.errors).toEqual([
        expect.objectContaining({
          sheet: 'Not Mine',
          message: expect.stringContaining('not found or is not yours'),
        }),
      ]);
    });

    it('reports a missing required field and skips that sheet entirely', async () => {
      const buffer = await buildTestWorkbook([
        { name: 'Bad Car', car: fullCarSheet({ make: '' }) },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(carsService.create).not.toHaveBeenCalled();
      expect(result.errors).toEqual([
        expect.objectContaining({
          sheet: 'Bad Car',
          message: '"Make" is required',
        }),
      ]);
    });

    it('rejects an unrecognized enum value and lists valid options', async () => {
      const buffer = await buildTestWorkbook([
        { name: 'Bad Fuel', car: fullCarSheet({ fuelType: 'Petorl' }) },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(result.errors[0].message).toContain('is not one of');
      expect(result.errors[0].message).toContain('Petrol');
    });

    it('rejects a FUEL row with only one of litres/fuelPricePerLitre set', async () => {
      carsService.create.mockResolvedValue({ id: 'new-car-id' });
      const buffer = await buildTestWorkbook([
        {
          name: 'Partial Fuel',
          car: fullCarSheet(),
          expenses: [
            {
              expenseId: '',
              category: 'FUEL',
              amount: 500,
              expenseDate: '2026-08-01',
              litres: 5,
              // fuelPricePerLitre intentionally omitted
            },
          ],
        },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(expensesService.create).not.toHaveBeenCalled();
      expect(result.errors[0].message).toContain(
        'Litres" and "Fuel Price/Litre"',
      );
      expect(result.errors[0].row).toBe(EXPENSE_DATA_START_ROW);
    });

    it('coerces a numeric Excel date serial to the correct calendar date', async () => {
      carsService.create.mockResolvedValue({ id: 'new-car-id' });
      // 46600 is Excel serial for 2027-08-01, cross-checked against the
      // well-established serial-to-Date formula independently of our own code.
      const buffer = await buildTestWorkbook([
        {
          name: 'Date Test',
          car: fullCarSheet(),
          expenses: [
            {
              expenseId: '',
              category: 'OTHER',
              amount: 10,
              expenseDate: 46600,
            },
          ],
        },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(result.errors).toEqual([]);
      expect(expensesService.create).toHaveBeenCalledWith(
        'user-1',
        'new-car-id',
        expect.objectContaining({ expenseDate: '2027-08-01' }),
      );
    });

    it('rejects a non-numeric amount', async () => {
      carsService.create.mockResolvedValue({ id: 'new-car-id' });
      const buffer = await buildTestWorkbook([
        {
          name: 'Bad Amount',
          car: fullCarSheet(),
          expenses: [
            {
              expenseId: '',
              category: 'OTHER',
              amount: 'lots',
              expenseDate: '2026-08-01',
            },
          ],
        },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(expensesService.create).not.toHaveBeenCalled();
      expect(result.errors[0].message).toBe('"Amount" must be a number');
    });

    it('does not let one bad sheet block another valid sheet in the same file', async () => {
      carsService.create.mockResolvedValue({ id: 'new-car-id' });
      const buffer = await buildTestWorkbook([
        { name: 'Bad Sheet', car: fullCarSheet({ make: '' }) },
        { name: 'Good Sheet', car: fullCarSheet() },
      ]);

      const result = await service.importWorkbook('user-1', buffer);

      expect(result.carsCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].sheet).toBe('Bad Sheet');
    });

    it('skips a "Read Me" sheet rather than treating it as a car', async () => {
      carsService.create.mockResolvedValue({ id: 'new-car-id' });
      const buffer = await buildTestWorkbook([
        { name: 'Real Car', car: fullCarSheet() },
      ]);
      const combined = new ExcelJS.Workbook();
      await combined.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const readMeSheet = combined.addWorksheet(READ_ME_SHEET_NAME);
      readMeSheet.getCell(1, 1).value = 'Instructions go here';
      const finalBuffer = Buffer.from(await combined.xlsx.writeBuffer());

      const result = await service.importWorkbook('user-1', finalBuffer);

      expect(result.carsCreated).toBe(1);
      expect(result.errors).toEqual([]);
    });
  });
});
