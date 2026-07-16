import { describe, it, expect } from "vitest";
import { logRoadmapRecordCore } from "@/services/ielts/roadmap.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, SEED_CENTRE_Q1, SEED_CENTRE_Q3, SEED_EMPLOYEE_TEACHER_Q1 } from "../helpers/auth";
import type { SubmitRoadmapInput } from "@/schemas/roadmap";

function submitInput(genKey: string): SubmitRoadmapInput {
  return {
    request: {
      studentName: "Iso Probe", audience: "THPT", studentEmail: "iso@example.com", studentPhone: null,
      currentBand: "3.5", targetBand: "6.5", examPurpose: "KHAC", targetExamDate: null,
      intensity: "TIEU_CHUAN", consultantName: "C", consultantPhone: null, consultantEmail: null,
      startDate: null,
    },
    courseSequence: ["B1", "B2", "A1", "A2", "A3", "INT"],
    manualEdited: false,
    generationKey: genKey,
    deliveryStatus: "drafted",
  };
}

/**
 * US7 (T036) — centre isolation for roadmap_records (SC-008-class). A centre-A user cannot write a
 * centre-B row, proven INCLUDING a raw INSERT that bypasses the service (RLS is authoritative).
 */
describe("roadmap: centre isolation", () => {
  it("logRoadmapRecordCore writes under the CALLER's centre (never a client-supplied centre)", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1); // centre Q1
    const claims = await assertPermission(client, "roadmap.generate");
    const { recordId } = await logRoadmapRecordCore(client, claims, submitInput(`iso-own-${Date.now()}`));
    expect(recordId).toBeTruthy();

    const { data } = await client.from("roadmap_records").select("centre_id").eq("id", recordId!).single();
    expect(data?.centre_id).toBe(SEED_CENTRE_Q1);
  });

  it("RLS refuses a raw cross-centre INSERT even bypassing the service (SC-003 analog)", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1); // Q1 caller
    const { error } = await client.from("roadmap_records").insert({
      centre_id: SEED_CENTRE_Q3, // attempt to plant under another centre
      consultant_id: SEED_EMPLOYEE_TEACHER_Q1,
      student_name: "ISO-RAW-BYPASS",
      student_email: "raw@example.com",
      audience: "THPT",
      current_band: "3.5",
      target_band: "6.5",
      course_sequence: ["B1"],
      generation_key: `iso-raw-${Date.now()}`,
    });
    expect(error).not.toBeNull();

    const check = await client
      .from("roadmap_records")
      .select("id", { count: "exact", head: true })
      .eq("student_name", "ISO-RAW-BYPASS");
    expect(check.count ?? 0).toBe(0);
  });
});
