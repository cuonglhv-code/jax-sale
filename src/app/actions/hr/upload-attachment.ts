"use server";

import { uploadAttachmentSchema } from "@/schemas/hr/attachment";
import { uploadAttachmentCore } from "@/services/attachment.service";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import type { RequestAttachment } from "@/lib/data/types";

/**
 * US6 (T053, contracts/storage-policies.md): upload a medical/personal-leave document for a
 * request the caller ALREADY submitted (the request row must exist first — see the "chicken/egg"
 * note in attachment.service.ts / the task report). `hrRequest.submit` is reused rather than a new
 * permission key: attaching a document is conceptually part of the submitter's own submission
 * flow, and `uploadAttachmentCore`'s app-layer check (own-request-only) is the actual authorization
 * boundary here, not the permission key — matching FR-044's "no parallel authorization system".
 */
export async function uploadAttachment(
  requestId: string,
  fileName: string,
  declaredContentType: string,
  fileBytes: ArrayBuffer,
): Promise<ActionResult<RequestAttachment>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "hrRequest.submit");
    const input = uploadAttachmentSchema.parse({ requestId, fileName, declaredContentType });
    const serviceClient = createServiceRoleClient();
    return uploadAttachmentCore(supabase, serviceClient, claims, {
      requestId: input.requestId,
      fileName: input.fileName,
      declaredContentType: input.declaredContentType,
      bytes: new Uint8Array(fileBytes),
    });
  });
}
