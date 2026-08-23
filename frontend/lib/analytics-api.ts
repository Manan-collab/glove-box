import { apiClient } from "./api-client";
import type { ExpenseCategory } from "@/features/expenses/expense-categories";

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

export function getGarageAnalytics() {
  return apiClient.get<GarageAnalytics>("/analytics/garage");
}

export function getCarAnalytics(carId: string) {
  return apiClient.get<CarAnalytics>(`/analytics/cars/${carId}`);
}
