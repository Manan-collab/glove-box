import { NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: {
    expense: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let carsService: { findOneForUser: jest.Mock };

  const EXPENSE = {
    id: 'expense-1',
    carId: 'car-1',
    category: 'FUEL',
    amount: '2500.00',
    currency: 'INR',
    expenseDate: new Date('2026-08-01'),
    odometerKm: 42000,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      expense: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    carsService = { findOneForUser: jest.fn() };
    service = new ExpensesService(prisma as any, carsService as any);
  });

  it('verifies car ownership before creating an expense', async () => {
    carsService.findOneForUser.mockResolvedValue({ id: 'car-1' });
    prisma.expense.create.mockResolvedValue(EXPENSE);
    const dto = {
      category: 'FUEL',
      amount: 2500,
      expenseDate: '2026-08-01',
    } as any;

    await service.create('user-1', 'car-1', dto);

    expect(carsService.findOneForUser).toHaveBeenCalledWith('user-1', 'car-1');
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: { ...dto, carId: 'car-1', expenseDate: new Date('2026-08-01') },
    });
  });

  it('refuses to create an expense on a car the user does not own', async () => {
    carsService.findOneForUser.mockRejectedValue(new NotFoundException());
    const dto = {
      category: 'FUEL',
      amount: 2500,
      expenseDate: '2026-08-01',
    } as any;

    await expect(service.create('user-2', 'car-1', dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('lists expenses for a car only after verifying ownership', async () => {
    carsService.findOneForUser.mockResolvedValue({ id: 'car-1' });
    prisma.expense.findMany.mockResolvedValue([EXPENSE]);
    prisma.expense.count.mockResolvedValue(1);

    const result = await service.findAllForCar('user-1', 'car-1', {
      page: 1,
      pageSize: 20,
    });

    expect(carsService.findOneForUser).toHaveBeenCalledWith('user-1', 'car-1');
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { carId: 'car-1' } }),
    );
    expect(result.data).toEqual([EXPENSE]);
  });

  it('finds an expense by id scoped through the owning car', async () => {
    prisma.expense.findFirst.mockResolvedValue(EXPENSE);

    const result = await service.findOneForUser('user-1', 'expense-1');

    expect(prisma.expense.findFirst).toHaveBeenCalledWith({
      where: { id: 'expense-1', car: { userId: 'user-1' } },
    });
    expect(result).toEqual(EXPENSE);
  });

  it("throws NotFound for an expense on another user's car", async () => {
    prisma.expense.findFirst.mockResolvedValue(null);

    await expect(service.findOneForUser('user-2', 'expense-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update an expense not owned by the user', async () => {
    prisma.expense.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-2', 'expense-1', { amount: 1 } as any),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('converts expenseDate to a Date object on update', async () => {
    prisma.expense.findFirst.mockResolvedValue(EXPENSE);
    prisma.expense.update.mockResolvedValue(EXPENSE);

    await service.update('user-1', 'expense-1', {
      expenseDate: '2026-09-01',
      notes: 'updated',
    });

    expect(prisma.expense.update).toHaveBeenCalledWith({
      where: { id: 'expense-1' },
      data: { notes: 'updated', expenseDate: new Date('2026-09-01') },
    });
  });

  it('refuses to delete an expense not owned by the user', async () => {
    prisma.expense.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-2', 'expense-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.expense.delete).not.toHaveBeenCalled();
  });
});
