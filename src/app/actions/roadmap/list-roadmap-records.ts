"use server";

import { z } from "zod";
import { listRoadmapRecordsCore } from "@/services/ielts/roadmap.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { RoadmapRecord } from "@/services/ielts/types";
import type { Paginated } from "@/lib/pagination";

const filterSchema = z.object({
  centreId: z.string().optional(),
  consultantId: z.string().uuid().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

/** FR-LOG-02: broad-read audit list for the academic team. */
export async function listRoadmapRecords(raw: unknown): Promise<ActionResult<Paginated<RoadmapRecord>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    const filter = filterSchema.parse(raw ?? {});
    return listRoadmapRecordsCore(supabase, claims, filter);
  });
}
