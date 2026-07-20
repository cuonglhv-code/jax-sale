"use server";

import { respondCoverSchema } from "@/schemas/hr/respond-cover";
import { respondCoverCore } from "@/services/cover.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { CoverAssignment } from "@/lib/data/types";

/** US4 (T043, contracts/cover-timetable.actions.md — respondCover): nominee accept/decline. */
export async function respondCover(raw: unknown): Promise<ActionResult<CoverAssignment>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "cover.respond");
    const input = respondCoverSchema.parse(raw);
    return respondCoverCore(supabase, claims, input);
  });
}
