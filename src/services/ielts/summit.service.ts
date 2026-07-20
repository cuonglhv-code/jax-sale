import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Claims } from "@/lib/data/types";
import type { SendSummitRoadmapInput } from "@/schemas/summit";
import type { SummitRecord } from "./types";
import { DomainError } from "@/lib/server-action";
import { resolveEffectiveCentre } from "@/lib/domain/vocabulary";
import { resolvePageSize, toRange, type Paginated } from "@/lib/pagination";
import { toCamelCase } from "@/lib/case";
import { getServerEnv } from "@/lib/env";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";

/**
 * The send + archive pipeline (contracts/delivery-archive.md). ONE action, ATOMIC from the
 * consultant's view: upload the exact reviewed PDF to private Storage, insert the immutable
 * archive row (idempotent on generationKey), then email the PDF. Unlike the HR notification
 * pattern (which swallows email failures), THIS email failure MUST fail the whole action loudly
 * (spec FR-023) — sending IS the point, not a side effect of it.
 *
 * Injected client (service-role — the atomic archive write bypasses RLS deliberately, mirroring
 * the medical-documents upload flow) + injected Resend client so this is testable against a real
 * local Supabase without a real network email call at every test run.
 */
export async function sendSummitRoadmapCore(
  serviceClient: SupabaseClient,
  claims: Claims,
  input: SendSummitRoadmapInput,
  resend: Pick<Resend["emails"], "send"> = new Resend(getServerEnv().RESEND_API_KEY).emails,
): Promise<{ sendId: string; deliveredTo: string }> {
  // Idempotency: a prior row with this key exists iff this exact document was already prepared.
  // Only a `delivered` row short-circuits (true idempotent success, no double-send). A `failed`
  // row means the previous attempt's email did not go out — retry must actually retry the send,
  // not silently report success (that would violate the "fail loudly, retry works" guarantee).
  const existing = await serviceClient
    .from("summit_sends")
    .select("id, pdf_path, delivery_status")
    .eq("generation_key", input.generationKey)
    .maybeSingle();
  if (existing.error) throw new DomainError(existing.error.message);
  if (existing.data?.delivery_status === "delivered") {
    return { sendId: existing.data.id as string, deliveredTo: input.capture.studentEmail };
  }

  const sendId = (existing.data?.id as string | undefined) ?? crypto.randomUUID();
  const pdfPath = (existing.data?.pdf_path as string | undefined) ?? `${claims.centreId}/${sendId}.pdf`;
  const pdfBytes = Buffer.from(input.pdfBase64, "base64");
  const isRetry = existing.data !== null;

  // 1. Upload the exact reviewed PDF (byte-identical archive — SC-003). `upsert` so a retry
  //    re-uploads over the same path instead of erroring on "object already exists".
  const upload = await serviceClient.storage
    .from("roadmap-archive")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: isRetry });
  if (upload.error) throw new DomainError(`Không thể lưu trữ PDF: ${upload.error.message}`);

  // 2. Email the PDF (the point of "send" — failure here MUST fail the whole action).
  const emailResult = await resend.send({
    from: "Jaxtina English <lo-trinh@jaxtina.test>",
    to: input.capture.studentEmail,
    subject: SUMMIT_COPY.emailSubject,
    text: SUMMIT_COPY.emailBody(input.request.studentName),
    attachments: [{ filename: "Lo-trinh-IELTS-Jaxtina.pdf", content: pdfBytes }],
  });
  const deliveryStatus = emailResult.error ? "failed" : "delivered";

  // 3. Record the attempt (insert on first try; update in place on retry — the row's history
  //    is not otherwise mutable, this is the ONE write specifically for the retry-completes-the-
  //    same-attempt case, still keyed by the same immutable generation_key/pdf_path).
  const row = {
    centre_id: claims.centreId,
    consultant_id: claims.employeeId,
    student_name: input.request.studentName,
    student_email: input.capture.studentEmail,
    placement_kind: input.request.placement.kind,
    placement_test_date:
      input.request.placement.kind === "measured" ? input.request.placement.testDate : null,
    current_band: input.request.currentBand,
    target_band: input.request.targetBand,
    course_sequence: input.courseSequence,
    total_price: input.totalPrice,
    ladder_edited: input.manualEdited,
    pdf_path: pdfPath,
    delivery_status: deliveryStatus,
    generation_key: input.generationKey,
  };
  const write = isRetry
    ? await serviceClient.from("summit_sends").update(row).eq("id", sendId).select("id").single()
    : await serviceClient.from("summit_sends").insert({ id: sendId, ...row }).select("id").single();
  if (write.error) throw new DomainError(write.error.message);

  if (emailResult.error) {
    // Loud failure (FR-023): the archive row records the failed attempt, but the ACTION must
    // still report an error so the client preserves the PDF blob and offers retry/fallback.
    throw new DomainError("Gửi email không thành công. Vui lòng thử lại hoặc tải PDF thủ công.");
  }

  return { sendId, deliveredTo: input.capture.studentEmail };
}

export interface ListSentRoadmapsFilter {
  centreId?: string;
  page?: number;
  pageSize?: number;
}

export interface SummitRecordWithUrl extends SummitRecord {
  /** Short-lived signed URL for the archived PDF (~2 min TTL) — never cached/reused (contracts/delivery-archive.md). */
  pdfSignedUrl: string | null;
}

/**
 * FR-025: academic-team audit listing. The app-layer `assertPermission("roadmap.audit")` check
 * (already passed by the caller) is the real gate; RLS is defense-in-depth. Signed URLs are
 * minted with a service-role client AFTER that gate — never derived from a raw storage read the
 * client could replay, and never embedded anywhere but this response (mirrors the HR
 * medical-document view flow: app-check first, then mint, ~2 min TTL, no caching).
 */
export async function listSentRoadmapsCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: ListSentRoadmapsFilter,
  serviceClient: SupabaseClient,
): Promise<Paginated<SummitRecordWithUrl>> {
  const effectiveCentre = resolveEffectiveCentre(claims.role, claims.centreId, filter.centreId);
  const pageSize = resolvePageSize(filter.pageSize);
  const page = filter.page ?? 1;
  const { from, to } = toRange(page, pageSize);

  let query = supabase.from("summit_sends").select("*", { count: "exact" });
  if (effectiveCentre !== undefined) query = query.eq("centre_id", effectiveCentre);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new DomainError(error.message);

  const rows = await Promise.all(
    (data ?? []).map(async (row) => {
      const record = toCamelCase<SummitRecord>(row as Record<string, unknown>);
      const signed = await serviceClient.storage
        .from("roadmap-archive")
        .createSignedUrl(record.pdfPath, 120);
      return { ...record, pdfSignedUrl: signed.error ? null : signed.data.signedUrl };
    }),
  );

  return { rows, total: count ?? 0, page, pageSize };
}
