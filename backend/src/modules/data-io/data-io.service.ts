import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CarsService } from '../cars/cars.service';
import { CreateCarDto } from '../cars/dto/create-car.dto';
import { ExpensesService } from '../expenses/expenses.service';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { ExpenseCategory } from '../../../generated/prisma/enums';
import { ImportResultDto } from './dto/import-result.dto';
import { RowErrorDto } from './dto/row-error.dto';
import {
  buildExportWorkbook,
  buildTemplateWorkbook,
} from './workbook/workbook-writer';
import { readWorkbook, WorkbookParseError } from './workbook/workbook-reader';
import { CarRow, ExpenseRow } from './workbook/workbook-columns';

@Injectable()
export class DataIoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carsService: CarsService,
    private readonly expensesService: ExpensesService,
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

    const workbook = buildExportWorkbook(
      cars.map((car) => ({
        ...car,
        expenses: expensesByCarId.get(car.id) ?? [],
      })),
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = buildTemplateWorkbook();
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importWorkbook(
    userId: string,
    buffer: Buffer,
  ): Promise<ImportResultDto> {
    let parsed: Awaited<ReturnType<typeof readWorkbook>>;
    try {
      parsed = await readWorkbook(buffer);
    } catch (error) {
      if (error instanceof WorkbookParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const result: ImportResultDto = {
      carsCreated: 0,
      carsUpdated: 0,
      expensesCreated: 0,
      expensesUpdated: 0,
      errors: parsed.errors.map((e) => ({ ...e }) satisfies RowErrorDto),
    };

    // Sequential across sheets and within each sheet's expenses — no
    // $transaction available (Section 0's Prisma driver-adapter gotcha), so
    // this is deliberately best-effort: one bad sheet or row is recorded as
    // an error and skipped, never aborting the rest of the import.
    for (const sheet of parsed.sheets) {
      const carId = await this.upsertCar(
        userId,
        sheet.sheetName,
        sheet.car,
        result,
      );
      if (!carId) continue;

      for (let i = 0; i < sheet.expenses.length; i++) {
        await this.upsertExpense(
          userId,
          carId,
          sheet.sheetName,
          sheet.expenses[i],
          result,
        );
      }
    }

    return result;
  }

  private async upsertCar(
    userId: string,
    sheetName: string,
    car: CarRow,
    result: ImportResultDto,
  ): Promise<string | undefined> {
    const { carId, ...dto } = car;
    const createDto: CreateCarDto = dto;

    if (!carId) {
      const created = await this.carsService.create(userId, createDto);
      result.carsCreated += 1;
      return created.id;
    }

    try {
      await this.carsService.update(userId, carId, createDto);
      result.carsUpdated += 1;
      return carId;
    } catch (error) {
      if (error instanceof NotFoundException) {
        result.errors.push({
          sheet: sheetName,
          message: `Car ID "${carId}" was not found or is not yours — this sheet was skipped.`,
        });
        return undefined;
      }
      throw error;
    }
  }

  private async upsertExpense(
    userId: string,
    carId: string,
    sheetName: string,
    expense: ExpenseRow,
    result: ImportResultDto,
  ): Promise<void> {
    const { expenseId, ...dto } = expense;
    // Safe cast: workbook-reader.ts's matchEnum() already validated `category`
    // against EXPENSE_CATEGORIES (== Object.values(ExpenseCategory)) before
    // this ever reaches here.
    const createDto: CreateExpenseDto = {
      ...dto,
      category: dto.category as ExpenseCategory,
    };

    if (!expenseId) {
      await this.expensesService.create(userId, carId, createDto);
      result.expensesCreated += 1;
      return;
    }

    try {
      await this.expensesService.update(userId, expenseId, createDto);
      result.expensesUpdated += 1;
    } catch (error) {
      if (error instanceof NotFoundException) {
        result.errors.push({
          sheet: sheetName,
          message: `Expense ID "${expenseId}" was not found or is not yours — this row was skipped.`,
        });
        return;
      }
      throw error;
    }
  }
}
