import { describe, it, expect } from "vitest";
import { submitRequestCore } from "@/services/hr-request.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US3 (T025): two concurrent `consume_leave_balance` calls against the SAME employee/leave-year
 * balance must both land — proving the `SELECT … FOR UPDATE` row lock inside the guarded function
 * serializes the read-modify-write and no update is lost (no double-spend / no lost update).
 */
describe("hr US3: consume_leave_balance no-double-spend", () => {
  it("both concurrent consumptions land — the balance reflects the sum, not just one", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const claims = await assertPermission(teacherClient, "hrRequest.submit");

    // Two distinct, non-overlapping annual-leave requests for the SAME submitter/leave-year.
    const requestA = await submitRequestCore(teacherClient, claims, {
      requestType: "annual_leave",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      dayPart: "full",
    });
    const requestB = await submitRequestCore(teacherClient, claims, {
      requestType: "annual_leave",
      startDate: "2026-10-19",
      endDate: "2026-10-19",
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

      const [resultA, resultB] = await Promise.all([
        managerClient.rpc("consume_leave_balance", { p_request_id: requestA.id }),
        managerClient.rpc("consume_leave_balance", { p_request_id: requestB.id }),
      ]);
      expect(resultA.error).toBeNull();
      expect(resultB.error).toBeNull();

      const { data: after } = await svc
        .from("leave_balance")
        .select("consumed_days")
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear)
        .single();

      expect(Number(after?.consumed_days)).toBe(startingConsumed + requestA.workingDays! + requestB.workingDays!);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", requestA.id);
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", requestB.id);
      await svc
        .from("leave_balance")
        .update({ consumed_days: startingConsumed })
        .eq("employee_id", SEED_EMPLOYEE_TEACHER_Q1)
        .eq("leave_year", HR_SEED.leaveYear);
    }
  });
});
