import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adjustBalance } from "@/app/actions/hr/adjust-balance";
import type { AdjustBalanceInput } from "@/schemas/hr/balance";

/** US3 (T028): super_admin manual opening-balance adjustment. */
export function useAdjustBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdjustBalanceInput) => {
      const result = await adjustBalance(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      // Broad invalidation: adjustment targets an arbitrary employee, not necessarily the caller.
      queryClient.invalidateQueries({ queryKey: ["hrLeaveBalance"] });
    },
  });
}
