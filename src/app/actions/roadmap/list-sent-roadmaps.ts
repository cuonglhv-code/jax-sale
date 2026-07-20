"use server";

import { z } from "zod";
import { listSentRoadmapsCore, type SummitRecordWithUrl } from "@/services/ielts/summit.service";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { Paginated } from "@/lib/pagination";

const filterSchema = z.object({
  centreId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

/** FR-025: academic-team audit listing — gated by `roadmap.audit` (not the broader roadmap.generate). */
export async function listSentRoadmaps(
  raw: unknown,
): Promise<ActionResult<Paginated<SummitRecordWithUrl>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "roadmap.audit");
    const filter = filterSchema.parse(raw ?? {});
    return listSentRoadmapsCore(supabase, claims, filter, createServiceRoleClient());
  });
}
