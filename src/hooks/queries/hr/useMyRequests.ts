import { useQuery } from "@tanstack/react-query";
import { listMyRequests } from "@/app/actions/hr/list-my-requests";

/** Query-key factory — mutations in hooks/mutations/hr/* invalidate via this same key shape. */
export const myRequestsQueryKeys = {
  all: ["hrRequests", "mine"] as const,
};

export function useMyRequests() {
  return useQuery({
    queryKey: myRequestsQueryKeys.all,
    queryFn: async () => {
      const result = await listMyRequests();
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
