"use server";

import { recordActualInput } from "@/schemas/kpi";
import { recordActualCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { PersonalKpiEntry } from "@/lib/data/types";

/** FR-ACTUAL-01: a consultant records/edits their OWN actual for a period+metric. */
export async function recordActual(raw: unknown): Promise<ActionResult<PersonalKpiEntry>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.recordActual");
    const input = recordActualInput.parse(raw);
    return recordActualCore(supabase, claims, input);
  });
}
