import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uploadAttachmentCore, getAttachmentSignedUrlCore } from "@/services/attachment.service";
import { listMyRequestsCore, listApprovalQueueCore } from "@/services/hr-request.service";
import { assertPermission, assertAuthenticated } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { serviceRoleClient } from "../../helpers/auth";
import { HR_SEED, hrClientFor, samplePdfBytes, teardownMedicalFixture } from "./_setup";

/**
 * US6 (T050) — THE critical confidentiality proof (SC-006, contracts/storage-policies.md). Uploads
 * a REAL medical document (via the real service-role upload path, `uploadAttachmentCore`) attached
 * to `HR_SEED.requestPersonalLeave` (sale.q1's personal_leave request, centre Q1) and proves, against
 * the LIVE storage.objects RLS (not a mock, not just the metadata table). (Reconciled 2026-07-20:
 * sick_leave no longer supports attachments — see sick-leave.ts / hr-forms.ts — so this proof moved
 * to personal_leave, which still does; nothing about the confidentiality mechanism itself changed.)
 *
 *  (a) a same-centre PEER (teacher.q1 — same centre, NOT the approver, NOT the submitter) is denied
 *      BOTH the `request_attachment` metadata row (RLS) AND any object read — proven by attempting
 *      the real `storage.objects` SELECT with the peer's own authenticated client (bypassing the
 *      app-layer service function entirely, so this is a genuine RLS proof, not just an app check).
 *  (b) the centre_manager of centre Q1 (the approver) CAN mint a signed URL, and that URL actually
 *      resolves to the uploaded bytes (a real fetch, not just "the mint call succeeded").
 *  (c) a centre_manager of a DIFFERENT centre (Q3) is DENIED (ForbiddenError from the app-layer
 *      gate — the mint is never reached for an ineligible caller).
 *  (d) super_admin CAN access it.
 *  (e) the submitter (sale.q1, who uploaded it) can access their OWN attachment.
 *  (f) listMyRequestsCore / listApprovalQueueCore NEVER expose the storage path or any document
 *      content — only a `hasAttachment: true/false` boolean.
 */
describe("hr US6: medical-document confidentiality (SC-006)", () => {
  let uploadedPath: string;

  afterAll(async () => {
    if (uploadedPath) await teardownMedicalFixture([uploadedPath]);
    // Best-effort cleanup of the metadata row so repeated test runs stay idempotent.
    const svc = serviceRoleClient();
    await svc.from("request_attachment").delete().eq("request_id", HR_SEED.requestPersonalLeave);
  });

  beforeAll(async () => {
    // Clean slate: remove any leftover attachment row/object from a previous failed run.
    const svc = serviceRoleClient();
    const { data: existing } = await svc
      .from("request_attachment")
      .select("storage_path")
      .eq("request_id", HR_SEED.requestPersonalLeave);
    if (existing && existing.length > 0) {
      await svc.storage.from("medical-documents").remove(existing.map((r) => r.storage_path as string));
      await svc.from("request_attachment").delete().eq("request_id", HR_SEED.requestPersonalLeave);
    }
  });

  it("uploads a real medical document for sale.q1's personal_leave request via the real upload path", async () => {
    const saleClient = await hrClientFor("saleQ1");
    const claims = await assertPermission(saleClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const attachment = await uploadAttachmentCore(saleClient, svc, claims, {
      requestId: HR_SEED.requestPersonalLeave,
      fileName: "medical.pdf",
      declaredContentType: "application/pdf",
      bytes: samplePdfBytes(),
    });

    uploadedPath = attachment.storagePath;
    expect(attachment.requestId).toBe(HR_SEED.requestPersonalLeave);
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.isMedical).toBe(true);
  });

  it("(a) a same-centre PEER is denied the metadata row via real RLS", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const { data, error } = await teacherClient
      .from("request_attachment")
      .select("id, storage_path")
      .eq("request_id", HR_SEED.requestPersonalLeave)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull(); // RLS hides the row entirely — not an empty-but-visible row
  });

  it("(a) a same-centre PEER is denied the storage object via real storage.objects RLS", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    // Direct object read attempt bypassing the app layer entirely — proves storage RLS itself,
    // not merely the app-layer gate in getAttachmentSignedUrlCore.
    const { data, error } = await teacherClient.storage.from("medical-documents").download(uploadedPath);

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("(a) a same-centre PEER's app-layer view request is also denied (defense in depth)", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const claims = await assertAuthenticated(teacherClient);
    const svc = serviceRoleClient();

    await expect(
      getAttachmentSignedUrlCore(teacherClient, svc, claims, HR_SEED.requestPersonalLeave),
    ).rejects.toThrow(ForbiddenError);
  });

  it("(b) the centre_manager of centre Q1 (approver) CAN mint a signed URL that resolves to the real bytes", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const claims = await assertAuthenticated(managerClient);
    const svc = serviceRoleClient();

    const url = await getAttachmentSignedUrlCore(managerClient, svc, claims, HR_SEED.requestPersonalLeave);
    expect(url).toContain("http");

    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.slice(0, 4)).toEqual(samplePdfBytes().slice(0, 4)); // "%PDF" magic bytes round-trip
  });

  it("(c) a centre_manager of a DIFFERENT centre (Q3) is denied", async () => {
    const managerQ3Client = await hrClientFor("managerQ3");
    const claims = await assertAuthenticated(managerQ3Client);
    const svc = serviceRoleClient();

    await expect(
      getAttachmentSignedUrlCore(managerQ3Client, svc, claims, HR_SEED.requestPersonalLeave),
    ).rejects.toThrow(ForbiddenError);
  });

  it("(d) super_admin CAN access it", async () => {
    const adminClient = await hrClientFor("superAdmin");
    const claims = await assertAuthenticated(adminClient);
    const svc = serviceRoleClient();

    const url = await getAttachmentSignedUrlCore(adminClient, svc, claims, HR_SEED.requestPersonalLeave);
    expect(url).toContain("http");
  });

  it("(e) the submitter (sale.q1, who uploaded it) can access their OWN attachment", async () => {
    const saleClient = await hrClientFor("saleQ1");
    const claims = await assertAuthenticated(saleClient);
    const svc = serviceRoleClient();

    const url = await getAttachmentSignedUrlCore(saleClient, svc, claims, HR_SEED.requestPersonalLeave);
    expect(url).toContain("http");
  });

  it("(f) listMyRequestsCore never exposes the storage path — only hasAttachment", async () => {
    const saleClient = await hrClientFor("saleQ1");
    const claims = await assertAuthenticated(saleClient);

    const requests = await listMyRequestsCore(saleClient, claims);
    const personalLeaveRow = requests.find((r) => r.id === HR_SEED.requestPersonalLeave);

    expect(personalLeaveRow).toBeDefined();
    expect(personalLeaveRow?.hasAttachment).toBe(true);
    expect(JSON.stringify(personalLeaveRow)).not.toContain(uploadedPath);
    expect(JSON.stringify(personalLeaveRow)).not.toContain("storage_path");
    expect(JSON.stringify(personalLeaveRow)).not.toContain("storagePath");
  });

  it("(f) listApprovalQueueCore never exposes the storage path — only hasAttachment", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const claims = await assertAuthenticated(managerClient);

    const queue = await listApprovalQueueCore(managerClient, claims);
    const personalLeaveRow = queue.find((r) => r.id === HR_SEED.requestPersonalLeave);

    expect(personalLeaveRow).toBeDefined();
    expect(personalLeaveRow?.hasAttachment).toBe(true);
    expect(JSON.stringify(personalLeaveRow)).not.toContain(uploadedPath);
    expect(JSON.stringify(personalLeaveRow)).not.toContain("storage_path");
    expect(JSON.stringify(personalLeaveRow)).not.toContain("storagePath");
  });
});
