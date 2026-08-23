import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
