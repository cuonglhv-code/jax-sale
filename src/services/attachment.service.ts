import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, RequestAttachment } from "@/lib/data/types";
import { DomainError, ForbiddenError } from "@/lib/server-action";
import { sniffMimeType } from "@/lib/hr/file-sniff";

/**
 * US6 (T053, contracts/storage-policies.md): private-bucket medical/personal-leave attachment
 * upload + short-TTL signed view. Two service-role touch points only (upload write, sign mint) —
 * everything else (the "may I?" checks) runs through the request-scoped client so RLS still
 * confines what this function can even SEE before it decides to act, matching
 * `deactivateEmployeeCore`'s dual-client template (personnel.service.ts).
 */

const MEDICAL_BUCKET = "medical-documents";
const SIGNED_URL_TTL_SECONDS = 120; // ~2 min — storage-policies.md's explicit short-TTL requirement

interface RawAttachmentRow {
  id: string;
  request_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  is_medical: boolean;
  uploaded_by: string;
  purge_after: string | null;
  created_at: string;
}

function toRequestAttachment(row: RawAttachmentRow): RequestAttachment {
  return {
    id: row.id,
    requestId: row.request_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    isMedical: row.is_medical,
    uploadedBy: row.uploaded_by,
    purgeAfter: row.purge_after,
    createdAt: row.created_at,
  };
}

interface DocTypePolicyRow {
  max_size_bytes: number;
  allowed_mime: string[];
  required: boolean;
}

/** Read the request type's attachment policy (broad-read Pattern B config, data-model §3). */
async function getDocTypePolicy(
  supabase: SupabaseClient,
  requestType: string,
): Promise<DocTypePolicyRow | null> {
  const { data, error } = await supabase
    .from("doc_type_policy")
    .select("max_size_bytes, allowed_mime, required")
    .eq("request_type", requestType)
    .maybeSingle();
  if (error) throw error;
  return data as DocTypePolicyRow | null;
}

interface OwnRequestRow {
  id: string;
  request_type: string;
  submitter_id: string;
  centre_id: string;
}

/** Fetch the request this upload/view targets THROUGH THE CALLER'S OWN RLS-scoped client. */
async function getVisibleRequest(supabase: SupabaseClient, requestId: string): Promise<OwnRequestRow | null> {
  const { data, error } = await supabase
    .from("hr_request")
    .select("id, request_type, submitter_id, centre_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data as OwnRequestRow | null;
}

export interface UploadAttachmentParams {
  requestId: string;
  fileName: string;
  declaredContentType: string;
  bytes: Uint8Array;
}

/**
 * Upload a medical/personal-leave document for `params.requestId`. App-layer gate FIRST (the
 * caller must be that request's OWN submitter — never attach to someone else's request, even
 * within the same centre), THEN byte-level MIME sniff + size check against `doc_type_policy`,
 * THEN the atomic service-role write (upload object + insert metadata row). Real MIME sniffing
 * (not the client-declared `Content-Type`) is the authoritative check — R8's explicit caveat that
 * bucket-level checks only validate the declared type.
 */
export async function uploadAttachmentCore(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  claims: Claims,
  params: UploadAttachmentParams,
): Promise<RequestAttachment> {
  const request = await getVisibleRequest(supabase, params.requestId);
  if (!request) {
    throw new DomainError("Không tìm thấy yêu cầu hoặc bạn không có quyền xem yêu cầu này");
  }
  if (request.submitter_id !== claims.employeeId) {
    throw new ForbiddenError("Bạn chỉ có thể đính kèm tài liệu vào yêu cầu của chính mình");
  }

  const policy = await getDocTypePolicy(supabase, request.request_type);
  if (!policy) {
    throw new DomainError("Loại yêu cầu này không được phép đính kèm tài liệu");
  }

  const sniffedMime = sniffMimeType(params.bytes);
  if (!sniffedMime || !policy.allowed_mime.includes(sniffedMime)) {
    throw new DomainError("Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, PNG hoặc JPEG.");
  }
  if (params.bytes.byteLength > policy.max_size_bytes) {
    const maxMb = (policy.max_size_bytes / (1024 * 1024)).toFixed(1);
    throw new DomainError(`Tệp vượt quá dung lượng cho phép (tối đa ${maxMb} MB).`);
  }

  const extension = sniffedMime === "application/pdf" ? "pdf" : sniffedMime === "image/png" ? "png" : "jpg";
  const storagePath = `${params.requestId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await serviceClient.storage
    .from(MEDICAL_BUCKET)
    .upload(storagePath, params.bytes, { contentType: sniffedMime, upsert: false });
  if (uploadError) throw new DomainError(`Tải tệp lên thất bại: ${uploadError.message}`);

  const { data, error: insertError } = await serviceClient
    .from("request_attachment")
    .insert({
      request_id: params.requestId,
      storage_path: storagePath,
      mime_type: sniffedMime,
      size_bytes: params.bytes.byteLength,
      is_medical: true,
      uploaded_by: claims.employeeId,
    })
    .select("id, request_id, storage_path, mime_type, size_bytes, is_medical, uploaded_by, purge_after, created_at")
    .single();
  if (insertError) {
    // Orphan-avoidance: the object uploaded but metadata failed — remove it so no dangling object
    // survives without a traceable request_attachment row (data-model §7 authoritative link).
    await serviceClient.storage.from(MEDICAL_BUCKET).remove([storagePath]);
    throw new DomainError(`Lưu thông tin tài liệu thất bại: ${insertError.message}`);
  }

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "attachment.upload",
    p_entity_type: "hr_request",
    p_entity_id: params.requestId,
    p_metadata: { mimeType: sniffedMime, sizeBytes: params.bytes.byteLength },
  });
  if (auditError) console.error("[audit] attachment.upload failed to log", auditError);

  return toRequestAttachment(data as RawAttachmentRow);
}

/**
 * Mint a short-TTL signed URL to VIEW the medical document attached to `requestId`. The app-layer
 * check runs FIRST and is the real security gate — a signed URL, once minted, bypasses storage RLS
 * entirely (storage-policies.md's explicit ordering requirement), so this function must never mint
 * one before confirming eligibility: super_admin, OR centre_manager of the request's own centre
 * (the approver — role+centre, since approval is centre-derived, not a stored approver id), OR the
 * uploader themself.
 */
export async function getAttachmentSignedUrlCore(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  claims: Claims,
  requestId: string,
): Promise<string> {
  const { data: attachment, error: attachmentError } = await supabase
    .from("request_attachment")
    .select("storage_path, uploaded_by, request_id")
    .eq("request_id", requestId)
    .maybeSingle();
  if (attachmentError) throw attachmentError;

  // Resolve the owning request's centre via the SERVICE-ROLE client (not the caller's RLS-scoped
  // client) — a peer must be told "not eligible", not silently given a false-negative "not found"
  // that would otherwise leak which requests carry an attachment via response-shape differences.
  const { data: request, error: requestError } = await serviceClient
    .from("hr_request")
    .select("centre_id")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!attachment || !request) {
    throw new DomainError("Không tìm thấy tài liệu đính kèm cho yêu cầu này");
  }

  const isUploader = attachment.uploaded_by === claims.employeeId;
  const isSuperAdmin = claims.role === "super_admin";
  const isApproverOfCentre = claims.role === "centre_manager" && request.centre_id === claims.centreId;
  if (!isUploader && !isSuperAdmin && !isApproverOfCentre) {
    throw new ForbiddenError("Bạn không có quyền xem tài liệu này");
  }

  const { data: signed, error: signError } = await serviceClient.storage
    .from(MEDICAL_BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) {
    throw new DomainError(`Không thể tạo liên kết xem tài liệu: ${signError?.message ?? "unknown error"}`);
  }

  return signed.signedUrl;
}

/** US6 (T054): cheap existence check for the `hasAttachment` projection — never the row itself. */
export async function hasAttachmentForRequests(
  supabase: SupabaseClient,
  requestIds: readonly string[],
): Promise<Set<string>> {
  if (requestIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("request_attachment")
    .select("request_id")
    .in("request_id", requestIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.request_id as string));
}
