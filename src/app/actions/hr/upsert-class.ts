"use server";

import { upsertClassSchema } from "@/schemas/hr/class";
import { upsertClassCore } from "@/services/class.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { TeachingClass } from "@/lib/data/types";

/** US4 (T041, contracts/cover-timetable.actions.md — upsertClass): create/edit a timetable class. */
export async function upsertClass(raw: unknown): Promise<ActionResult<TeachingClass>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "timetable.manage");
    const input = upsertClassSchema.parse(raw);
    return upsertClassCore(supabase, claims, input);
  });
}
