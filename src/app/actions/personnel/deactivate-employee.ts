"use server";

import { deactivateEmployeeSchema } from "@/schemas/personnel";
import { deactivateEmployeeCore } from "@/services/personnel.service";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** FR-005/007a: deactivate an employee (own centre) and force immediate session revocation. */
export async function deactivateEmployee(raw: unknown): Promise<ActionResult<null>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "employee.deactivate");
    const input = deactivateEmployeeSchema.parse(raw);
    const serviceClient = createServiceRoleClient();
    await deactivateEmployeeCore(supabase, serviceClient, claims, input.employeeId);
    return null;
  });
}
