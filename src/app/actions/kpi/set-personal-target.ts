"use server";

import { setPersonalTargetInput } from "@/schemas/kpi";
import { setPersonalTargetCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { PersonalKpiEntry } from "@/lib/data/types";

/** FR-TARGET-01: a centre manager/admin sets/clears a per-consultant target within their own centre. */
export async function setPersonalTarget(raw: unknown): Promise<ActionResult<PersonalKpiEntry>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.setTarget");
    const input = setPersonalTargetInput.parse(raw);
    return setPersonalTargetCore(supabase, claims, input);
  });
}
