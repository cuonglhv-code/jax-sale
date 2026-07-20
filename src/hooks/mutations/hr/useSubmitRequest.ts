import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitRequest } from "@/app/actions/hr/submit-request";
import { myRequestsQueryKeys } from "@/hooks/queries/hr/useMyRequests";
import type { AnnualLeaveInput } from "@/schemas/hr/submit";

export function useSubmitRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AnnualLeaveInput) => {
      const result = await submitRequest(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRequestsQueryKeys.all });
    },
  });
}
