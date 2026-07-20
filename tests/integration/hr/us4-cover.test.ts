import { describe, it, expect } from "vitest";
import { submitRequestCore, decideRequestCore } from "@/services/hr-request.service";
import { respondCoverCore } from "@/services/cover.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError } from "@/lib/server-action";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER2_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US4 (T039): leave overlapping a taught session requires a cover nomination; a same-centre
 * non-conflicting nominee lands the request in `awaiting_cover`; a HARD-conflicted nominee (already
 * teaching at the overlapping session) is rejected at submission (FR-020 — not merely flagged);
 * the nominee accepting moves `awaiting_cover → pending`; `approve_request` still refuses to
 * approve while any cover is unaccepted — proving that guard is now non-vacuous.
 *
 * teacher.q1 teaches classQ1Foundation every MONDAY 18:00-20:00 (seed). teacher2.q1 teaches
 * classQ1Teacher2 every TUESDAY 18:00-20:00 (seed) — free on Mondays, so a valid nominee for a
 * Monday-only leave; but ALSO themselves double-booked if nominated for a Tuesday session.
 */
describe("hr US4: class conflict & cover nomination", () => {
  it("requires a cover nomination when leave overlaps a taught session, with a clear Vietnamese message", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");

    // 2026-09-14 is a Monday — overlaps classQ1Foundation.
    await expect(
      submitRequestCore(teacherClient, teacherClaims, {
        requestType: "annual_leave",
        startDate: "2026-09-14",
        endDate: "2026-09-14",
        dayPart: "full",
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      submitRequestCore(teacherClient, teacherClaims, {
        requestType: "annual_leave",
        startDate: "2026-09-14",
        endDate: "2026-09-14",
        dayPart: "full",
      }),
    ).rejects.toThrow(/dạy thay/i);
  });

  it("accepts a same-centre non-conflicting nominee and lands the request in awaiting_cover", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-09-14", // Monday — overlaps classQ1Foundation
      endDate: "2026-09-14",
      dayPart: "full",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-09-14",
          nomineeId: SEED_EMPLOYEE_TEACHER2_Q1, // free on Mondays
        },
      ],
    });

    try {
      expect(request.status).toBe("awaiting_cover");

      const { data: covers } = await svc
        .from("cover_assignment")
        .select("*")
        .eq("request_id", request.id);
      expect(covers).toHaveLength(1);
      expect(covers?.[0].status).toBe("nominated");
      expect(covers?.[0].nominee_id).toBe(SEED_EMPLOYEE_TEACHER2_Q1);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("HARD-BLOCKS nomination of a teacher who is themselves teaching at the overlapping session (FR-020)", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    // teacherQ1 submits annual leave for MONDAY 2026-09-14 (their own classQ1Foundation session)
    // and nominates teacher2.q1 — who is free on Mondays — but the cover payload names teacher2's
    // OWN Tuesday class (classQ1Teacher2) as the covered class/session. The service must re-run the
    // resolver against the NOMINEE (teacher2.q1) for that exact class/session (not just trust the
    // caller's claim) and find teacher2.q1 teaching there themselves — a hard conflict (FR-020) that
    // blocks the nomination regardless of which session the submitter is actually on leave for.
    await expect(
      submitRequestCore(teacherClient, teacherClaims, {
        requestType: "annual_leave",
        startDate: "2026-09-14",
        endDate: "2026-09-14",
        dayPart: "full",
        covers: [
          {
            classId: HR_SEED.classQ1Teacher2,
            sessionDate: "2026-09-15", // Tuesday — teacher2.q1's own class
            nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
          },
        ],
      }),
    ).rejects.toThrow(DomainError);

    // Confirm nothing was created (the request must not exist with that nominee).
    const { data: leftover } = await svc
      .from("hr_request")
      .select("id")
      .eq("submitter_id", teacherClaims.employeeId)
      .eq("start_date", "2026-09-14")
      .eq("status", "awaiting_cover");
    expect(leftover ?? []).toHaveLength(0);
  });

  it("nominee accepting moves awaiting_cover -> pending; approve is gated until then", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-09-21", // Monday
      endDate: "2026-09-21",
      dayPart: "full",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-09-21",
          nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
        },
      ],
    });

    try {
      expect(request.status).toBe("awaiting_cover");

      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");

      // Approval must be refused while the cover is unaccepted (proves the existing
      // approve_request guard is now exercised for real, not vacuously true).
      await expect(
        decideRequestCore(managerClient, managerClaims, { requestId: request.id, decision: "approve" }),
      ).rejects.toThrow(DomainError);

      const { data: stillAwaiting } = await svc.from("hr_request").select("status").eq("id", request.id).single();
      expect(stillAwaiting?.status).toBe("awaiting_cover");

      const { data: coverRow } = await svc
        .from("cover_assignment")
        .select("id")
        .eq("request_id", request.id)
        .single();

      const teacher2Client = await hrClientFor("teacher2Q1");
      const teacher2Claims = await assertPermission(teacher2Client, "cover.respond");
      const accepted = await respondCoverCore(teacher2Client, teacher2Claims, {
        coverId: coverRow!.id as string,
        accept: true,
      });
      expect(accepted.status).toBe("accepted");

      const { data: afterAccept } = await svc.from("hr_request").select("status").eq("id", request.id).single();
      expect(afterAccept?.status).toBe("pending");

      // Now approval succeeds.
      const approved = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "approve",
      });
      expect(approved.status).toBe("approved");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });

  it("shift_swap (T044) uses the SAME cover mechanism standalone — no leave date range, no balance effect", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "shift_swap",
      note: "Xin đổi ca thứ Hai tuần này",
      cover: {
        classId: HR_SEED.classQ1Foundation,
        sessionDate: "2026-12-07", // Monday
        nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
      },
    });

    try {
      expect(request.status).toBe("awaiting_cover");
      expect(request.startDate).toBeNull();
      expect(request.workingDays).toBeNull();

      const { data: covers } = await svc.from("cover_assignment").select("*").eq("request_id", request.id);
      expect(covers).toHaveLength(1);
      expect(covers?.[0].nominee_id).toBe(SEED_EMPLOYEE_TEACHER2_Q1);

      const teacher2Client = await hrClientFor("teacher2Q1");
      const teacher2Claims = await assertPermission(teacher2Client, "cover.respond");
      await respondCoverCore(teacher2Client, teacher2Claims, { coverId: covers![0].id as string, accept: true });

      const { data: afterAccept } = await svc.from("hr_request").select("status").eq("id", request.id).single();
      expect(afterAccept?.status).toBe("pending");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });
});
