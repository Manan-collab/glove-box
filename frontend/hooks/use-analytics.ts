import { useQuery } from "@tanstack/react-query";
import { getCarAnalytics, getGarageAnalytics } from "@/lib/analytics-api";

export function useGarageAnalytics() {
  return useQuery({
    queryKey: ["analytics", "garage"],
    queryFn: getGarageAnalytics,
  });
}

export function useCarAnalytics(carId: string) {
  return useQuery({
    queryKey: ["analytics", "car", carId],
    queryFn: () => getCarAnalytics(carId),
    enabled: !!carId,
  });
}
