"use server";

import { listPendingApprovalsCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { PersonalKpiEntry } from "@/lib/data/types";

/** US7: own-centre pending actuals for the approval queue. */
export async function listPendingApprovals(period?: string): Promise<ActionResult<PersonalKpiEntry[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.approveActual");
    return listPendingApprovalsCore(supabase, claims, period);
  });
}
