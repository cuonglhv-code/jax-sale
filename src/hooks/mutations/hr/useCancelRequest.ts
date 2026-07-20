import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelRequest } from "@/app/actions/hr/cancel-request";
import { approvalQueueQueryKeys } from "@/hooks/queries/hr/useApprovalQueue";
import { myRequestsQueryKeys } from "@/hooks/queries/hr/useMyRequests";

/** US2 (T037): submitter cancels a pending request or withdraws an approved one. */
export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const result = await cancelRequest({ requestId });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRequestsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: approvalQueueQueryKeys.all });
    },
  });
}
