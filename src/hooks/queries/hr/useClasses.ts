import { useQuery } from "@tanstack/react-query";
import { listClasses } from "@/app/actions/hr/list-classes";

/** Query-key factory — mutations in hooks/mutations/hr/useUpsertClass invalidate via this key shape. */
export const classesQueryKeys = {
  all: ["hr", "classes"] as const,
  byCentre: (centreId?: string) => ["hr", "classes", centreId ?? "all"] as const,
};

/** US4 (T041): the class timetable — broad read (schedules not sensitive), optionally centre-scoped. */
export function useClasses(centreId?: string) {
  return useQuery({
    queryKey: classesQueryKeys.byCentre(centreId),
    queryFn: async () => {
      const result = await listClasses(centreId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
