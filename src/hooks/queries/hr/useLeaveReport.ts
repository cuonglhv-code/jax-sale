import { useQuery } from "@tanstack/react-query";
import { listLeaveReport } from "@/app/actions/hr/list-leave-report";
import type { ReportFilterInput } from "@/schemas/hr/report";

export const leaveReportQueryKeys = {
  list: (filter: ReportFilterInput) => ["hrReports", "leave", filter] as const,
};

/** US8 (T062): leave taken by employee/centre/period. */
export function useLeaveReport(filter: ReportFilterInput) {
  return useQuery({
    queryKey: leaveReportQueryKeys.list(filter),
    queryFn: async () => {
      const result = await listLeaveReport(filter);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
