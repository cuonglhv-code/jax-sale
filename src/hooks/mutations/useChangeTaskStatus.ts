import { useMutation, useQueryClient } from "@tanstack/react-query";
import { changeTaskStatus } from "@/app/actions/tasks/change-task-status";
import { tasksQueryKeys } from "@/hooks/queries/useTasks";
import type { ChangeTaskStatusInput } from "@/schemas/tasks";

export function useChangeTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChangeTaskStatusInput) => {
      const result = await changeTaskStatus(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
    },
  });
}
