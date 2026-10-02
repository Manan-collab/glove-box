import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CarsService } from '../cars/cars.service';
import { CreateCarDto } from '../cars/dto/create-car.dto';
import { Expense } from '../../../generated/prisma/client';
import { ExpenseCategory } from '../../../generated/prisma/enums';
import { ImportResultDto } from './dto/import-result.dto';
import {
  buildExportWorkbook,
  buildTemplateWorkbook,
} from './workbook/workbook-writer';
import { readWorkbook, WorkbookParseError } from './workbook/workbook-reader';
import {
  DEFAULT_CURRENCY,
  ExpenseRow,
  ParsedCarSheet,
} from './workbook/workbook-columns';

@Injectable()
export class DataIoService {
  private readonly logger = new Logger(DataIoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly carsService: CarsService,
  ) {}

  async exportWorkbook(userId: string): Promise<Buffer> {
    // Sequential, not Promise.all — see Section 0's Prisma driver-adapter gotcha.
    const cars = await this.prisma.car.findMany({ where: { userId } });
    const expenses = await this.prisma.expense.findMany({
      where: { car: { userId } },
      orderBy: { expenseDate: 'asc' },
    });

    const expensesByCarId = new Map<string, typeof expenses>();
    for (const expense of expenses) {
      const list = expensesByCarId.get(expense.carId) ?? [];
      list.push(expense);
      expensesByCarId.set(expense.carId, list);
    }

    const workbook = await buildExportWorkbook(
      cars.map((car) => ({
        ...car,
        expenses: expensesByCarId.get(car.id) ?? [],
      })),
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = await buildTemplateWorkbook();
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // All-or-nothing: the whole file is validated — cell rules, then the
  // database checks (ownership, rows copied between cars) — before anything is
  // written. Any error means nothing is imported and the full list comes back.
  async importWorkbook(
    userId: string,
    buffer: Buffer,
    now: Date = new Date(),
  ): Promise<ImportResultDto> {
    let parsed: Awaited<ReturnType<typeof readWorkbook>>;
    try {
      parsed = await readWorkbook(buffer, now);
    } catch (error) {
      if (error instanceof WorkbookParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const result: ImportResultDto = {
      carsCreated: 0,
      expensesCreated: 0,
      expensesUpdated: 0,
      errors: parsed.errors,
      warnings: parsed.warnings,
    };

    const originals = await this.checkAgainstDatabase(
      userId,
      parsed.sheets,
      result,
    );
    if (result.errors.length > 0) return result;

    await this.writeAll(userId, parsed.sheets, originals, result);
    return result;
  }

  // Returns the current DB state of every expense the file will update, so
  // the write phase can restore them if it fails partway.
  private async checkAgainstDatabase(
    userId: string,
    sheets: ParsedCarSheet[],
    result: ImportResultDto,
  ): Promise<Map<string, Expense>> {
    // Sequential, not Promise.all — see Section 0's Prisma driver-adapter gotcha.
    const userCars = await this.prisma.car.findMany({
      where: { userId },
      select: { id: true, make: true, model: true, year: true, variant: true },
    });
    const expenseIds = sheets.flatMap((sheet) =>
      sheet.expenses
        .map((e) => e.expense.expenseId)
        .filter((id): id is string => Boolean(id)),
    );
    const existingExpenses =
      expenseIds.length > 0
        ? await this.prisma.expense.findMany({
            where: { id: { in: expenseIds }, car: { userId } },
          })
        : [];

    const ownedCarIds = new Set(userCars.map((c) => c.id));
    const expensesById = new Map(existingExpenses.map((e) => [e.id, e]));
    const carKey = (c: {
      make: string;
      model: string;
      year: number;
      variant: string;
    }) =>
      [c.make, c.model, c.year, c.variant]
        .map((v) => String(v).trim().toLowerCase())
        .join('|');
    const knownCars = new Set(userCars.map(carKey));

    for (const sheet of sheets) {
      if ('newCar' in sheet) {
        // Not an error — owning two of the same car is legitimate — but the
        // usual cause is uploading the same template twice.
        const key = carKey(sheet.newCar);
        if (knownCars.has(key)) {
          const { make, model, year, variant } = sheet.newCar;
          result.warnings.push({
            sheet: sheet.sheetName,
            message: `You already have a ${year} ${make} ${model} ${variant} — this sheet adds a second one. If you meant to add expenses to that car, export your data and add them there instead.`,
          });
        }
        knownCars.add(key);
        continue;
      }

      if (!ownedCarIds.has(sheet.existingCarId)) {
        result.errors.push({
          sheet: sheet.sheetName,
          message: `Car ID "${sheet.existingCarId}" was not found or is not yours — this sheet can't be imported. Use a fresh export from your own account.`,
        });
        continue;
      }

      for (const { row, expense } of sheet.expenses) {
        if (!expense.expenseId) continue;
        const existing = expensesById.get(expense.expenseId);
        if (!existing) {
          result.errors.push({
            sheet: sheet.sheetName,
            row,
            message:
              'This expense no longer exists in your account (it may have been deleted in the app). To add it again, type it into a blank row.',
          });
        } else if (existing.carId !== sheet.existingCarId) {
          result.errors.push({
            sheet: sheet.sheetName,
            row,
            message:
              "This row belongs to a different car — it was probably copied from another car's sheet. Move it back, or type it into a blank row to add it to this car.",
          });
        }
      }
    }

    return expensesById;
  }

  // No $transaction in this stack (Section 0's Prisma driver-adapter gotcha),
  // so atomicity is emulated: every write is journaled, and on any failure
  // the journal is undone — updated expenses restored from their originals,
  // created expenses and cars deleted — before reporting the failure.
  private async writeAll(
    userId: string,
    sheets: ParsedCarSheet[],
    originals: Map<string, Expense>,
    result: ImportResultDto,
  ): Promise<void> {
    const journal: ImportJournal = {
      createdCarIds: [],
      createdExpenseIds: [],
      updatedOriginals: [],
    };

    try {
      for (const sheet of sheets) {
        let carId: string;
        if ('newCar' in sheet) {
          const createDto: CreateCarDto = sheet.newCar;
          const created = await this.carsService.create(userId, createDto);
          journal.createdCarIds.push(created.id);
          result.carsCreated += 1;
          carId = created.id;
        } else {
          carId = sheet.existingCarId;
        }

        for (const { expense } of sheet.expenses) {
          const data = toExpenseData(expense);
          if (expense.expenseId) {
            // Ownership and car were verified in checkAgainstDatabase. Written
            // directly rather than via ExpensesService.update so a cell the
            // user cleared clears the field (UpdateExpenseDto can't express
            // "set to null" — an omitted field is left unchanged).
            journal.updatedOriginals.push(originals.get(expense.expenseId)!);
            await this.prisma.expense.update({
              where: { id: expense.expenseId },
              data,
            });
            result.expensesUpdated += 1;
          } else {
            const created = await this.prisma.expense.create({
              data: { ...data, carId },
            });
            journal.createdExpenseIds.push(created.id);
            result.expensesCreated += 1;
          }
        }
      }
    } catch (error) {
      this.logger.error('Import failed mid-write; rolling back', error);
      await this.rollback(journal);
      throw new InternalServerErrorException(
        'The import failed partway through and was undone, so nothing was changed. Please try again.',
      );
    }
  }

  private async rollback(journal: ImportJournal): Promise<void> {
    const attempt = async (what: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (error) {
        this.logger.error(`Import rollback failed: ${what}`, error);
      }
    };

    for (const original of journal.updatedOriginals.reverse()) {
      await attempt(`restore expense ${original.id}`, () =>
        this.prisma.expense.update({
          where: { id: original.id },
          data: {
            category: original.category,
            amount: original.amount,
            currency: original.currency,
            expenseDate: original.expenseDate,
            odometerKm: original.odometerKm,
            notes: original.notes,
            workshopName: original.workshopName,
            workPerformed: original.workPerformed,
            whatBroke: original.whatBroke,
            litres: original.litres,
            fuelPricePerLitre: original.fuelPricePerLitre,
            fuelStation: original.fuelStation,
            tyreBrand: original.tyreBrand,
            tyreSize: original.tyreSize,
          },
        }),
      );
    }
    if (journal.createdExpenseIds.length > 0) {
      await attempt('delete created expenses', () =>
        this.prisma.expense.deleteMany({
          where: { id: { in: journal.createdExpenseIds } },
        }),
      );
    }
    if (journal.createdCarIds.length > 0) {
      // Cascades to any of their expenses not already deleted above.
      await attempt('delete created cars', () =>
        this.prisma.car.deleteMany({
          where: { id: { in: journal.createdCarIds } },
        }),
      );
    }
  }
}

interface ImportJournal {
  createdCarIds: string[];
  createdExpenseIds: string[];
  updatedOriginals: Expense[];
}

// Every field explicitly, blanks as null: on update this overwrites the row
// with exactly what the spreadsheet shows.
function toExpenseData(expense: ExpenseRow) {
  return {
    // Safe cast: validateCell matched it against EXPENSE_CATEGORIES.
    category: expense.category as ExpenseCategory,
    amount: expense.amount,
    currency: expense.currency ?? DEFAULT_CURRENCY,
    expenseDate: new Date(expense.expenseDate),
    odometerKm: expense.odometerKm ?? null,
    notes: expense.notes ?? null,
    workshopName: expense.workshopName ?? null,
    workPerformed: expense.workPerformed ?? null,
    whatBroke: expense.whatBroke ?? null,
    litres: expense.litres ?? null,
    fuelPricePerLitre: expense.fuelPricePerLitre ?? null,
    fuelStation: expense.fuelStation ?? null,
    tyreBrand: expense.tyreBrand ?? null,
    tyreSize: expense.tyreSize ?? null,
  };
}
