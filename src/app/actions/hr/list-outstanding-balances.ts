"use server";

import { outstandingBalancesFilterSchema } from "@/schemas/hr/report";
import { listOutstandingBalancesCore, type OutstandingBalanceRow } from "@/services/hr-report.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Paginated } from "@/lib/pagination";

/** US8 (contracts/config-balance.actions.md "Reporting"): outstanding annual-leave balances (FR-038). */
export async function listOutstandingBalances(raw: unknown): Promise<ActionResult<Paginated<OutstandingBalanceRow>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrReport.view");
    const input = outstandingBalancesFilterSchema.parse(raw);
    return listOutstandingBalancesCore(supabase, claims, input);
  });
}
