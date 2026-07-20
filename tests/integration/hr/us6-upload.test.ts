import { describe, it, expect, afterEach } from "vitest";
import { submitRequestCore } from "@/services/hr-request.service";
import { uploadAttachmentCore } from "@/services/attachment.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError, ForbiddenError } from "@/lib/server-action";
import { serviceRoleClient } from "../../helpers/auth";
import { hrClientFor, samplePdfBytes, HR_SEED } from "./_setup";

/**
 * US6 (T051): upload validation + the "required but chicken/egg" submit-time behaviour.
 *
 * Submit-time note (documented per the task's instruction to record the call): sick_leave's
 * `requiresDocument: true` on its FormDefinition (hr-forms.ts) is NOT enforced as a hard
 * submit-time block — the request row must exist BEFORE a document can be attached to it (the
 * attachment's `request_id` foreign key requires the parent row), so requiring the file at
 * create-time is a chicken/egg impossibility without either (a) a two-phase "draft" request state
 * that doesn't exist in this data model, or (b) accepting the file in the same call as the initial
 * insert (which would need the create RPC itself to touch storage — a boundary violation: the RPC
 * is a Postgres function and cannot call the Storage API). data-model.md / tasks.md's own framing
 * ("requiresDocument" as a FormDefinition flag consulted at the FORM level) supports a UI-level
 * nudge instead: the FormDefinition flag drives a "please attach a document" prompt on the
 * sick/personal-leave form (T055), and nothing at the DB/service layer refuses a sick_leave submit
 * that has no attachment yet. This is an accepted trade-off, not a security gap: a sick_leave
 * request with no attachment is still fully auditable/reviewable by the approver (who sees "Không
 * có tài liệu đính kèm" and can reject for missing documentation) — it is a UX/process control, not
 * a data-integrity one.
 */
describe("hr US6: attachment upload validation (T051)", () => {
  const svc = serviceRoleClient();
  const createdRequestIds: string[] = [];

  afterEach(async () => {
    for (const id of createdRequestIds.splice(0)) {
      await svc.from("request_attachment").delete().eq("request_id", id);
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", id);
    }
  });

  it("submitting sick_leave WITHOUT an attachment still succeeds (no hard submit-time block)", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-11-17", // Tuesday — no class this weekday for teacher.q1 (seed: Mon/Wed)
      endDate: "2026-11-17",
      dayPart: "full",
    } as never);
    createdRequestIds.push(request.id);

    expect(request.status).toBe("pending");
    expect(request.hasAttachment).toBe(false);
  });

  it("uploading a valid PDF within the size limit succeeds and creates a request_attachment row", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-11-24",
      endDate: "2026-11-24",
      dayPart: "full",
    } as never);
    createdRequestIds.push(request.id);

    const attachment = await uploadAttachmentCore(client, svc, claims, {
      requestId: request.id,
      fileName: "medical.pdf",
      declaredContentType: "application/pdf",
      bytes: samplePdfBytes(),
    });

    expect(attachment.requestId).toBe(request.id);
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.sizeBytes).toBe(samplePdfBytes().byteLength);

    const { data: row } = await svc
      .from("request_attachment")
      .select("id")
      .eq("request_id", request.id)
      .maybeSingle();
    expect(row).not.toBeNull();
  });

  it("rejects an oversized file with a Vietnamese message (byte-level size check)", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      dayPart: "full",
    } as never);
    createdRequestIds.push(request.id);

    // doc_type_policy seeds sick_leave at max_size_bytes = 10485760 (10 MiB) — build an oversized
    // buffer with a valid PDF magic-byte prefix so the failure is genuinely about SIZE, not MIME.
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(samplePdfBytes());

    await expect(
      uploadAttachmentCore(client, svc, claims, {
        requestId: request.id,
        fileName: "too-big.pdf",
        declaredContentType: "application/pdf",
        bytes: oversized,
      }),
    ).rejects.toThrow(/dung lượng/);
  });

  it("rejects a disallowed MIME type via real byte-level sniff, even with a spoofed declared type", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-12-08",
      endDate: "2026-12-08",
      dayPart: "full",
    } as never);
    createdRequestIds.push(request.id);

    // A plain-text buffer, declared (falsely) as a PDF — the real sniff must catch this.
    const bytes = new TextEncoder().encode("this is not a pdf, png, or jpeg");

    await expect(
      uploadAttachmentCore(client, svc, claims, {
        requestId: request.id,
        fileName: "fake.pdf",
        declaredContentType: "application/pdf",
        bytes,
      }),
    ).rejects.toThrow(DomainError);
  });

  it("rejects attaching to a request that is NOT the caller's own (app-layer gate)", async () => {
    // sale.q1's seeded sick_leave request (HR_SEED.requestSickLeave) — teacher.q1 must not attach to it.
    const teacherClient = await hrClientFor("teacherQ1");
    const claims = await assertPermission(teacherClient, "hrRequest.submit");

    await expect(
      uploadAttachmentCore(teacherClient, svc, claims, {
        requestId: HR_SEED.requestSickLeave,
        fileName: "medical.pdf",
        declaredContentType: "application/pdf",
        bytes: samplePdfBytes(),
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
