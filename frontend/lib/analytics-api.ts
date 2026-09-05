import { apiClient } from "./api-client";
import type { ExpenseCategory } from "@/features/expenses/expense-categories";

export type AnalyticsPeriod = "ALL" | "LAST_30_DAYS" | "LAST_6_MONTHS" | "LAST_1_YEAR";

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

export function getGarageAnalytics(period: AnalyticsPeriod = "ALL") {
  return apiClient.get<GarageAnalytics>(`/analytics/garage?period=${period}`);
}

export function getCarAnalytics(carId: string, period: AnalyticsPeriod = "ALL") {
  return apiClient.get<CarAnalytics>(`/analytics/cars/${carId}?period=${period}`);
}
