import { apiClient } from "./api-client";
import type { ExpenseCategory } from "@/features/expenses/expense-categories";
import type { PaginatedResult } from "./cars-api";

export interface Expense {
  id: string;
  carId: string;
  category: ExpenseCategory;
  amount: string;
  currency: string;
  expenseDate: string;
  odometerKm: number | null;
  notes: string | null;
  workshopName: string | null;
  workPerformed: string | null;
  whatBroke: string | null;
  litres: string | null;
  fuelPricePerLitre: string | null;
  fuelStation: string | null;
  tyreBrand: string | null;
  tyreSize: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseFormValues = {
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  odometerKm?: number;
  notes?: string;
  workshopName?: string;
  workPerformed?: string;
  whatBroke?: string;
  litres?: number;
  fuelPricePerLitre?: number;
  fuelStation?: string;
  tyreBrand?: string;
  tyreSize?: string;
};

export function listExpenses(carId: string) {
  return apiClient.get<PaginatedResult<Expense>>(
    `/cars/${carId}/expenses?pageSize=100`,
  );
}

export function createExpense(carId: string, values: ExpenseFormValues) {
  return apiClient.post<Expense>(`/cars/${carId}/expenses`, values);
}

export function updateExpense(id: string, values: Partial<ExpenseFormValues>) {
  return apiClient.patch<Expense>(`/expenses/${id}`, values);
}

export function deleteExpense(id: string) {
  return apiClient.del(`/expenses/${id}`);
}
