"use server";

import { assignTaskSchema } from "@/schemas/tasks";
import { assignTaskCore } from "@/services/task.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Task } from "@/lib/data/types";

/** FR-019: reassign a task, confined to its own centre. */
export async function assignTask(raw: unknown): Promise<ActionResult<Task>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "task.assign");
    const input = assignTaskSchema.parse(raw);
    return assignTaskCore(supabase, claims, input);
  });
}
