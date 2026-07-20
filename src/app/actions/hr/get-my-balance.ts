"use server";

import { getIndicativeAnnualBalanceCore, type IndicativeAnnualBalance } from "@/services/hr-request.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** US3 (T028): own indicative annual-leave balance for a leave year — auth-gated only (read-only). */
export async function getMyBalance(leaveYear: number): Promise<ActionResult<IndicativeAnnualBalance | null>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    return getIndicativeAnnualBalanceCore(supabase, claims.employeeId, leaveYear);
  });
}
