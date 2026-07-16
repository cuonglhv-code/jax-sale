import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask } from "@/app/actions/tasks/create-task";
import { tasksQueryKeys } from "@/hooks/queries/useTasks";
import type { CreateTaskInput } from "@/schemas/tasks";

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const result = await createTask(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
    },
  });
}
