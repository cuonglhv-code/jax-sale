import { describe, it, expect } from "vitest";
import { logRoadmapRecordCore } from "@/services/ielts/roadmap.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, serviceRoleClient, SEEDED_USERS } from "../helpers/auth";
import type { SubmitRoadmapInput } from "@/schemas/roadmap";

function submitInput(genKey: string): SubmitRoadmapInput {
  return {
    request: {
      studentName: "Log Probe", audience: "SINH_VIEN", studentEmail: "log@example.com", studentPhone: "0900",
      currentBand: "4.5", targetBand: "6.5", examPurpose: "DU_HOC_HB", targetExamDate: null,
      intensity: "TIEU_CHUAN", consultantName: "TV", consultantPhone: null, consultantEmail: null,
      startDate: null,
    },
    courseSequence: ["B2", "A1", "A2", "A3", "INT"],
    manualEdited: true,
    generationKey: genKey,
    deliveryStatus: "drafted",
  };
}

/** US7 (T037) — every submit logs a record (all fields) + a roadmap.generate audit entry; idempotent. */
describe("roadmap: log completeness + idempotency", () => {
  it("writes a complete record and a roadmap.generate audit entry", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "roadmap.generate");
    const genKey = `log-complete-${Date.now()}`;
    const { recordId } = await logRoadmapRecordCore(client, claims, submitInput(genKey));

    const rec = await client.from("roadmap_records").select("*").eq("id", recordId!).single();
    expect(rec.data?.student_name).toBe("Log Probe");
    expect(rec.data?.course_sequence).toEqual(["B2", "A1", "A2", "A3", "INT"]);
    expect(rec.data?.manual_edited).toBe(true);
    expect(rec.data?.sent).toBe(false); // drafted ≠ confirmed sent

    // Verify the audit entry with a service-role client — a sale_consultant cannot READ audit_log
    // (Pattern C RLS restricts audit reads to super_admin/manager/admin), though it CAN write one.
    const admin = serviceRoleClient();
    const audit = await admin
      .from("audit_log")
      .select("id")
      .eq("entity_id", recordId!)
      .eq("action", "roadmap.generate");
    expect(audit.data?.length).toBe(1);
  });

  it("is idempotent on generationKey (a re-submit does not duplicate the log)", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "roadmap.generate");
    const genKey = `log-idem-${Date.now()}`;
    await logRoadmapRecordCore(client, claims, submitInput(genKey));
    await logRoadmapRecordCore(client, claims, submitInput(genKey));

    const count = await client
      .from("roadmap_records")
      .select("id", { count: "exact", head: true })
      .eq("generation_key", genKey);
    expect(count.count ?? 0).toBe(1);
  });
});
