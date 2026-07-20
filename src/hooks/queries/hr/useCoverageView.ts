import { useQuery } from "@tanstack/react-query";
import { listCoverage } from "@/app/actions/hr/list-coverage";
import type { CoverageViewFilterInput } from "@/schemas/hr/report";

export const coverageViewQueryKeys = {
  list: (filter: CoverageViewFilterInput) => ["hrReports", "coverage", filter] as const,
};

/** US8 (T062, SC-007): "who is off in a period and who is covering". */
export function useCoverageView(filter: CoverageViewFilterInput) {
  return useQuery({
    queryKey: coverageViewQueryKeys.list(filter),
    queryFn: async () => {
      const result = await listCoverage(filter);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
