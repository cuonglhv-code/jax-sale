"use server";

import { listTasksFilterSchema } from "@/schemas/tasks";
import { listTasksCore } from "@/services/task.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { TaskView } from "@/lib/data/types";
import type { Paginated } from "@/lib/pagination";

/** FR-016/017: paginated, centre-scoped task list. Reads are broad — gated by auth, not a key. */
export async function listTasks(raw: unknown): Promise<ActionResult<Paginated<TaskView>>> {
  return withError(async () => {
    const filter = listTasksFilterSchema.parse(raw);
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    return listTasksCore(supabase, claims, filter);
  });
}
