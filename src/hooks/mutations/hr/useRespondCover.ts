import { useMutation, useQueryClient } from "@tanstack/react-query";
import { respondCover } from "@/app/actions/hr/respond-cover";
import { myCoverNominationsQueryKeys } from "@/hooks/queries/hr/useMyCoverNominations";
import { approvalQueueQueryKeys } from "@/hooks/queries/hr/useApprovalQueue";
import type { RespondCoverInput } from "@/schemas/hr/respond-cover";

/** US4 (T043): accept/decline a cover nomination. */
export function useRespondCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RespondCoverInput) => {
      const result = await respondCover(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myCoverNominationsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: approvalQueueQueryKeys.all });
    },
  });
}
