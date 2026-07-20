"use server";

import { listMyCoverNominationsCore } from "@/services/cover.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { CoverAssignment } from "@/lib/data/types";

/** US4 (T043): nominations awaiting the caller's own accept/decline. */
export async function listMyCoverNominations(): Promise<ActionResult<CoverAssignment[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "cover.respond");
    return listMyCoverNominationsCore(supabase, claims);
  });
}
