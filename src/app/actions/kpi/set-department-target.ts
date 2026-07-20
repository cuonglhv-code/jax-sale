"use server";

import { setDepartmentTargetInput } from "@/schemas/kpi";
import { setDepartmentTargetCore } from "@/services/kpi/kpi.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** FR-TARGET-02: super_admin sets/clears a network-wide department target (§13 two-table split). */
export async function setDepartmentTarget(raw: unknown): Promise<
  ActionResult<{ id: string; departmentId: string; period: string; metricKey: string; target: number | null }>
> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "departmentKpi.setTarget");
    const input = setDepartmentTargetInput.parse(raw);
    return setDepartmentTargetCore(supabase, claims, input);
  });
}
