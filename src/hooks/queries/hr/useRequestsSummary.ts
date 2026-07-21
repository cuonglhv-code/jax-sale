import { useQuery } from "@tanstack/react-query";
import { listRequestsSummary } from "@/app/actions/hr/list-requests-summary";
import type { ReportFilterInput } from "@/schemas/hr/report";

export const requestsSummaryQueryKeys = {
  list: (filter: ReportFilterInput, centreId?: string) => ["hrReports", "requestsSummary", filter, centreId ?? null] as const,
};

/** US8 (T062): requests by type & status. */
export function useRequestsSummary(filter: ReportFilterInput, centreId?: string) {
  return useQuery({
    queryKey: requestsSummaryQueryKeys.list(filter, centreId),
    queryFn: async () => {
      const result = await listRequestsSummary(filter, centreId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
