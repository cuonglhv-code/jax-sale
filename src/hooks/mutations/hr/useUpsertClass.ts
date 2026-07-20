import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertClass } from "@/app/actions/hr/upsert-class";
import { classesQueryKeys } from "@/hooks/queries/hr/useClasses";
import type { UpsertClassInput } from "@/schemas/hr/class";

/** US4 (T041): create/edit a timetable class from the admin UI. */
export function useUpsertClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertClassInput) => {
      const result = await upsertClass(input);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesQueryKeys.all });
    },
  });
}
