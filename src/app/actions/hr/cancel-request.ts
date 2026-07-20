"use server";

import { cancelRequestSchema } from "@/schemas/hr/cancel";
import { cancelOrWithdrawCore } from "@/services/hr-request.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { HrRequest } from "@/lib/data/types";

/** US2 (contracts/hr-requests.actions.md — cancelOrWithdraw): submitter cancels/withdraws own request. */
export async function cancelRequest(raw: unknown): Promise<ActionResult<HrRequest>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrRequest.cancel");
    const input = cancelRequestSchema.parse(raw);
    return cancelOrWithdrawCore(supabase, claims, input.requestId);
  });
}
