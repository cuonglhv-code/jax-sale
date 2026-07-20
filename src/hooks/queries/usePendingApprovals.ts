import { useQuery } from "@tanstack/react-query";
import { listPendingApprovals } from "@/app/actions/kpi/list-pending";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";

export function usePendingApprovals(period: string) {
  return useQuery({
    queryKey: [...kpiQueryKeys.all, "pendingApprovals", period] as const,
    queryFn: async () => {
      const result = await listPendingApprovals(period);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
