"use server";

import { submitRoadmapSchema } from "@/schemas/roadmap";
import { logRoadmapRecordCore } from "@/services/ielts/roadmap.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** FR-LOG-01/02: log a generated roadmap (centre-scoped, audited). Canonical pipeline. */
export async function submitRoadmap(raw: unknown): Promise<ActionResult<{ recordId: string | null }>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "roadmap.generate");
    const input = submitRoadmapSchema.parse(raw);
    return logRoadmapRecordCore(supabase, claims, input);
  });
}
