import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/app/actions/kpi/get-leaderboard";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";
import type { MetricKey } from "@/lib/data/types";

export function useLeaderboard(period: string, metricKey: MetricKey) {
  return useQuery({
    queryKey: [...kpiQueryKeys.all, "leaderboard", period, metricKey] as const,
    queryFn: async () => {
      const result = await getLeaderboard(period, metricKey);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
