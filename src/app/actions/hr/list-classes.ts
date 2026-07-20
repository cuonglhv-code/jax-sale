"use server";

import { listClassesCore } from "@/services/class.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { TeachingClass } from "@/lib/data/types";

/** US4 (T041): broad-read class list (schedules not sensitive) — any authenticated employee. */
export async function listClasses(centreId?: string): Promise<ActionResult<TeachingClass[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    await assertAuthenticated(supabase);
    return listClassesCore(supabase, centreId);
  });
}
