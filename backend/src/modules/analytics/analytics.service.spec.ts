import { AnalyticsPeriod } from './dto/analytics-query.dto';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    car: { findMany: jest.Mock };
    expense: {
      aggregate: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };
  let carsService: { findOneForUser: jest.Mock };

  const CAR = { id: 'car-1', make: 'Honda', model: 'Civic', year: 2020 };
  const NO_ODOMETER = {
    _min: { odometerKm: null },
    _max: { odometerKm: null },
  };
  // Covers every aggregate shape this service reads (_sum for totals/repair
  // spend, _min/_max for the odometer query) so tests that don't care about
  // a particular aggregate call can rely on this default without crashing.
  const ZERO_SUM = { _sum: { amount: null }, ...NO_ODOMETER };

  beforeEach(() => {
    prisma = {
      car: { findMany: jest.fn() },
      expense: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.expense.groupBy.mockResolvedValue([]);
    prisma.expense.aggregate.mockResolvedValue(ZERO_SUM);
    prisma.$queryRaw.mockResolvedValue([]);
    carsService = { findOneForUser: jest.fn() };
    service = new AnalyticsService(prisma as any, carsService as any);
  });

  describe('forCar', () => {
    it('verifies ownership before computing anything', async () => {
      carsService.findOneForUser.mockRejectedValue(new Error('not found'));

      await expect(service.forCar('user-1', 'car-1')).rejects.toThrow();
      expect(prisma.expense.aggregate).not.toHaveBeenCalled();
    });

    it('computes total spend, cost/km, category breakdown, and monthly spend', async () => {
      carsService.findOneForUser.mockResolvedValue(CAR);
      // totalSpendForCars
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '4500.00' } })
        // costPerKmForCar odometer aggregate
        .mockResolvedValueOnce({
          _min: { odometerKm: 40000 },
          _max: { odometerKm: 40500 },
        });
      prisma.expense.groupBy.mockResolvedValue([
        { category: 'FUEL', _sum: { amount: '3000.00' } },
        { category: 'SERVICE', _sum: { amount: '1500.00' } },
      ]);
      prisma.$queryRaw.mockResolvedValue([
        { month: new Date('2026-08-01T00:00:00Z'), total: 4500 },
      ]);

      const result = await service.forCar('user-1', 'car-1');

      // Manually computed expected values, matching the "Done when" criteria
      // in the architecture doc: every number should match a hand calculation.
      expect(result.totalSpend).toBe(4500);
      expect(result.trackedKm).toBe(500); // 40500 - 40000
      expect(result.costPerKm).toBe(9); // 4500 / 500
      expect(result.spendByCategory).toEqual([
        { category: 'FUEL', total: 3000 },
        { category: 'SERVICE', total: 1500 },
      ]);
      expect(result.monthlySpend).toEqual([{ month: '2026-08', total: 4500 }]);
    });

    it('returns null cost/km and trackedKm when fewer than two odometer readings exist', async () => {
      carsService.findOneForUser.mockResolvedValue(CAR);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '1000.00' } })
        .mockResolvedValueOnce(NO_ODOMETER);

      const result = await service.forCar('user-1', 'car-1');

      expect(result.costPerKm).toBeNull();
      expect(result.trackedKm).toBeNull();
    });

    it('treats zero spend as zero, not null', async () => {
      carsService.findOneForUser.mockResolvedValue(CAR);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce(NO_ODOMETER);

      const result = await service.forCar('user-1', 'car-1');

      expect(result.totalSpend).toBe(0);
    });

    it('narrows totalSpend and cost/km to expenses within the selected period', async () => {
      carsService.findOneForUser.mockResolvedValue(CAR);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '1000.00' } })
        .mockResolvedValueOnce(NO_ODOMETER);

      await service.forCar('user-1', 'car-1', AnalyticsPeriod.LAST_30_DAYS);

      expect(prisma.expense.aggregate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            carId: { in: ['car-1'] },
            expenseDate: { gte: expect.any(Date) },
          }),
        }),
      );
      expect(prisma.expense.aggregate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            expenseDate: { gte: expect.any(Date) },
          }),
        }),
      );
    });

    it('does not filter by date when period is ALL (the default)', async () => {
      carsService.findOneForUser.mockResolvedValue(CAR);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '1000.00' } })
        .mockResolvedValueOnce(NO_ODOMETER);

      await service.forCar('user-1', 'car-1');

      expect(prisma.expense.aggregate).toHaveBeenNthCalledWith(1, {
        where: { carId: { in: ['car-1'] } },
        _sum: { amount: true },
      });
    });
  });

  describe('forGarage', () => {
    it("sums totalSpend across all of the user's cars", async () => {
      prisma.car.findMany.mockResolvedValue([
        { id: 'car-1', make: 'Honda', model: 'Civic', year: 2020 },
        { id: 'car-2', make: 'Toyota', model: 'Camry', year: 2018 },
      ]);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '4500.00' } }) // car-1 total
        .mockResolvedValueOnce(NO_ODOMETER) // car-1 odometer
        .mockResolvedValueOnce(ZERO_SUM) // car-1 repair spend
        .mockResolvedValueOnce({ _sum: { amount: '2000.00' } }) // car-2 total
        .mockResolvedValueOnce(NO_ODOMETER) // car-2 odometer
        .mockResolvedValueOnce(ZERO_SUM); // car-2 repair spend

      const result = await service.forGarage('user-1');

      expect(result.totalCars).toBe(2);
      expect(result.totalSpend).toBe(6500); // 4500 + 2000
      expect(result.carComparison).toHaveLength(2);
      expect(result.carComparison[0]).toEqual(
        expect.objectContaining({ carId: 'car-1', totalSpend: 4500 }),
      );
      expect(result.carComparison[1]).toEqual(
        expect.objectContaining({ carId: 'car-2', totalSpend: 2000 }),
      );
    });

    it('returns zeroed-out analytics for a garage with no cars', async () => {
      prisma.car.findMany.mockResolvedValue([]);

      const result = await service.forGarage('user-1');

      expect(result.totalCars).toBe(0);
      expect(result.totalSpend).toBe(0);
      expect(result.carComparison).toEqual([]);
      expect(result.recentExpenses).toEqual([]);
      expect(result.currentMonthSpendByCategory).toEqual([]);
      expect(result.yearOverYear).toEqual(
        expect.objectContaining({
          categories: [],
          totalThisYear: 0,
          totalLastYear: 0,
        }),
      );
    });

    it('maps recent expenses (with car label) and this-month category totals', async () => {
      prisma.car.findMany.mockResolvedValue([
        { id: 'car-1', make: 'Honda', model: 'Civic', year: 2020 },
      ]);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: '4500.00' } }) // car-1 total
        .mockResolvedValueOnce(NO_ODOMETER) // car-1 odometer
        .mockResolvedValueOnce(ZERO_SUM); // car-1 repair spend
      // spendByCategory (all-time), then currentMonthSpendByCategory — same
      // mock object reused for both since groupBy isn't Once-chained here.
      prisma.expense.groupBy.mockResolvedValue([
        { category: 'FUEL', _sum: { amount: '4500.00' } },
      ]);
      prisma.expense.findMany.mockResolvedValue([
        {
          id: 'exp-1',
          carId: 'car-1',
          category: 'FUEL',
          amount: '4500.00',
          expenseDate: new Date('2026-08-10T00:00:00Z'),
          car: { make: 'Honda', model: 'Civic' },
        },
      ]);

      const result = await service.forGarage('user-1');

      expect(result.recentExpenses).toEqual([
        {
          id: 'exp-1',
          carId: 'car-1',
          carLabel: 'Honda Civic',
          category: 'FUEL',
          amount: 4500,
          expenseDate: '2026-08-10T00:00:00.000Z',
        },
      ]);
      expect(result.currentMonthSpendByCategory).toEqual([
        { category: 'FUEL', total: 4500 },
      ]);
    });

    it('reports repairSpend per car', async () => {
      prisma.car.findMany.mockResolvedValue([CAR]);
      prisma.expense.aggregate
        .mockResolvedValueOnce(ZERO_SUM) // total
        .mockResolvedValueOnce(NO_ODOMETER) // odometer
        .mockResolvedValueOnce({ _sum: { amount: '12500.00' } }); // repair spend

      const result = await service.forGarage('user-1');

      expect(result.carComparison[0].repairSpend).toBe(12500);
    });

    it('narrows spendByCategory and monthlySpend to the selected period', async () => {
      prisma.car.findMany.mockResolvedValue([CAR]);

      await service.forGarage('user-1', AnalyticsPeriod.LAST_6_MONTHS);

      expect(prisma.expense.groupBy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            carId: { in: ['car-1'] },
            expenseDate: { gte: expect.any(Date) },
          }),
        }),
      );
    });

    describe('yearOverYear', () => {
      it('computes percent change per category and overall', async () => {
        prisma.car.findMany.mockResolvedValue([CAR]);
        // groupBy call order: spendByCategory, currentMonthSpendByCategory,
        // yearOverYear-thisYear, yearOverYear-lastYear.
        prisma.expense.groupBy
          .mockResolvedValueOnce([]) // spendByCategory
          .mockResolvedValueOnce([]) // currentMonthSpendByCategory
          .mockResolvedValueOnce([
            { category: 'FUEL', _sum: { amount: '4600.00' } },
          ]) // this year
          .mockResolvedValueOnce([
            { category: 'FUEL', _sum: { amount: '5000.00' } },
          ]); // last year

        const result = await service.forGarage('user-1');

        expect(result.yearOverYear.categories).toEqual([
          {
            category: 'FUEL',
            thisYear: 4600,
            lastYear: 5000,
            percentChange: -8,
          },
        ]);
        expect(result.yearOverYear.totalThisYear).toBe(4600);
        expect(result.yearOverYear.totalLastYear).toBe(5000);
        expect(result.yearOverYear.totalPercentChange).toBe(-8);
      });

      it('reports null percentChange instead of dividing by zero when last year had no spend', async () => {
        prisma.car.findMany.mockResolvedValue([CAR]);
        prisma.expense.groupBy
          .mockResolvedValueOnce([]) // spendByCategory
          .mockResolvedValueOnce([]) // currentMonthSpendByCategory
          .mockResolvedValueOnce([
            { category: 'MOD', _sum: { amount: '2000.00' } },
          ]) // this year
          .mockResolvedValueOnce([]); // last year: nothing

        const result = await service.forGarage('user-1');

        expect(result.yearOverYear.categories).toEqual([
          { category: 'MOD', thisYear: 2000, lastYear: 0, percentChange: null },
        ]);
        expect(result.yearOverYear.totalPercentChange).toBeNull();
      });
    });
  });
});
