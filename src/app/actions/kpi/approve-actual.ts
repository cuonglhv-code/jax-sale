"use server";

import { approveInput } from "@/schemas/kpi";
import { approveActualCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { PersonalKpiEntry } from "@/lib/data/types";

/** FR-APPROVAL-02: a centre manager/admin approves a pending actual within their own centre. */
export async function approveActual(raw: unknown): Promise<ActionResult<PersonalKpiEntry>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.approveActual");
    const input = approveInput.parse(raw);
    return approveActualCore(supabase, claims, input.entryId);
  });
}
