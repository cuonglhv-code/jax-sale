"use server";

import { reportFilterSchema } from "@/schemas/hr/report";
import { listLeaveByEmployeeCore, type LeaveByEmployeeRow } from "@/services/hr-report.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Paginated } from "@/lib/pagination";

/** US8 (contracts/config-balance.actions.md "Reporting"): leave taken by employee/centre/period. */
export async function listLeaveReport(raw: unknown): Promise<ActionResult<Paginated<LeaveByEmployeeRow>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrReport.view");
    const input = reportFilterSchema.parse(raw ?? {});
    return listLeaveByEmployeeCore(supabase, claims, input);
  });
}
