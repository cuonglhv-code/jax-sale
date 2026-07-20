import { z } from "zod";

/**
 * US6 (T053): boundary validation for the attachment upload action. The actual file bytes travel
 * via `FormData` (not JSON — Server Actions accept `FormData` directly), so this schema validates
 * only the accompanying metadata; `attachment.service.ts` re-derives/validates the real byte length
 * and sniffs the real content-type from the bytes themselves (never trusts `declaredContentType`
 * alone — storage-policies.md R8 ⚠).
 */
export const uploadAttachmentSchema = z.object({
  requestId: z.string().uuid("Mã yêu cầu không hợp lệ"),
  fileName: z.string().min(1, "Vui lòng chọn tệp"),
  declaredContentType: z.string().min(1, "Không xác định được loại tệp"),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;

/** US6 (T053): boundary validation for minting a short-TTL signed view URL. */
export const getAttachmentUrlSchema = z.object({
  requestId: z.string().uuid("Mã yêu cầu không hợp lệ"),
});

export type GetAttachmentUrlInput = z.infer<typeof getAttachmentUrlSchema>;
