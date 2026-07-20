import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { uploadAttachmentCore, getAttachmentSignedUrlCore } from "@/services/attachment.service";
import { listMyRequestsCore, listApprovalQueueCore } from "@/services/hr-request.service";
import { assertPermission, assertAuthenticated } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { serviceRoleClient, resolveEmployeeId, SEEDED_USERS } from "../../helpers/auth";
import { HR_SEED, hrClientFor, samplePdfBytes, teardownMedicalFixture } from "./_setup";

/**
 * US6 (T050) — THE critical confidentiality proof (SC-006, contracts/storage-policies.md). Uploads
 * a REAL medical document (via the real service-role upload path, `uploadAttachmentCore`) attached
 * to `HR_SEED.requestSickLeave` (sale.q1's sick_leave request, centre Q1) and proves, against the
 * LIVE storage.objects RLS (not a mock, not just the metadata table):
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
    await svc.from("request_attachment").delete().eq("request_id", HR_SEED.requestSickLeave);
  });

  beforeAll(async () => {
    // Clean slate: remove any leftover attachment row/object from a previous failed run.
    const svc = serviceRoleClient();
    const { data: existing } = await svc
      .from("request_attachment")
      .select("storage_path")
      .eq("request_id", HR_SEED.requestSickLeave);
    if (existing && existing.length > 0) {
      await svc.storage.from("medical-documents").remove(existing.map((r) => r.storage_path as string));
      await svc.from("request_attachment").delete().eq("request_id", HR_SEED.requestSickLeave);
    }
  });

  it("uploads a real medical document for sale.q1's sick_leave request via the real upload path", async () => {
    const saleClient = await hrClientFor("saleQ1");
    const claims = await assertPermission(saleClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const attachment = await uploadAttachmentCore(saleClient, svc, claims, {
      requestId: HR_SEED.requestSickLeave,
      fileName: "medical.pdf",
      declaredContentType: "application/pdf",
      bytes: samplePdfBytes(),
    });

    uploadedPath = attachment.storagePath;
    expect(attachment.requestId).toBe(HR_SEED.requestSickLeave);
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.isMedical).toBe(true);
  });

  it("(a) a same-centre PEER is denied the metadata row via real RLS", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const { data, error } = await teacherClient
      .from("request_attachment")
      .select("id, storage_path")
      .eq("request_id", HR_SEED.requestSickLeave)
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
    const teacherId = await resolveEmployeeId(teacherClient, SEEDED_USERS.teacherQ1);
    const claims = await assertAuthenticated(teacherClient);
    const svc = serviceRoleClient();

    await expect(
      getAttachmentSignedUrlCore(teacherClient, svc, { ...claims, employeeId: teacherId }, HR_SEED.requestSickLeave),
    ).rejects.toThrow(ForbiddenError);
  });

  it("(b) the centre_manager of centre Q1 (approver) CAN mint a signed URL that resolves to the real bytes", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const claims = await assertAuthenticated(managerClient);
    const svc = serviceRoleClient();

    const url = await getAttachmentSignedUrlCore(managerClient, svc, claims, HR_SEED.requestSickLeave);
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
      getAttachmentSignedUrlCore(managerQ3Client, svc, claims, HR_SEED.requestSickLeave),
    ).rejects.toThrow(ForbiddenError);
  });

  it("(d) super_admin CAN access it", async () => {
    const adminClient = await hrClientFor("superAdmin");
    const claims = await assertAuthenticated(adminClient);
    const svc = serviceRoleClient();

    const url = await getAttachmentSignedUrlCore(adminClient, svc, claims, HR_SEED.requestSickLeave);
    expect(url).toContain("http");
  });

  it("(e) the submitter (sale.q1, who uploaded it) can access their OWN attachment", async () => {
    const saleClient = await hrClientFor("saleQ1");
    const claims = await assertAuthenticated(saleClient);
    const svc = serviceRoleClient();

    const url = await getAttachmentSignedUrlCore(saleClient, svc, claims, HR_SEED.requestSickLeave);
    expect(url).toContain("http");
  });

  it("(f) listMyRequestsCore never exposes the storage path — only hasAttachment", async () => {
    const saleClient = await hrClientFor("saleQ1");
    const claims = await assertAuthenticated(saleClient);

    const requests = await listMyRequestsCore(saleClient, claims);
    const sickLeaveRow = requests.find((r) => r.id === HR_SEED.requestSickLeave);

    expect(sickLeaveRow).toBeDefined();
    expect(sickLeaveRow?.hasAttachment).toBe(true);
    expect(JSON.stringify(sickLeaveRow)).not.toContain(uploadedPath);
    expect(JSON.stringify(sickLeaveRow)).not.toContain("storage_path");
    expect(JSON.stringify(sickLeaveRow)).not.toContain("storagePath");
  });

  it("(f) listApprovalQueueCore never exposes the storage path — only hasAttachment", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const claims = await assertAuthenticated(managerClient);

    const queue = await listApprovalQueueCore(managerClient, claims);
    const sickLeaveRow = queue.find((r) => r.id === HR_SEED.requestSickLeave);

    expect(sickLeaveRow).toBeDefined();
    expect(sickLeaveRow?.hasAttachment).toBe(true);
    expect(JSON.stringify(sickLeaveRow)).not.toContain(uploadedPath);
    expect(JSON.stringify(sickLeaveRow)).not.toContain("storage_path");
    expect(JSON.stringify(sickLeaveRow)).not.toContain("storagePath");
  });
});
