"use server";

import { parseSubmitInput } from "@/lib/domain/hr-forms";
import { submitRequestCore, type SubmitRequestResult } from "@/services/hr-request.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** US1 (FR-002): submit a request through the single form-engine pipeline (annual_leave only in this slice). */
export async function submitRequest(raw: unknown): Promise<ActionResult<SubmitRequestResult>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrRequest.submit");
    const input = parseSubmitInput(raw);
    return submitRequestCore(supabase, claims, input);
  });
}
