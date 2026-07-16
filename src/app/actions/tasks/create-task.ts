"use server";

import { createTaskSchema } from "@/schemas/tasks";
import { createTaskCore } from "@/services/task.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Task } from "@/lib/data/types";

/** FR-018/019: create a task, confined to the caller's own centre. */
export async function createTask(raw: unknown): Promise<ActionResult<Task>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "task.create");
    const input = createTaskSchema.parse(raw);
    return createTaskCore(supabase, claims, input);
  });
}
