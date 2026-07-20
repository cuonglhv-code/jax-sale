"use server";

import { sendSummitRoadmapSchema } from "@/schemas/summit";
import { sendSummitRoadmapCore } from "@/services/ielts/summit.service";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/**
 * Send + archive (contracts/delivery-archive.md). Canonical pipeline: verify permission on the
 * request-scoped client (real session), then hand off to a service-role client for the atomic
 * upload+insert (mirrors the HR medical-document upload flow — the archive write deliberately
 * bypasses RLS for atomicity; centre confinement is enforced in code from verified claims, never
 * from client input).
 */
export async function sendSummitRoadmap(
  raw: unknown,
): Promise<ActionResult<{ sendId: string; deliveredTo: string }>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "roadmap.send");
    const input = sendSummitRoadmapSchema.parse(raw);
    const serviceClient = createServiceRoleClient();
    return sendSummitRoadmapCore(serviceClient, claims, input);
  });
}
