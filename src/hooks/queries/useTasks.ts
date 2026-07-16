import { useQuery } from "@tanstack/react-query";
import { listTasks } from "@/app/actions/tasks/list-tasks";
import type { ListTasksFilter } from "@/schemas/tasks";

/** Query-key factory — mutations in hooks/mutations/* invalidate via this same key shape. */
export const tasksQueryKeys = {
  all: ["tasks"] as const,
  list: (filter: ListTasksFilter) => [...tasksQueryKeys.all, "list", filter] as const,
};

export function useTasks(filter: ListTasksFilter) {
  return useQuery({
    queryKey: tasksQueryKeys.list(filter),
    queryFn: async () => {
      const result = await listTasks(filter);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
