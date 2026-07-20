import { useQuery } from "@tanstack/react-query";
import { listMyCoverNominations } from "@/app/actions/hr/list-my-cover-nominations";

/** Query-key factory — useRespondCover invalidates via this same key shape. */
export const myCoverNominationsQueryKeys = {
  all: ["hr", "myCoverNominations"] as const,
};

/** US4 (T043): cover nominations awaiting the caller's own accept/decline. */
export function useMyCoverNominations() {
  return useQuery({
    queryKey: myCoverNominationsQueryKeys.all,
    queryFn: async () => {
      const result = await listMyCoverNominations();
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
