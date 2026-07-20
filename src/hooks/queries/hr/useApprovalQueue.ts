import { useQuery } from "@tanstack/react-query";
import { listApprovalQueue } from "@/app/actions/hr/list-approval-queue";

/** Query-key factory — mutations in hooks/mutations/hr/* invalidate via this same key shape. */
export const approvalQueueQueryKeys = {
  all: ["hrRequests", "approvalQueue"] as const,
};

/** US2 (T035): the centre manager's approval queue (own-centre pending/awaiting_cover, soonest-start first). */
export function useApprovalQueue() {
  return useQuery({
    queryKey: approvalQueueQueryKeys.all,
    queryFn: async () => {
      const result = await listApprovalQueue();
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
