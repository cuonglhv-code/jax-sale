import { useQuery } from "@tanstack/react-query";
import { listOutstandingBalances } from "@/app/actions/hr/list-outstanding-balances";
import type { OutstandingBalancesFilterInput } from "@/schemas/hr/report";

export const outstandingBalancesQueryKeys = {
  list: (filter: OutstandingBalancesFilterInput, centreId?: string) =>
    ["hrReports", "outstandingBalances", filter, centreId ?? null] as const,
};

/** US8 (T062): outstanding annual-leave balances for every in-scope employee (FR-038). */
export function useOutstandingBalances(filter: OutstandingBalancesFilterInput, centreId?: string) {
  return useQuery({
    queryKey: outstandingBalancesQueryKeys.list(filter, centreId),
    queryFn: async () => {
      const result = await listOutstandingBalances(filter, centreId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
