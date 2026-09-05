import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginate } from '../../common/interfaces/paginated-result.interface';
import { CarsService } from '../cars/cars.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carsService: CarsService,
  ) {}

  async create(userId: string, carId: string, dto: CreateExpenseDto) {
    await this.carsService.findOneForUser(userId, carId);
    return this.prisma.expense.create({
      data: { ...dto, carId, expenseDate: new Date(dto.expenseDate) },
    });
  }

  async findAllForCar(
    userId: string,
    carId: string,
    { page, pageSize }: PaginationQueryDto,
  ) {
    await this.carsService.findOneForUser(userId, carId);
    // Sequential, not Promise.all — see Section 0's Prisma driver-adapter gotcha.
    const data = await this.prisma.expense.findMany({
      where: { carId },
      orderBy: { expenseDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.expense.count({ where: { carId } });
    return paginate(data, total, page, pageSize);
  }

  async findOneForUser(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, car: { userId } },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(userId: string, expenseId: string, dto: UpdateExpenseDto) {
    await this.findOneForUser(userId, expenseId);
    const { expenseDate, ...rest } = dto;
    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...rest,
        ...(expenseDate && { expenseDate: new Date(expenseDate) }),
      },
    });
  }

  async remove(userId: string, expenseId: string) {
    await this.findOneForUser(userId, expenseId);
    await this.prisma.expense.delete({ where: { id: expenseId } });
  }
}
