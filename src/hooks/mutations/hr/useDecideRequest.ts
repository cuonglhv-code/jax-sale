import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decideRequest } from "@/app/actions/hr/decide-request";
import { approvalQueueQueryKeys } from "@/hooks/queries/hr/useApprovalQueue";
import { myRequestsQueryKeys } from "@/hooks/queries/hr/useMyRequests";
import type { DecideRequestInput } from "@/schemas/hr/decide";

/** US2 (T035): approve/reject a request from the approval queue. */
export function useDecideRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecideRequestInput) => {
      const result = await decideRequest(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalQueueQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: myRequestsQueryKeys.all });
    },
  });
}
