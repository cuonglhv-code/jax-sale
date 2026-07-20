"use server";

import { rejectInput } from "@/schemas/kpi";
import { rejectActualCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { PersonalKpiEntry } from "@/lib/data/types";

/** FR-APPROVAL-02: a centre manager/admin rejects a pending actual within their own centre. */
export async function rejectActual(raw: unknown): Promise<ActionResult<PersonalKpiEntry>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.approveActual");
    const input = rejectInput.parse(raw);
    return rejectActualCore(supabase, claims, input.entryId, input.note);
  });
}
