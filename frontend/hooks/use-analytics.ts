import { useQuery } from "@tanstack/react-query";
import type { AnalyticsPeriod } from "@/lib/analytics-api";
import { getCarAnalytics, getGarageAnalytics } from "@/lib/analytics-api";

export function useGarageAnalytics(period: AnalyticsPeriod = "ALL") {
  return useQuery({
    queryKey: ["analytics", "garage", period],
    queryFn: () => getGarageAnalytics(period),
  });
}

export function useCarAnalytics(carId: string, period: AnalyticsPeriod = "ALL") {
  return useQuery({
    queryKey: ["analytics", "car", carId, period],
    queryFn: () => getCarAnalytics(carId, period),
    enabled: !!carId,
  });
}
