import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  type ExpenseFormValues,
  listExpenses,
  updateExpense,
} from "@/lib/expenses-api";

const expensesKey = (carId: string) => ["expenses", carId] as const;

export function useExpenses(carId: string) {
  return useQuery({
    queryKey: expensesKey(carId),
    queryFn: () => listExpenses(carId),
    enabled: !!carId,
  });
}

export function useCreateExpense(carId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ExpenseFormValues) => createExpense(carId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKey(carId) });
    },
  });
}

export function useUpdateExpense(carId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<ExpenseFormValues>) => updateExpense(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKey(carId) });
    },
  });
}

export function useDeleteExpense(carId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKey(carId) });
    },
  });
}
