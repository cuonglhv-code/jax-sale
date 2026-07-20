import { useQuery } from "@tanstack/react-query";
import { getMyPerformance } from "@/app/actions/kpi/get-my-performance";

/** Query-key factory — mutations invalidate via this same key shape. */
export const kpiQueryKeys = {
  all: ["kpi"] as const,
  myPerformance: (period: string) => [...kpiQueryKeys.all, "myPerformance", period] as const,
};

export function useMyPerformance(period: string) {
  return useQuery({
    queryKey: kpiQueryKeys.myPerformance(period),
    queryFn: async () => {
      const result = await getMyPerformance(period);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
