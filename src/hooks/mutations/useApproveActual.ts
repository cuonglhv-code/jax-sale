import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveActual } from "@/app/actions/kpi/approve-actual";
import { rejectActual } from "@/app/actions/kpi/reject-actual";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";

export function useApproveActual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const result = await approveActual({ entryId });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kpiQueryKeys.all }),
  });
}

export function useRejectActual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, note }: { entryId: string; note?: string }) => {
      const result = await rejectActual({ entryId, note });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kpiQueryKeys.all }),
  });
}
