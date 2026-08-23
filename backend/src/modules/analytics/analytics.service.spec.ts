import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    car: { findMany: jest.Mock };
    expense: { aggregate: jest.Mock; groupBy: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let carsService: { findOneForUser: jest.Mock };

  const CAR = { id: 'car-1', make: 'Honda', model: 'Civic', year: 2020 };

  beforeEach(() => {
    prisma = {
      car: { findMany: jest.fn() },
      expense: { aggregate: jest.fn(), groupBy: jest.fn() },
      $queryRaw: jest.fn(),
    };
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
        .mockResolvedValueOnce({
          _min: { odometerKm: null },
          _max: { odometerKm: null },
        });
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.forCar('user-1', 'car-1');

      expect(result.costPerKm).toBeNull();
      expect(result.trackedKm).toBeNull();
    });

    it('treats zero spend as zero, not null', async () => {
      carsService.findOneForUser.mockResolvedValue(CAR);
      prisma.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({
          _min: { odometerKm: null },
          _max: { odometerKm: null },
        });
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.forCar('user-1', 'car-1');

      expect(result.totalSpend).toBe(0);
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
        .mockResolvedValueOnce({
          _min: { odometerKm: null },
          _max: { odometerKm: null },
        }) // car-1 odometer
        .mockResolvedValueOnce({ _sum: { amount: '2000.00' } }) // car-2 total
        .mockResolvedValueOnce({
          _min: { odometerKm: null },
          _max: { odometerKm: null },
        }); // car-2 odometer
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);

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
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.forGarage('user-1');

      expect(result.totalCars).toBe(0);
      expect(result.totalSpend).toBe(0);
      expect(result.carComparison).toEqual([]);
    });
  });
});
