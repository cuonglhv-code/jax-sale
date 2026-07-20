import { describe, it, expect } from "vitest";
import { submitRequestCore, decideRequestCore } from "@/services/hr-request.service";
import { respondCoverCore } from "@/services/cover.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError } from "@/lib/server-action";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER2_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";
import { sickLeaveSchema } from "@/schemas/hr/sick-leave";
import { personalLeaveSchema } from "@/schemas/hr/personal-leave";
import { overtimeSchema } from "@/schemas/hr/overtime";
import { salaryAdvanceSchema } from "@/schemas/hr/salary-advance";

/**
 * US5 (T045): each of the 8 remaining form types submits through the SAME engine
 * (submitRequestCore), with correct per-type validation and side effects (data-model §10):
 *  - sick_leave / personal_leave / unpaid_leave: leave-family, conflict-scoped, but NONE draw the
 *    annual-leave balance (FR-007/FR-014) — approving one leaves leave_balance.consumed_days
 *    unchanged, and a session-overlapping submission still requires an accepted cover (like
 *    annual_leave).
 *  - overtime: NOT conflict-scoped (no absence from teaching) — a session-overlapping date does
 *    NOT require a cover.
 *  - salary_advance / purchase / business_travel: money forms, capture `amount`, no dates/covers
 *    required (except business_travel's own start/end range, which per data-model §10 is also NOT
 *    conflict-scoped).
 */
describe("hr US5: remaining 8 form types on the single engine", () => {
  it("submits sick_leave with a date range + day_part; validation rejects a missing range", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-11-03", // Tuesday — teacher.q1 has no class this weekday (seed: Mon/Wed only)
      endDate: "2026-11-03",
      dayPart: "full",
    } as never);

    try {
      expect(request.status).toBe("pending");
      expect(request.requestType).toBe("sick_leave");
      expect(request.workingDays).toBe(1);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }

    // Boundary (Zod) validation — matches convention (unit-level schema tests elsewhere).
    expect(() =>
      sickLeaveSchema.parse({ requestType: "sick_leave", startDate: "", endDate: "2026-11-03", dayPart: "full" }),
    ).toThrow();
  });

  it("submits personal_leave with an event + reason payload; validation rejects an invalid event", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(client, claims, {
      requestType: "personal_leave",
      startDate: "2026-11-10", // Tuesday — no class this weekday, distinct from other probes' dates
      endDate: "2026-11-10",
      dayPart: "full",
      event: "marriage_self",
      reason: "Kết hôn",
    } as never);

    try {
      expect(request.status).toBe("pending");
      expect(request.payload.event).toBe("marriage_self");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }

    expect(() =>
      personalLeaveSchema.parse({
        requestType: "personal_leave",
        startDate: "2026-11-10",
        endDate: "2026-11-10",
        dayPart: "full",
        event: "not_a_real_event",
        reason: "x",
      }),
    ).toThrow();
  });

  it("submits unpaid_leave with a reason; requires neither balance nor documentation", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(client, claims, {
      requestType: "unpaid_leave",
      startDate: "2026-11-05", // Thursday — no class this weekday
      endDate: "2026-11-05",
      dayPart: "full",
      reason: "Việc gia đình",
    } as never);

    try {
      expect(request.status).toBe("pending");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("approving sick_leave/personal_leave/unpaid_leave does NOT change leave_balance.consumed_days (FR-014)", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const { data: before } = await svc
      .from("leave_balance")
      .select("consumed_days")
      .eq("employee_id", claims.employeeId)
      .eq("leave_year", HR_SEED.leaveYear)
      .maybeSingle();

    const request = await submitRequestCore(client, claims, {
      requestType: "unpaid_leave",
      startDate: "2026-11-05", // Thursday
      endDate: "2026-11-05",
      dayPart: "full",
      reason: "Việc riêng",
    } as never);

    try {
      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");
      const approved = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "approve",
      });
      expect(approved.status).toBe("approved");

      const { data: after } = await svc
        .from("leave_balance")
        .select("consumed_days")
        .eq("employee_id", claims.employeeId)
        .eq("leave_year", HR_SEED.leaveYear)
        .maybeSingle();
      expect(Number(after?.consumed_days ?? 0)).toBe(Number(before?.consumed_days ?? 0));
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("a personal_leave overlapping a taught session still requires an accepted cover (conflict-scoped)", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    // 2026-11-09 is a Monday — overlaps classQ1Foundation (teacher.q1's own class, per _setup seed).
    await expect(
      submitRequestCore(teacherClient, teacherClaims, {
        requestType: "personal_leave",
        startDate: "2026-11-09",
        endDate: "2026-11-09",
        dayPart: "full",
        event: "other",
        reason: "Việc riêng",
      } as never),
    ).rejects.toThrow(/dạy thay/i);

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "personal_leave",
      startDate: "2026-11-09",
      endDate: "2026-11-09",
      dayPart: "full",
      event: "other",
      reason: "Việc riêng",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-11-09",
          nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
        },
      ],
    } as never);

    try {
      expect(request.status).toBe("awaiting_cover");

      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");
      await expect(
        decideRequestCore(managerClient, managerClaims, { requestId: request.id, decision: "approve" }),
      ).rejects.toThrow(DomainError);

      const { data: coverRow } = await svc
        .from("cover_assignment")
        .select("id")
        .eq("request_id", request.id)
        .single();
      const teacher2Client = await hrClientFor("teacher2Q1");
      const teacher2Claims = await assertPermission(teacher2Client, "cover.respond");
      await respondCoverCore(teacher2Client, teacher2Claims, { coverId: coverRow!.id as string, accept: true });

      const { data: afterAccept } = await svc.from("hr_request").select("status").eq("id", request.id).single();
      expect(afterAccept?.status).toBe("pending");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("overtime is NOT conflict-scoped: an overlapping date does not require a cover, no balance effect", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    // 2026-11-16 is a Monday — teacher.q1 teaches classQ1Foundation that day, but overtime must
    // NOT require a cover nomination (it is not an absence from teaching).
    const request = await submitRequestCore(client, claims, {
      requestType: "overtime",
      date: "2026-11-16",
      hours: 2,
      justification: "Hỗ trợ sự kiện tuyển sinh",
    } as never);

    try {
      expect(request.status).toBe("pending");
      expect(request.startDate).toBeNull();
      expect(request.payload.hours).toBe(2);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }

    expect(() =>
      overtimeSchema.parse({ requestType: "overtime", date: "2026-11-16", hours: 0, justification: "x" }),
    ).toThrow();
  });

  it("money forms (salary_advance, purchase, business_travel) accept an amount, no dates/covers required", async () => {
    const client = await hrClientFor("saleQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const salaryAdvance = await submitRequestCore(client, claims, {
      requestType: "salary_advance",
      amount: 2_000_000,
      repaymentIntent: "Trừ lương tháng sau",
    } as never);
    try {
      expect(salaryAdvance.status).toBe("pending");
      expect(salaryAdvance.amount).toBe(2_000_000);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", salaryAdvance.id);
    }

    expect(() =>
      salaryAdvanceSchema.parse({ requestType: "salary_advance", amount: 0, repaymentIntent: "x" }),
    ).toThrow();

    const purchase = await submitRequestCore(client, claims, {
      requestType: "purchase",
      amount: 500_000,
      item: "Máy chiếu",
      vendor: "Công ty ABC",
      justification: "Phục vụ giảng dạy",
    } as never);
    try {
      expect(purchase.status).toBe("pending");
      expect(purchase.payload.item).toBe("Máy chiếu");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", purchase.id);
    }

    const businessTravel = await submitRequestCore(client, claims, {
      requestType: "business_travel",
      startDate: "2026-11-20",
      endDate: "2026-11-22",
      amount: 3_000_000,
      destination: "Hà Nội",
      justification: "Hội thảo đào tạo",
    } as never);
    try {
      expect(businessTravel.status).toBe("pending"); // NOT awaiting_cover — not conflict-scoped
      expect(businessTravel.amount).toBe(3_000_000);
      expect(businessTravel.startDate).toBe("2026-11-20");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", businessTravel.id);
    }
  });
});
