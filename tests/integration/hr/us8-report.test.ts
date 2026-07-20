import { describe, it, expect } from "vitest";
import {
  listLeaveByEmployeeCore,
  listRequestsByTypeStatusCore,
  listOutstandingBalancesCore,
  getCoverageViewCore,
} from "@/services/hr-report.service";
import { submitRequestCore, decideRequestCore } from "@/services/hr-request.service";
import { respondCoverCore } from "@/services/cover.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER2_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US8 (T060, SC-007, contracts/config-balance.actions.md "Reporting"): leave-by-employee/centre/
 * period, requests by type & status, outstanding balances, and the coverage view — all role-scoped,
 * paginated, and NEVER carrying medical-document content (only `hasAttachment`).
 *
 * Reuses seed fixtures (HR_SEED.requestAnnualLeave = teacher.q1, centre Q1, pending) for the
 * type/status + balance aggregations. The coverage view needs a genuine approved leave request with
 * an ACCEPTED cover_assignment — no such fixture is seeded (seed.sql only seeds pending requests, no
 * cover_assignment rows — see tests/integration/hr/us4-cover.test.ts's own setup pattern), so this
 * test builds one end-to-end: teacher.q1 submits annual leave overlapping their own taught session
 * (classQ1Foundation, Monday), nominates teacher2.q1 (free that day), teacher2.q1 accepts, then
 * manager.q1 approves — landing a real "who is off / who is covering" row.
 */
describe("hr US8: reporting (SC-007)", () => {
  it("centre_manager sees only their own centre's leave-by-employee report; super_admin sees network-wide", async () => {
    // Narrowed to the seeded request's own [2026-08-10, 2026-08-11] window (period filter — a
    // realistic report usage) so this assertion is immune to OTHER tests in the same suite run
    // creating/cancelling unrelated Q1 leave-family requests with later dates, which would otherwise
    // push the seeded row past the default page size under `start_date desc` ordering.
    const period = { startDate: "2026-08-10", endDate: "2026-08-11" };

    const managerQ1Client = await hrClientFor("managerQ1");
    const managerQ1Claims = await assertPermission(managerQ1Client, "hrReport.view");

    const q1Report = await listLeaveByEmployeeCore(managerQ1Client, managerQ1Claims, period);
    expect(q1Report.rows.every((row) => row.centreId === managerQ1Claims.centreId)).toBe(true);
    expect(q1Report.rows.some((row) => row.requestId === HR_SEED.requestAnnualLeave)).toBe(true);

    const managerQ3Client = await hrClientFor("managerQ3");
    const managerQ3Claims = await assertPermission(managerQ3Client, "hrReport.view");
    const q3Report = await listLeaveByEmployeeCore(managerQ3Client, managerQ3Claims, period);
    expect(q3Report.rows.some((row) => row.requestId === HR_SEED.requestAnnualLeave)).toBe(false);

    // super_admin's network-wide report must at least include the Q1 row a Q1 manager can see AND
    // that a Q3 manager (proven above) cannot — i.e. its scope is strictly broader than either
    // single-centre manager's, which is the network-wide behaviour under test.
    const adminClient = await hrClientFor("superAdmin");
    const adminClaims = await assertPermission(adminClient, "hrReport.view");
    const networkReport = await listLeaveByEmployeeCore(adminClient, adminClaims, period);
    expect(networkReport.rows.some((row) => row.requestId === HR_SEED.requestAnnualLeave)).toBe(true);
    expect(networkReport.total).toBeGreaterThanOrEqual(q1Report.total);
  });

  it("requests-by-type/status aggregation returns sane, correctly-scoped counts", async () => {
    const managerQ1Client = await hrClientFor("managerQ1");
    const managerQ1Claims = await assertPermission(managerQ1Client, "hrReport.view");

    const summary = await listRequestsByTypeStatusCore(managerQ1Client, managerQ1Claims, {});
    const annualPending = summary.find((row) => row.requestType === "annual_leave" && row.status === "pending");
    expect(annualPending).toBeDefined();
    expect(annualPending!.count).toBeGreaterThanOrEqual(1);
    // Every row must be scoped to Q1 only — verify by cross-checking against a raw scoped count.
    const svc = serviceRoleClient();
    const { count } = await svc
      .from("hr_request")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", managerQ1Claims.centreId)
      .eq("request_type", "annual_leave")
      .eq("status", "pending");
    expect(annualPending!.count).toBe(count);
  });

  it("outstanding-balances aggregation returns each in-scope employee's entitlement/consumed/remaining", async () => {
    const managerQ1Client = await hrClientFor("managerQ1");
    const managerQ1Claims = await assertPermission(managerQ1Client, "hrReport.view");

    const balances = await listOutstandingBalancesCore(managerQ1Client, managerQ1Claims, { leaveYear: HR_SEED.leaveYear });
    expect(balances.rows.length).toBeGreaterThan(0);
    for (const row of balances.rows) {
      expect(row.remainingDays).toBe(row.entitlementDays + row.openingAdjustmentDays - row.consumedDays);
    }
  });

  it("a non-manager/non-super_admin role is rejected from every report action (hrReport.view)", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    await expect(assertPermission(teacherClient, "hrReport.view")).rejects.toThrow(ForbiddenError);

    const saleClient = await hrClientFor("saleQ1");
    await expect(assertPermission(saleClient, "hrReport.view")).rejects.toThrow(ForbiddenError);
  });

  it("the coverage view answers 'who is off and who is covering' for a real approved+accepted-cover request", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    // 2026-10-05 is a Monday — overlaps classQ1Foundation (teacher.q1's own class); within the
    // seeded 2026 leave_policy_config year (US8's own fixture, distinct from other US4 test dates).
    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      dayPart: "full",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-10-05",
          nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
        },
      ],
    });

    try {
      expect(request.status).toBe("awaiting_cover");

      const { data: coverRow } = await svc
        .from("cover_assignment")
        .select("id")
        .eq("request_id", request.id)
        .single();

      const teacher2Client = await hrClientFor("teacher2Q1");
      const teacher2Claims = await assertPermission(teacher2Client, "cover.respond");
      await respondCoverCore(teacher2Client, teacher2Claims, { coverId: coverRow!.id as string, accept: true });

      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");
      const approved = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "approve",
      });
      expect(approved.status).toBe("approved");

      const reportManagerClaims = await assertPermission(managerClient, "hrReport.view");
      const coverage = await getCoverageViewCore(managerClient, reportManagerClaims, {
        startDate: "2026-10-05",
        endDate: "2026-10-05",
      });

      const row = coverage.rows.find((r) => r.requestId === request.id);
      expect(row).toBeDefined();
      expect(row!.offEmployeeId).toBe(teacherClaims.employeeId);
      expect(row!.coveringEmployeeId).toBe(SEED_EMPLOYEE_TEACHER2_Q1);
      expect(row!.sessionDate).toBe("2026-10-05");
      expect(row!.classId).toBe(HR_SEED.classQ1Foundation);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("NEVER exposes medical-document content in any report row — only hasAttachment", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const managerClaims = await assertPermission(managerClient, "hrReport.view");

    const leaveReport = await listLeaveByEmployeeCore(managerClient, managerClaims, {});
    const serialized = JSON.stringify(leaveReport);
    expect(serialized).not.toContain("storage_path");
    expect(serialized).not.toContain("storagePath");
    expect(serialized).not.toMatch(/mime_type|mimeType/);

    const coverage = await getCoverageViewCore(managerClient, managerClaims, {
      startDate: "2020-01-01",
      endDate: "2030-01-01",
    });
    const coverageSerialized = JSON.stringify(coverage);
    expect(coverageSerialized).not.toContain("storage_path");
    expect(coverageSerialized).not.toContain("storagePath");
  });
});
