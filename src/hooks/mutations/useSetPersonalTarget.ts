import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setPersonalTarget } from "@/app/actions/kpi/set-personal-target";
import { kpiQueryKeys } from "@/hooks/queries/useMyPerformance";
import type { SetPersonalTargetInput } from "@/schemas/kpi";

export function useSetPersonalTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetPersonalTargetInput) => {
      const result = await setPersonalTarget(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kpiQueryKeys.all }),
  });
}
