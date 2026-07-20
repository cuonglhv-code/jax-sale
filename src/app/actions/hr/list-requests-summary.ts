"use server";

import { reportFilterSchema } from "@/schemas/hr/report";
import { listRequestsByTypeStatusCore, type RequestsByTypeStatusRow } from "@/services/hr-report.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** US8 (contracts/config-balance.actions.md "Reporting"): requests by type & status. */
export async function listRequestsSummary(raw: unknown): Promise<ActionResult<RequestsByTypeStatusRow[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrReport.view");
    const input = reportFilterSchema.parse(raw ?? {});
    return listRequestsByTypeStatusCore(supabase, claims, input);
  });
}
