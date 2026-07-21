"use server";

import { listEmployeesFilterSchema } from "@/schemas/tasks";
import { listEmployeesCore, type EmployeeListRow } from "@/services/task.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** Read entry point for the Daily Work view's employee list — reads are broad (FR-011 pattern). */
export async function listEmployees(raw: unknown): Promise<ActionResult<EmployeeListRow[]>> {
  return withError(async () => {
    const filter = listEmployeesFilterSchema.parse(raw);
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    return listEmployeesCore(supabase, claims, filter);
  });
}
