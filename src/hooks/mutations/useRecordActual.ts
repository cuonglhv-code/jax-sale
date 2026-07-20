import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordActual } from "@/app/actions/kpi/record-actual";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";
import type { RecordActualInput } from "@/schemas/kpi";

export function useRecordActual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordActualInput) => {
      const result = await recordActual(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiQueryKeys.all });
    },
  });
}
