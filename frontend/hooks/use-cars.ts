import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import {
  type CarFormValues,
  createCar,
  deleteCar,
  getCar,
  listCars,
  updateCar,
} from "@/lib/cars-api";

const CARS_QUERY_KEY = ["cars"] as const;

export function useCars() {
  return useQuery({
    queryKey: CARS_QUERY_KEY,
    queryFn: listCars,
  });
}

export function useCar(id: string) {
  return useQuery({
    queryKey: [...CARS_QUERY_KEY, id],
    queryFn: () => getCar(id),
    enabled: !!id,
    // A missing or someone else's car won't appear on retry — fail fast so the
    // page shows "not found" instead of spinning through the default backoff.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 404 || error.status === 403)) &&
      failureCount < 3,
  });
}

export function useCreateCar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CarFormValues) => createCar(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARS_QUERY_KEY });
    },
  });
}

export function useUpdateCar(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<CarFormValues>) => updateCar(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARS_QUERY_KEY });
    },
  });
}

export function useDeleteCar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARS_QUERY_KEY });
    },
  });
}
