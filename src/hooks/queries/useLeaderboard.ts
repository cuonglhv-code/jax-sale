import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/app/actions/kpi/get-leaderboard";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";
import type { MetricKey } from "@/lib/data/types";

export function useLeaderboard(period: string, metricKey: MetricKey, centreId?: string) {
  return useQuery({
    queryKey: [...kpiQueryKeys.all, "leaderboard", period, metricKey, centreId ?? null] as const,
    queryFn: async () => {
      const result = await getLeaderboard(period, metricKey, undefined, undefined, centreId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
