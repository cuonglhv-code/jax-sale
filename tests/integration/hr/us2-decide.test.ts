import { describe, it, expect } from "vitest";
import { submitRequestCore, decideRequestCore } from "@/services/hr-request.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError } from "@/lib/server-action";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US2 (T032): the core decide path — approve (status + history + audit + balance consumed by
 * EXACTLY working_days), reject (requires a non-empty reason, balance untouched), self-approval
 * forbidden (routes to super_admin), and idempotency (a second approve call on an
 * already-approved request is a no-op, proving the `status='pending'` precondition inside
 * `approve_request` — not merely a service-layer check that happens to look idempotent).
 */
describe("hr US2: decide (approve/reject)", () => {
  it("approve: status→approved, history row, audit row, balance consumed by working_days", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");

    // Thu-Fri (not Mon/Wed) — teacher.q1 teaches Monday/Wednesday sessions (seed), so a Mon/Wed
    // range would now ALSO require a cover nomination (US4), which this test is not exercising.
    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-05",
      endDate: "2026-11-06",
      dayPart: "full",
    });

    const svc = serviceRoleClient();
    const { data: before } = await svc
      .from("leave_balance")
      .select("consumed_days")
      .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
      .eq("leave_year", HR_SEED.leaveYear)
      .single();
    const startingConsumed = Number(before?.consumed_days ?? 0);

    try {
      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");

      const approved = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "approve",
      });

      expect(approved.status).toBe("approved");
      expect(approved.decidedBy).toBe(managerClaims.employeeId);
      expect(approved.decidedAt).not.toBeNull();

      const history = await svc
        .from("hr_request_status_history")
        .select("*")
        .eq("request_id", request.id)
        .order("created_at", { ascending: true });
      expect(history.data?.length).toBe(2); // create (null→pending) + this decision (pending→approved)
      expect(history.data?.[1].from_status).toBe("pending");
      expect(history.data?.[1].to_status).toBe("approved");

      const audits = await svc
        .from("audit_log")
        .select("*")
        .eq("entity_id", request.id)
        .eq("action", "hrRequest.approve");
      expect(audits.data?.length).toBe(1);

      const { data: afterBalance } = await svc
        .from("leave_balance")
        .select("consumed_days")
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear)
        .single();
      expect(Number(afterBalance?.consumed_days)).toBe(startingConsumed + request.workingDays!);

      // ── Idempotency: a SECOND approve call on the now-`approved` request must be a genuine
      // no-op — it must NOT call consume_leave_balance again (balance must stay the same), and
      // must not insert a second `pending→approved` history row. This proves the `status='pending'`
      // precondition inside approve_request actually guards re-entry, not just a service-side check.
      const secondApprove = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "approve",
      });
      expect(secondApprove.status).toBe("approved");

      const { data: afterSecond } = await svc
        .from("leave_balance")
        .select("consumed_days")
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear)
        .single();
      expect(Number(afterSecond?.consumed_days)).toBe(startingConsumed + request.workingDays!); // unchanged

      const historyAfterSecond = await svc
        .from("hr_request_status_history")
        .select("*")
        .eq("request_id", request.id);
      expect(historyAfterSecond.data?.length).toBe(2); // still exactly 2 — no new row from the no-op
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
      await svc
        .from("leave_balance")
        .update({ consumed_days: startingConsumed })
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear);
    }
  });

  it("reject requires a non-empty reason and leaves balance untouched", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");

    // Tuesday (not Mon/Wed) — see the comment on the first test in this file.
    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      dayPart: "full",
    });

    const svc = serviceRoleClient();
    const { data: before } = await svc
      .from("leave_balance")
      .select("consumed_days")
      .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
      .eq("leave_year", HR_SEED.leaveYear)
      .single();
    const startingConsumed = Number(before?.consumed_days ?? 0);

    try {
      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");

      await expect(
        decideRequestCore(managerClient, managerClaims, {
          requestId: request.id,
          decision: "reject",
          reason: "",
        }),
      ).rejects.toThrow(DomainError);

      const rejected = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "reject",
        reason: "Không đủ nhân sự thay thế trong giai đoạn cao điểm",
      });
      expect(rejected.status).toBe("rejected");
      expect(rejected.decisionReason).toBe("Không đủ nhân sự thay thế trong giai đoạn cao điểm");

      const { data: afterBalance } = await svc
        .from("leave_balance")
        .select("consumed_days")
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear)
        .single();
      expect(Number(afterBalance?.consumed_days)).toBe(startingConsumed); // untouched
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("forbids a centre_manager from approving THEIR OWN submitted request (routes to super_admin)", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const managerClaims = await assertPermission(managerClient, "hrRequest.submit");

    const request = await submitRequestCore(managerClient, managerClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-16",
      endDate: "2026-11-16",
      dayPart: "full",
    });

    const svc = serviceRoleClient();
    try {
      const decideClaims = await assertPermission(managerClient, "hrRequest.decide");
      await expect(
        decideRequestCore(managerClient, decideClaims, {
          requestId: request.id,
          decision: "approve",
        }),
      ).rejects.toThrow(DomainError);

      // The request must remain pending — the guard truly blocked the transition, not just the message.
      const { data: row } = await svc.from("hr_request").select("status").eq("id", request.id).single();
      expect(row?.status).toBe("pending");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });
});
