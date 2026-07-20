"use server";

import { decideRequestSchema } from "@/schemas/hr/decide";
import { decideRequestCore } from "@/services/hr-request.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { HrRequest } from "@/lib/data/types";

/** US2 (contracts/hr-requests.actions.md — decideRequest): approve/reject from the approval queue. */
export async function decideRequest(raw: unknown): Promise<ActionResult<HrRequest>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrRequest.decide");
    const input = decideRequestSchema.parse(raw);
    return decideRequestCore(supabase, claims, input);
  });
}
