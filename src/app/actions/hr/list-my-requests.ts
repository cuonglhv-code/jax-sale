"use server";

import { listMyRequestsCore } from "@/services/hr-request.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { HrRequest } from "@/lib/data/types";

/** US1: "my requests" — own-submitter scoped, gated by auth only (matches listTasks's read convention). */
export async function listMyRequests(): Promise<ActionResult<HrRequest[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    return listMyRequestsCore(supabase, claims);
  });
}
