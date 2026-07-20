import { describe, it, expect } from "vitest";
import { submitRequestCore, decideRequestCore } from "@/services/hr-request.service";
import { respondCoverCore } from "@/services/cover.service";
import { upsertClassCore } from "@/services/class.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER2_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US4 (T039a): a cover declined AFTER the owning request was approved, and a class deactivated
 * after its cover was arranged, must each release the cover (`status='released'`) and flag the
 * OWNING request for re-resolution (marker: `hr_request.needs_reresolution boolean`, see the
 * migration's rationale) — never leave a silently-broken approved leave (FR-022, edge case).
 */
describe("hr US4: post-approval cover re-resolution", () => {
  it("a cover declined AFTER approval releases the cover and flags the request for re-resolution", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    // Tuesday — overlaps teacher.q1's session ONLY if we submit for a Monday/Wednesday; use Monday
    // (classQ1Foundation) so a cover is required.
    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-10-26", // Monday
      endDate: "2026-10-26",
      dayPart: "full",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-10-26",
          nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
        },
      ],
    });

    try {
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

      // Now the accepted cover DECLINES post-approval (e.g. the teacher retracts availability) —
      // respond_cover routes a decline of an ALREADY-ACCEPTED cover through release_cover_and_flag
      // rather than a plain 'declined' flip (FR-022): a declined cover on an APPROVED request must
      // not be left looking like an ordinary pre-approval decline (which would imply the submitter
      // simply re-nominates) — it is explicitly RELEASED and the owning request flagged, since the
      // leave is already approved and needs a human to re-resolve cover, not a routine re-nomination.
      const released = await respondCoverCore(teacher2Client, teacher2Claims, {
        coverId: coverRow!.id as string,
        accept: false,
      });
      expect(released.status).toBe("released");

      const { data: coverAfter } = await svc
        .from("cover_assignment")
        .select("status")
        .eq("id", coverRow!.id as string)
        .single();
      expect(coverAfter?.status).toBe("released");

      const { data: requestAfter } = await svc
        .from("hr_request")
        .select("needs_reresolution, status")
        .eq("id", request.id)
        .single();
      expect(requestAfter?.needs_reresolution).toBe(true);
      // The approved leave itself is NOT silently reverted — it stays approved but flagged, so a
      // human (manager/submitter) must re-resolve cover, per FR-022's "flag for re-resolution".
      expect(requestAfter?.status).toBe("approved");

      const audits = await svc
        .from("audit_log")
        .select("*")
        .eq("entity_id", coverRow!.id as string)
        .eq("action", "cover.release");
      expect(audits.data?.length).toBeGreaterThanOrEqual(1);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("deactivating a class releases accepted covers on approved requests and flags them for re-resolution", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-23", // Monday
      endDate: "2026-11-23",
      dayPart: "full",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-11-23",
          nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
        },
      ],
    });

    try {
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
      await decideRequestCore(managerClient, managerClaims, { requestId: request.id, decision: "approve" });

      // Fetch the current class row so we can restore it after the test (deactivating is a
      // destructive-looking edit to shared seed data — restore in `finally`).
      const { data: classBefore } = await svc.from("class").select("*").eq("id", HR_SEED.classQ1Foundation).single();

      const managerTimetableClaims = await assertPermission(managerClient, "timetable.manage");
      await upsertClassCore(managerClient, managerTimetableClaims, {
        id: HR_SEED.classQ1Foundation,
        courseLabel: classBefore!.course_label as string,
        teacherId: classBefore!.teacher_id as string,
        weekday: classBefore!.weekday as number,
        startTime: (classBefore!.start_time as string).slice(0, 5),
        endTime: (classBefore!.end_time as string).slice(0, 5),
        startDate: classBefore!.start_date as string,
        endDate: classBefore!.end_date as string,
        isActive: false,
      });

      try {
        const { data: coverAfter } = await svc
          .from("cover_assignment")
          .select("status")
          .eq("id", coverRow!.id as string)
          .single();
        expect(coverAfter?.status).toBe("released");

        const { data: requestAfter } = await svc
          .from("hr_request")
          .select("needs_reresolution")
          .eq("id", request.id)
          .single();
        expect(requestAfter?.needs_reresolution).toBe(true);
      } finally {
        // Restore the class to active so other tests relying on classQ1Foundation are unaffected.
        await svc.from("class").update({ is_active: true }).eq("id", HR_SEED.classQ1Foundation);
      }
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });
});
