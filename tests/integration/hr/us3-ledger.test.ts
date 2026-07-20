import { describe, it, expect } from "vitest";
import { submitRequestCore } from "@/services/hr-request.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US3 (T024): the ledger's guarded write primitives, called directly via `supabase.rpc(...)` —
 * simulating what the not-yet-built `approve_request`/`decide-request` (US2) will call internally.
 * Proves `consume_leave_balance` draws down `consumed_days` by exactly the request's working-day
 * count, and `restore_leave_balance` restores it — independent of any approve/reject action.
 */
describe("hr US3: ledger consume/restore", () => {
  it("consume_leave_balance draws down consumed_days by the request's working-day count; restore reverses it", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const claims = await assertPermission(teacherClient, "hrRequest.submit");

    // Non-overlapping with any other seeded/probe annual-leave date range for teacher.q1. Thu-Fri
    // (not Mon/Wed) — teacher.q1 teaches Monday/Wednesday sessions (seed), so a Mon/Wed range would
    // now ALSO require a cover nomination (US4), which this test is not exercising.
    const request = await submitRequestCore(teacherClient, claims, {
      requestType: "annual_leave",
      startDate: "2026-10-15",
      endDate: "2026-10-16",
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
      // consume_leave_balance is called by the future approve_request (US2) as the centre_manager
      // deciding the request — simulate that actor here.
      const managerClient = await hrClientFor("managerQ1");
      const consumeResult = await managerClient.rpc("consume_leave_balance", { p_request_id: request.id });
      expect(consumeResult.error).toBeNull();
      expect(Number(consumeResult.data.consumed_days)).toBe(startingConsumed + request.workingDays!);

      const restoreResult = await managerClient.rpc("restore_leave_balance", { p_request_id: request.id });
      expect(restoreResult.error).toBeNull();
      expect(Number(restoreResult.data.consumed_days)).toBe(startingConsumed);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
      await svc
        .from("leave_balance")
        .update({ consumed_days: startingConsumed })
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear);
    }
  });
});
