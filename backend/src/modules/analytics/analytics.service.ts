import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CarsService } from '../cars/cars.service';
import { ExpenseCategory } from '../../../generated/prisma/enums';

export interface CategoryBreakdown {
  category: ExpenseCategory;
  total: number;
}

export interface MonthlySpend {
  month: string;
  total: number;
}

export interface CarComparison {
  carId: string;
  make: string;
  model: string;
  year: number;
  totalSpend: number;
  costPerKm: number | null;
  trackedKm: number | null;
}

export interface CarAnalytics {
  totalSpend: number;
  costPerKm: number | null;
  trackedKm: number | null;
  spendByCategory: CategoryBreakdown[];
  monthlySpend: MonthlySpend[];
}

export interface GarageAnalytics {
  totalSpend: number;
  totalCars: number;
  totalTrackedKm: number;
  averageCostPerKm: number | null;
  spendByCategory: CategoryBreakdown[];
  monthlySpend: MonthlySpend[];
  carComparison: CarComparison[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carsService: CarsService,
  ) {}

  async forCar(userId: string, carId: string): Promise<CarAnalytics> {
    await this.carsService.findOneForUser(userId, carId);

    const totalSpend = await this.totalSpendForCars([carId]);
    const { costPerKm, trackedKm } = await this.costPerKmForCar(
      carId,
      totalSpend,
    );
    const spendByCategory = await this.spendByCategory([carId]);
    const monthlySpend = await this.monthlySpend([carId]);

    return { totalSpend, costPerKm, trackedKm, spendByCategory, monthlySpend };
  }

  async forGarage(userId: string): Promise<GarageAnalytics> {
    const cars = await this.prisma.car.findMany({ where: { userId } });

    const carComparison: CarComparison[] = [];
    for (const car of cars) {
      // Sequential — see Section 0's Prisma driver-adapter concurrency gotcha.
      const carTotal = await this.totalSpendForCars([car.id]);
      const { costPerKm, trackedKm } = await this.costPerKmForCar(
        car.id,
        carTotal,
      );
      carComparison.push({
        carId: car.id,
        make: car.make,
        model: car.model,
        year: car.year,
        totalSpend: carTotal,
        costPerKm,
        trackedKm,
      });
    }

    const carIds = cars.map((c) => c.id);
    const totalSpend = carComparison.reduce((sum, c) => sum + c.totalSpend, 0);
    const totalTrackedKm = carComparison.reduce(
      (sum, c) => sum + (c.trackedKm ?? 0),
      0,
    );
    const spendByCategory = await this.spendByCategory(carIds);
    const monthlySpend = await this.monthlySpend(carIds);

    return {
      totalSpend,
      totalCars: cars.length,
      totalTrackedKm,
      averageCostPerKm: totalTrackedKm > 0 ? totalSpend / totalTrackedKm : null,
      spendByCategory,
      monthlySpend,
      carComparison,
    };
  }

  private async totalSpendForCars(carIds: string[]): Promise<number> {
    if (carIds.length === 0) return 0;
    const result = await this.prisma.expense.aggregate({
      where: { carId: { in: carIds } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async costPerKmForCar(
    carId: string,
    totalSpend: number,
  ): Promise<{ costPerKm: number | null; trackedKm: number | null }> {
    const odometer = await this.prisma.expense.aggregate({
      where: { carId, odometerKm: { not: null } },
      _min: { odometerKm: true },
      _max: { odometerKm: true },
    });
    const min = odometer._min.odometerKm;
    const max = odometer._max.odometerKm;
    if (min == null || max == null || max <= min) {
      return { costPerKm: null, trackedKm: null };
    }
    const trackedKm = max - min;
    return { costPerKm: totalSpend / trackedKm, trackedKm };
  }

  private async spendByCategory(
    carIds: string[],
  ): Promise<CategoryBreakdown[]> {
    if (carIds.length === 0) return [];
    const rows = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { carId: { in: carIds } },
      _sum: { amount: true },
    });
    return rows.map((row) => ({
      category: row.category,
      total: Number(row._sum.amount ?? 0),
    }));
  }

  private async monthlySpend(carIds: string[]): Promise<MonthlySpend[]> {
    if (carIds.length === 0) return [];

    const rows = await this.prisma.$queryRaw<{ month: Date; total: number }[]>`
      SELECT date_trunc('month', "expenseDate") as month, SUM(amount)::float as total
      FROM expenses
      WHERE "carId" = ANY(${carIds})
      GROUP BY month
      ORDER BY month ASC
    `;

    return rows.map((row) => ({
      month: row.month.toISOString().slice(0, 7),
      total: row.total,
    }));
  }
}
