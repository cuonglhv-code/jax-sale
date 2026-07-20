import { describe, it, expect } from "vitest";
import { sendSummitRoadmapCore, listSentRoadmapsCore } from "@/services/ielts/summit.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import {
  signInAs,
  serviceRoleClient,
  SEEDED_USERS,
  SEED_CENTRE_Q1,
  SEED_CENTRE_Q3,
} from "../helpers/auth";
import type { SendSummitRoadmapInput } from "@/schemas/summit";

/** A tiny 1x1 PDF-shaped buffer is unnecessary — any bytes round-trip through Storage/base64. */
const FAKE_PDF_BASE64 = Buffer.from("%PDF-1.4 fake content for test\n%%EOF").toString("base64");

function input(overrides: Partial<SendSummitRoadmapInput> = {}): SendSummitRoadmapInput {
  return {
    generationKey: `send-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    request: {
      studentName: "Send Probe",
      currentBand: "4.5",
      targetBand: "6.0",
      placement: { kind: "measured", testDate: null },
    },
    capture: {
      studentEmail: "probe@example.com",
      studentPhone: null,
      consultantName: "Tư vấn",
      consultantPhone: null,
      consultantEmail: "tv@jaxtina.test",
    },
    courseSequence: ["B2", "A1", "INT"],
    totalPrice: 39_500_000,
    manualEdited: false,
    pdfBase64: FAKE_PDF_BASE64,
    ...overrides,
  };
}

function okResend() {
  return { send: async () => ({ data: { id: "msg_ok" }, error: null }) } as never;
}
function failingResend(message = "provider unreachable") {
  return { send: async () => ({ data: null, error: { name: "application_error", message } }) } as never;
}

/** T023 — permission gate (Constitution IV: real auth, no mocks). */
describe("summit send: permission gate", () => {
  it("refuses roadmap.send for a teacher", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    await expect(assertPermission(client, "roadmap.send")).rejects.toThrow(ForbiddenError);
  });

  it("grants roadmap.send to a sale_consultant but NOT roadmap.audit", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    await expect(assertPermission(client, "roadmap.send")).resolves.toBeDefined();
    await expect(assertPermission(client, "roadmap.audit")).rejects.toThrow(ForbiddenError);
  });

  it("grants roadmap.audit to a centre_manager", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    await expect(assertPermission(client, "roadmap.audit")).resolves.toBeDefined();
  });
});

/** T023 — centre isolation: the archive is written under the CALLER's centre, never client input. */
describe("summit send: centre isolation", () => {
  it("archives under the caller's centre and RLS blocks a raw cross-centre INSERT", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1); // centre Q1
    const claims = await assertPermission(client, "roadmap.send");
    const admin = serviceRoleClient();

    const result = await sendSummitRoadmapCore(admin, claims, input(), okResend());
    const row = await admin.from("summit_sends").select("centre_id").eq("id", result.sendId).single();
    expect(row.data?.centre_id).toBe(SEED_CENTRE_Q1);

    // Defense-in-depth: RLS itself refuses a raw cross-centre insert (service-role bypasses RLS
    // by design, so this proves the POLICY independent of the service function).
    const bypass = await client.from("summit_sends").insert({
      centre_id: SEED_CENTRE_Q3,
      consultant_id: claims.employeeId,
      student_name: "RAW-BYPASS",
      student_email: "x@example.com",
      placement_kind: "measured",
      current_band: "4.5",
      target_band: "6.0",
      course_sequence: ["B2"],
      total_price: 0,
      pdf_path: `raw-bypass-${Date.now()}.pdf`,
      delivery_status: "delivered",
      generation_key: `raw-bypass-${Date.now()}`,
    });
    expect(bypass.error).not.toBeNull();
  });
});

/** T023 — idempotency: same generationKey never duplicates a row or object. */
describe("summit send: idempotency", () => {
  it("same generationKey twice on success → exactly one row, second call short-circuits", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "roadmap.send");
    const admin = serviceRoleClient();
    const payload = input();

    const first = await sendSummitRoadmapCore(admin, claims, payload, okResend());
    const second = await sendSummitRoadmapCore(admin, claims, payload, okResend());
    expect(second.sendId).toBe(first.sendId);

    const count = await admin
      .from("summit_sends")
      .select("id", { count: "exact", head: true })
      .eq("generation_key", payload.generationKey);
    expect(count.count ?? 0).toBe(1);
  });

  it("retry after a FAILED attempt actually retries the send (no false success)", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "roadmap.send");
    const admin = serviceRoleClient();
    const payload = input();

    await expect(
      sendSummitRoadmapCore(admin, claims, payload, failingResend()),
    ).rejects.toThrow();

    const afterFail = await admin
      .from("summit_sends")
      .select("delivery_status")
      .eq("generation_key", payload.generationKey)
      .single();
    expect(afterFail.data?.delivery_status).toBe("failed");

    // Retry with the SAME generationKey and a working provider — must actually send, not
    // silently report success from the failed row (this is the idempotency bug this test guards).
    const retried = await sendSummitRoadmapCore(admin, claims, payload, okResend());
    expect(retried.deliveredTo).toBe(payload.capture.studentEmail);

    const afterRetry = await admin
      .from("summit_sends")
      .select("delivery_status", { count: "exact" })
      .eq("generation_key", payload.generationKey);
    expect(afterRetry.data?.length).toBe(1); // still one row — updated in place, not duplicated
    expect(afterRetry.data?.[0]?.delivery_status).toBe("delivered");
  });
});

/** T023 — failure injection: provider error → { throws }, row marked failed, not silently ok. */
describe("summit send: failure injection", () => {
  it("provider error throws and the archived row is NOT marked delivered", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "roadmap.send");
    const admin = serviceRoleClient();
    const payload = input();

    await expect(
      sendSummitRoadmapCore(admin, claims, payload, failingResend("simulated outage")),
    ).rejects.toThrow(/Gửi email không thành công/);

    const row = await admin
      .from("summit_sends")
      .select("delivery_status")
      .eq("generation_key", payload.generationKey)
      .single();
    expect(row.data?.delivery_status).toBe("failed");
  });
});

/** T023 — archive byte-identity (SC-003): the stored object equals the input pdfBase64. */
describe("summit send: archive byte-identity", () => {
  it("the stored object is byte-identical to the sent pdfBase64", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "roadmap.send");
    const admin = serviceRoleClient();
    const payload = input();

    const result = await sendSummitRoadmapCore(admin, claims, payload, okResend());
    const row = await admin.from("summit_sends").select("pdf_path").eq("id", result.sendId).single();
    const download = await admin.storage.from("roadmap-archive").download(row.data!.pdf_path as string);
    expect(download.error).toBeNull();

    const storedBytes = Buffer.from(await download.data!.arrayBuffer());
    const inputBytes = Buffer.from(payload.pdfBase64, "base64");
    expect(storedBytes.equals(inputBytes)).toBe(true);
  });
});

/** T031 — academic audit listing: centre-scoped for centre_manager, own-centre only. */
describe("summit send: audit listing", () => {
  it("a centre_manager sees only their own centre's sends", async () => {
    const consultant = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(consultant, "roadmap.send");
    const admin = serviceRoleClient();
    await sendSummitRoadmapCore(admin, claims, input(), okResend());

    const manager = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(manager, "roadmap.audit");
    const list = await listSentRoadmapsCore(manager, managerClaims, {}, admin);
    expect(list.rows.every((r) => r.centreId === SEED_CENTRE_Q1)).toBe(true);
  });

  it("mints a signed URL per row, scoped by the audit permission (contracts/delivery-archive.md)", async () => {
    const consultant = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(consultant, "roadmap.send");
    const admin2 = serviceRoleClient();
    await sendSummitRoadmapCore(admin2, claims, input(), okResend());

    const manager = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(manager, "roadmap.audit");
    const list = await listSentRoadmapsCore(manager, managerClaims, {}, admin2);
    expect(list.rows.length).toBeGreaterThan(0);
    for (const row of list.rows) {
      expect(row.pdfSignedUrl).toMatch(/^https?:\/\//);
    }
  });
});
