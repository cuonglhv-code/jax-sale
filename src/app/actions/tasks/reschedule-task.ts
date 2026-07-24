"use server";

import { withError, type ActionResult } from "@/lib/server-action";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { rescheduleTaskSchema, type RescheduleTaskInput } from "@/schemas/tasks";
import { rescheduleTaskCore } from "@/services/task.service";
import type { Task } from "@/lib/data/types";

export async function rescheduleTask(raw: unknown): Promise<ActionResult<Task>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "task.create");
    const input = rescheduleTaskSchema.parse(raw);
    return rescheduleTaskCore(supabase, claims, input);
  });
}
