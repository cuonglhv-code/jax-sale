"use server";

import { coverageViewFilterSchema } from "@/schemas/hr/report";
import { getCoverageViewCore, type CoverageViewRow } from "@/services/hr-report.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Paginated } from "@/lib/pagination";

/** US8 (contracts/config-balance.actions.md "Reporting", SC-007): the coverage view. */
export async function listCoverage(
  raw: unknown,
  centreId?: string,
): Promise<ActionResult<Paginated<CoverageViewRow>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrReport.view");
    const input = coverageViewFilterSchema.parse(raw);
    return getCoverageViewCore(supabase, claims, input, centreId);
  });
}
