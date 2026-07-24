import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rescheduleTask } from "@/app/actions/tasks/reschedule-task";
import { tasksQueryKeys } from "@/hooks/queries/useTasks";
import type { RescheduleTaskInput } from "@/schemas/tasks";

export function useRescheduleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RescheduleTaskInput) => {
      const result = await rescheduleTask(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKeys.all });
    },
  });
}
