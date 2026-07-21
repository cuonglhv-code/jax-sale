import { useQuery } from "@tanstack/react-query";
import { listLeaveReport } from "@/app/actions/hr/list-leave-report";
import type { ReportFilterInput } from "@/schemas/hr/report";

export const leaveReportQueryKeys = {
  list: (filter: ReportFilterInput, centreId?: string) => ["hrReports", "leave", filter, centreId ?? null] as const,
};

/** US8 (T062): leave taken by employee/centre/period. `centreId` (super_admin only, shell's
 *  `?centre=` param) narrows the network-wide default. */
export function useLeaveReport(filter: ReportFilterInput, centreId?: string) {
  return useQuery({
    queryKey: leaveReportQueryKeys.list(filter, centreId),
    queryFn: async () => {
      const result = await listLeaveReport(filter, centreId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
