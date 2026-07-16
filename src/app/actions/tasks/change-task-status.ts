"use server";

import { changeTaskStatusSchema } from "@/schemas/tasks";
import { changeTaskStatusCore } from "@/services/task.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Task } from "@/lib/data/types";

/** FR-020/021: change a task's status (auto-cycle if `target` omitted, else the named target). */
export async function changeTaskStatus(raw: unknown): Promise<ActionResult<Task>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "task.changeStatus");
    const input = changeTaskStatusSchema.parse(raw);
    return changeTaskStatusCore(supabase, claims, input);
  });
}
