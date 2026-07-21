import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/app/actions/kpi/get-dashboard";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";

export function useDashboard(period: string, page = 1, centreId?: string) {
  return useQuery({
    queryKey: [...kpiQueryKeys.all, "dashboard", period, page, centreId ?? null] as const,
    queryFn: async () => {
      const result = await getDashboard(period, page, undefined, centreId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
