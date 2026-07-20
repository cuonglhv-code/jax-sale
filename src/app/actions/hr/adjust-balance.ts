"use server";

import { adjustBalanceSchema } from "@/schemas/hr/balance";
import { adjustOpeningBalanceCore } from "@/services/leave-balance.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { LeaveBalance } from "@/lib/data/types";

/** US3 (T028): manual opening-balance adjustment (key: leaveBalance.adjust; super_admin only). */
export async function adjustBalance(raw: unknown): Promise<ActionResult<LeaveBalance>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    await assertPermission(supabase, "leaveBalance.adjust");
    const input = adjustBalanceSchema.parse(raw);
    return adjustOpeningBalanceCore(supabase, input);
  });
}
