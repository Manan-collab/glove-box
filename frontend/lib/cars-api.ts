import { apiClient } from "./api-client";

export interface Car {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  variant: string;
  vin: string | null;
  engine: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  powerBhp: number | null;
  vehicleApiRef: string | null;
  odometerKm: number;
  usageTag: string | null;
  insuranceExpiryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export type CarFormValues = {
  make: string;
  model: string;
  year: number;
  variant: string;
  vin?: string;
  engine: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  powerBhp?: number;
  odometerKm: number;
  usageTag?: string;
  insuranceExpiryDate?: string;
};

export function listCars() {
  return apiClient.get<PaginatedResult<Car>>("/cars?pageSize=100");
}

export function getCar(id: string) {
  return apiClient.get<Car>(`/cars/${id}`);
}

export function createCar(values: CarFormValues) {
  return apiClient.post<Car>("/cars", values);
}

export function updateCar(id: string, values: Partial<CarFormValues>) {
  return apiClient.patch<Car>(`/cars/${id}`, values);
}

export function deleteCar(id: string) {
  return apiClient.del(`/cars/${id}`);
}
