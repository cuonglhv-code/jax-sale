import { useQuery } from "@tanstack/react-query";
import { listEmployees } from "@/app/actions/tasks/list-employees";
import type { ListEmployeesFilter } from "@/schemas/tasks";

/** Query-key factory, mirrors useTasks.ts. */
export const employeesQueryKeys = {
  all: ["employees"] as const,
  list: (filter: ListEmployeesFilter) => [...employeesQueryKeys.all, "list", filter] as const,
};

export function useEmployees(filter: ListEmployeesFilter) {
  return useQuery({
    queryKey: employeesQueryKeys.list(filter),
    queryFn: async () => {
      const result = await listEmployees(filter);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
