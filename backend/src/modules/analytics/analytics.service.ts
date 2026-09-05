import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CarsService } from '../cars/cars.service';
import { ExpenseCategory } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';
import { AnalyticsPeriod } from './dto/analytics-query.dto';

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
  repairSpend: number;
}

export interface YearOverYearCategory {
  category: ExpenseCategory;
  thisYear: number;
  lastYear: number;
  percentChange: number | null;
}

export interface YearOverYear {
  thisYearLabel: string;
  lastYearLabel: string;
  categories: YearOverYearCategory[];
  totalThisYear: number;
  totalLastYear: number;
  totalPercentChange: number | null;
}

export interface CarAnalytics {
  totalSpend: number;
  costPerKm: number | null;
  trackedKm: number | null;
  spendByCategory: CategoryBreakdown[];
  monthlySpend: MonthlySpend[];
  yearOverYear: YearOverYear;
}

export interface RecentExpense {
  id: string;
  carId: string;
  carLabel: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
}

export interface GarageAnalytics {
  totalSpend: number;
  totalCars: number;
  totalTrackedKm: number;
  averageCostPerKm: number | null;
  spendByCategory: CategoryBreakdown[];
  monthlySpend: MonthlySpend[];
  carComparison: CarComparison[];
  recentExpenses: RecentExpense[];
  currentMonthSpendByCategory: CategoryBreakdown[];
  yearOverYear: YearOverYear;
}

const RECENT_EXPENSES_LIMIT = 8;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carsService: CarsService,
  ) {}

  async forCar(
    userId: string,
    carId: string,
    period: AnalyticsPeriod = AnalyticsPeriod.ALL,
  ): Promise<CarAnalytics> {
    await this.carsService.findOneForUser(userId, carId);
    const since = this.periodToSince(period);

    const totalSpend = await this.totalSpendForCars([carId], since);
    const { costPerKm, trackedKm } = await this.costPerKmForCar(
      carId,
      totalSpend,
      since,
    );
    const spendByCategory = await this.spendByCategory([carId], since);
    const monthlySpend = await this.monthlySpend([carId], since);
    const yearOverYear = await this.yearOverYear([carId]);

    return {
      totalSpend,
      costPerKm,
      trackedKm,
      spendByCategory,
      monthlySpend,
      yearOverYear,
    };
  }

  async forGarage(
    userId: string,
    period: AnalyticsPeriod = AnalyticsPeriod.ALL,
  ): Promise<GarageAnalytics> {
    const since = this.periodToSince(period);
    const cars = await this.prisma.car.findMany({ where: { userId } });

    const carComparison: CarComparison[] = [];
    for (const car of cars) {
      // Sequential — see Section 0's Prisma driver-adapter concurrency gotcha.
      const carTotal = await this.totalSpendForCars([car.id], since);
      const { costPerKm, trackedKm } = await this.costPerKmForCar(
        car.id,
        carTotal,
        since,
      );
      const repairSpend = await this.repairSpendForCar(car.id, since);
      carComparison.push({
        carId: car.id,
        make: car.make,
        model: car.model,
        year: car.year,
        totalSpend: carTotal,
        costPerKm,
        trackedKm,
        repairSpend,
      });
    }

    const carIds = cars.map((c) => c.id);
    const totalSpend = carComparison.reduce((sum, c) => sum + c.totalSpend, 0);
    const totalTrackedKm = carComparison.reduce(
      (sum, c) => sum + (c.trackedKm ?? 0),
      0,
    );
    const spendByCategory = await this.spendByCategory(carIds, since);
    const monthlySpend = await this.monthlySpend(carIds, since);
    const recentExpenses = await this.recentExpenses(carIds, since);
    const currentMonthSpendByCategory =
      await this.currentMonthSpendByCategory(carIds);
    const yearOverYear = await this.yearOverYear(carIds);

    return {
      totalSpend,
      totalCars: cars.length,
      totalTrackedKm,
      averageCostPerKm: totalTrackedKm > 0 ? totalSpend / totalTrackedKm : null,
      spendByCategory,
      monthlySpend,
      carComparison,
      recentExpenses,
      currentMonthSpendByCategory,
      yearOverYear,
    };
  }

  // Simplifying assumption: "last 6 months"/"last 1 year" are computed as
  // fixed calendar offsets from now, not aligned to month/year boundaries —
  // good enough for a rolling-window filter, not meant to match the
  // year-over-year panel's fixed calendar-year framing.
  private periodToSince(period: AnalyticsPeriod): Date | null {
    const now = new Date();
    switch (period) {
      case AnalyticsPeriod.LAST_30_DAYS:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case AnalyticsPeriod.LAST_6_MONTHS:
        return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case AnalyticsPeriod.LAST_1_YEAR:
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case AnalyticsPeriod.ALL:
      default:
        return null;
    }
  }

  private async totalSpendForCars(
    carIds: string[],
    since: Date | null,
  ): Promise<number> {
    if (carIds.length === 0) return 0;
    const result = await this.prisma.expense.aggregate({
      where: {
        carId: { in: carIds },
        ...(since && { expenseDate: { gte: since } }),
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async costPerKmForCar(
    carId: string,
    totalSpend: number,
    since: Date | null,
  ): Promise<{ costPerKm: number | null; trackedKm: number | null }> {
    const odometer = await this.prisma.expense.aggregate({
      where: {
        carId,
        odometerKm: { not: null },
        ...(since && { expenseDate: { gte: since } }),
      },
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

  private async repairSpendForCar(
    carId: string,
    since: Date | null,
  ): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: {
        carId,
        category: ExpenseCategory.REPAIR,
        ...(since && { expenseDate: { gte: since } }),
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async spendByCategory(
    carIds: string[],
    since: Date | null,
  ): Promise<CategoryBreakdown[]> {
    if (carIds.length === 0) return [];
    const rows = await this.prisma.expense.groupBy({
      by: ['category'],
      where: {
        carId: { in: carIds },
        ...(since && { expenseDate: { gte: since } }),
      },
      _sum: { amount: true },
    });
    return rows.map((row) => ({
      category: row.category,
      total: Number(row._sum.amount ?? 0),
    }));
  }

  private async monthlySpend(
    carIds: string[],
    since: Date | null,
  ): Promise<MonthlySpend[]> {
    if (carIds.length === 0) return [];

    const rows = await this.prisma.$queryRaw<{ month: Date; total: number }[]>(
      Prisma.sql`
        SELECT date_trunc('month', "expenseDate") as month, SUM(amount)::float as total
        FROM expenses
        WHERE "carId" = ANY(${carIds})
        ${since ? Prisma.sql`AND "expenseDate" >= ${since}` : Prisma.empty}
        GROUP BY month
        ORDER BY month ASC
      `,
    );

    return rows.map((row) => ({
      month: row.month.toISOString().slice(0, 7),
      total: row.total,
    }));
  }

  private async recentExpenses(
    carIds: string[],
    since: Date | null,
  ): Promise<RecentExpense[]> {
    if (carIds.length === 0) return [];
    const rows = await this.prisma.expense.findMany({
      where: {
        carId: { in: carIds },
        ...(since && { expenseDate: { gte: since } }),
      },
      orderBy: { expenseDate: 'desc' },
      take: RECENT_EXPENSES_LIMIT,
      include: { car: { select: { make: true, model: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      carId: row.carId,
      carLabel: `${row.car.make} ${row.car.model}`,
      category: row.category,
      amount: Number(row.amount),
      expenseDate: row.expenseDate.toISOString(),
    }));
  }

  private async currentMonthSpendByCategory(
    carIds: string[],
  ): Promise<CategoryBreakdown[]> {
    if (carIds.length === 0) return [];
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const rows = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { carId: { in: carIds }, expenseDate: { gte: startOfMonth } },
      _sum: { amount: true },
    });
    return rows.map((row) => ({
      category: row.category,
      total: Number(row._sum.amount ?? 0),
    }));
  }

  // Always compares full calendar years, independent of any period filter —
  // "this year vs last year" has a fixed meaning of its own.
  private async yearOverYear(carIds: string[]): Promise<YearOverYear> {
    const now = new Date();
    const thisYearLabel = String(now.getUTCFullYear());
    const lastYearLabel = String(now.getUTCFullYear() - 1);

    if (carIds.length === 0) {
      return {
        thisYearLabel,
        lastYearLabel,
        categories: [],
        totalThisYear: 0,
        totalLastYear: 0,
        totalPercentChange: null,
      };
    }

    const thisYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const lastYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));

    // Sequential — see Section 0's Prisma driver-adapter concurrency gotcha.
    const thisYearRows = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { carId: { in: carIds }, expenseDate: { gte: thisYearStart } },
      _sum: { amount: true },
    });
    const lastYearRows = await this.prisma.expense.groupBy({
      by: ['category'],
      where: {
        carId: { in: carIds },
        expenseDate: { gte: lastYearStart, lt: thisYearStart },
      },
      _sum: { amount: true },
    });

    const thisYearMap = new Map(
      thisYearRows.map((row) => [row.category, Number(row._sum.amount ?? 0)]),
    );
    const lastYearMap = new Map(
      lastYearRows.map((row) => [row.category, Number(row._sum.amount ?? 0)]),
    );
    const categorySet = new Set([...thisYearMap.keys(), ...lastYearMap.keys()]);

    const categories: YearOverYearCategory[] = Array.from(categorySet)
      .map((category) => {
        const thisYear = thisYearMap.get(category) ?? 0;
        const lastYear = lastYearMap.get(category) ?? 0;
        return {
          category,
          thisYear,
          lastYear,
          percentChange:
            lastYear > 0
              ? Math.round(((thisYear - lastYear) / lastYear) * 100)
              : null,
        };
      })
      .sort((a, b) => b.thisYear + b.lastYear - (a.thisYear + a.lastYear));

    const totalThisYear = categories.reduce((sum, c) => sum + c.thisYear, 0);
    const totalLastYear = categories.reduce((sum, c) => sum + c.lastYear, 0);

    return {
      thisYearLabel,
      lastYearLabel,
      categories,
      totalThisYear,
      totalLastYear,
      totalPercentChange:
        totalLastYear > 0
          ? Math.round(((totalThisYear - totalLastYear) / totalLastYear) * 100)
          : null,
    };
  }
}
