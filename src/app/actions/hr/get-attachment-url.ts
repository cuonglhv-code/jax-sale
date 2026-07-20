"use server";

import { getAttachmentUrlSchema } from "@/schemas/hr/attachment";
import { getAttachmentSignedUrlCore } from "@/services/attachment.service";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/**
 * US6 (T053, contracts/storage-policies.md): mint a short-TTL signed URL to view a request's
 * medical document. Eligibility (super_admin ∪ approver-of-centre ∪ uploader-self) is row-specific,
 * not a single static role grant, so this action gates on `assertAuthenticated` only — the REAL
 * authorization boundary is `getAttachmentSignedUrlCore`'s app-layer check, run BEFORE the
 * service-role mint (signed URLs bypass storage RLS once issued, so the check must happen first).
 */
export async function getAttachmentUrl(requestId: string): Promise<ActionResult<string>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    const input = getAttachmentUrlSchema.parse({ requestId });
    const serviceClient = createServiceRoleClient();
    return getAttachmentSignedUrlCore(supabase, serviceClient, claims, input.requestId);
  });
}
