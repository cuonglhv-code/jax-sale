"use server";

import { getMyPerformanceCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { PersonalKpiEntry } from "@/lib/data/types";

/** US1: a consultant's own entries for a period (all approval states, for their own dashboard). */
export async function getMyPerformance(period: string): Promise<ActionResult<PersonalKpiEntry[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    return getMyPerformanceCore(supabase, claims, period);
  });
}
