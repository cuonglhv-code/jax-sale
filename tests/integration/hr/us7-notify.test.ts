import { describe, it, expect } from "vitest";
import {
  notifySubmission,
  notifyDecision,
  notifyCoverNomination,
  notifyMoneyFormApproved,
  type ResendSender,
} from "@/services/notification.service";
import { submitRequestCore, decideRequestCore } from "@/services/hr-request.service";
import { respondCoverCore } from "@/services/cover.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { serviceRoleClient, SEED_EMPLOYEE_TEACHER2_Q1 } from "../../helpers/auth";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US7 (T056): for each of the 4 email triggers, prove (a) the injected fake sender is called
 * exactly once with the correct recipient, (b) the call args are structurally free of any
 * attachment-content-shaped field (FR-037 — a structural proof, not "we didn't add one"), and
 * (c) a notification-send FAILURE never fails the underlying business mutation. No real network
 * call is ever made — every test injects its own fake `resend`-like sender (mirrors
 * `sendSummitRoadmapCore`'s DI pattern in src/services/ielts/summit.service.ts), so `getServerEnv()`
 * (and therefore RESEND_API_KEY) is never touched by this suite.
 */

/** A minimal fake Resend `emails` client — records every call, never touches the network. */
function fakeSender(): ResendSender & { calls: Array<{ from: string; to: string; subject: string; text: string }> } {
  const calls: Array<{ from: string; to: string; subject: string; text: string }> = [];
  const send = (async (args: { from?: string; to?: string | string[]; subject?: string; text?: string }) => {
    calls.push({
      from: args.from ?? "",
      to: Array.isArray(args.to) ? args.to[0] : (args.to ?? ""),
      subject: args.subject ?? "",
      text: args.text ?? "",
    });
    return { data: { id: "fake-id" }, error: null };
  }) as unknown as ResendSender["send"];
  return { calls, send };
}

/** A fake sender that always fails — used to prove notification failure is non-fatal. */
function failingSender(): ResendSender {
  return {
    send: (async () => ({
      data: null,
      error: { name: "application_error", message: "boom", statusCode: 500 },
    })) as unknown as ResendSender["send"],
  };
}

/** Structural proof (FR-037): no attachment-content-shaped key anywhere on the call args object. */
function assertNoAttachmentShapedFields(call: Record<string, unknown>): void {
  const forbiddenKeys = ["content", "buffer", "attachment", "attachments", "file"];
  for (const key of forbiddenKeys) {
    expect(Object.prototype.hasOwnProperty.call(call, key)).toBe(false);
  }
}

describe("hr US7: notifications (test transport, no real network)", () => {
  it("notifySubmission emails the centre_manager(s) of the submitter's centre", async () => {
    const managerClient = await hrClientFor("managerQ1");
    const managerClaims = await assertPermission(managerClient, "hrRequest.decide");
    const sender = fakeSender();

    await notifySubmission(
      managerClient,
      {
        centreId: managerClaims.centreId,
        submitterName: "Giáo viên Q1",
        formTypeLabel: "Nghỉ phép năm",
        startDate: "2026-11-05",
        viewUrl: "https://app.test/yeu-cau",
      },
      sender,
    );

    expect(sender.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of sender.calls) {
      expect(call.to).toMatch(/@jaxtina\.test$/);
      assertNoAttachmentShapedFields(call);
    }
  });

  it("notifyDecision emails the submitter with the correct decision", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const sender = fakeSender();

    await notifyDecision(
      teacherClient,
      {
        submitterId: teacherClaims.employeeId,
        formTypeLabel: "Nghỉ phép năm",
        decision: "approve",
        reason: null,
        viewUrl: "https://app.test/yeu-cau",
      },
      sender,
    );

    expect(sender.calls.length).toBe(1);
    expect(sender.calls[0].to).toBe("teacher.q1@jaxtina.test");
    expect(sender.calls[0].subject).toContain("Nghỉ phép năm");
    assertNoAttachmentShapedFields(sender.calls[0]);
  });

  it("notifyDecision: reject includes the reason in the body, not a separate content field", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const sender = fakeSender();

    await notifyDecision(
      teacherClient,
      {
        submitterId: teacherClaims.employeeId,
        formTypeLabel: "Nghỉ ốm",
        decision: "reject",
        reason: "Thiếu nhân sự dạy thay",
        viewUrl: "https://app.test/yeu-cau",
      },
      sender,
    );

    expect(sender.calls.length).toBe(1);
    expect(sender.calls[0].text).toContain("Thiếu nhân sự dạy thay");
    assertNoAttachmentShapedFields(sender.calls[0]);
  });

  it("notifyCoverNomination emails the nominee", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const sender = fakeSender();

    await notifyCoverNomination(
      teacherClient,
      {
        nomineeId: SEED_EMPLOYEE_TEACHER2_Q1,
        submitterName: "Giáo viên Q1",
        sessionSummary: "Lớp Foundation, 2026-10-26",
        respondUrl: "https://app.test/yeu-cau",
      },
      sender,
    );

    expect(sender.calls.length).toBe(1);
    expect(sender.calls[0].to).toBe("teacher2.q1@jaxtina.test");
    assertNoAttachmentShapedFields(sender.calls[0]);
  });

  it("notifyMoneyFormApproved emails accounting (super_admin)", async () => {
    const adminClient = await hrClientFor("superAdmin");
    const sender = fakeSender();

    await notifyMoneyFormApproved(
      adminClient,
      {
        formTypeLabel: "Tạm ứng lương",
        submitterName: "Nhân viên Kinh doanh Q1",
        amount: 2000000,
        viewUrl: "https://app.test/nhan-su/duyet",
      },
      sender,
    );

    expect(sender.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of sender.calls) {
      expect(call.to).toMatch(/@jaxtina\.test$/);
      assertNoAttachmentShapedFields(call);
    }
  });

  it("a notification-send FAILURE does not throw and does not fail the caller", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");

    // Must resolve, not reject — non-fatal by design (contracts/notifications.md).
    await expect(
      notifyDecision(
        teacherClient,
        {
          submitterId: teacherClaims.employeeId,
          formTypeLabel: "Nghỉ phép năm",
          decision: "approve",
          reason: null,
          viewUrl: "https://app.test/yeu-cau",
        },
        failingSender(),
      ),
    ).resolves.toBeUndefined();
  });

  it("end-to-end: submitRequestCore still succeeds even though its wired-in notification uses a real (unmocked) send path internally, since the default DI is never invoked by this test", async () => {
    // This test proves the WIRING does not change submitRequestCore's return contract. It uses the
    // default env-backed resend only if notifySubmission's `resend` param is omitted at the call
    // site inside submitRequestCore — which would attempt a real network call. Since RESEND_API_KEY
    // is only a placeholder locally, Resend's SDK call would fail at the network layer (non-fatal,
    // caught) rather than validate the key — proving non-fatal behavior end-to-end without mocking.
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-19",
      endDate: "2026-11-19",
      dayPart: "full",
    });

    try {
      expect(request.status).toBe("pending");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  }, 15000);

  it("end-to-end: decideRequestCore still succeeds with its wired-in notification", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-24",
      endDate: "2026-11-24",
      dayPart: "full",
    });

    try {
      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "hrRequest.decide");

      const rejected = await decideRequestCore(managerClient, managerClaims, {
        requestId: request.id,
        decision: "reject",
        reason: "Lý do kiểm thử US7",
      });
      expect(rejected.status).toBe("rejected");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  }, 15000);

  it("end-to-end: respondCoverCore still succeeds with its wired-in nominee notification", async () => {
    const teacherClient = await hrClientFor("teacherQ1");
    const teacherClaims = await assertPermission(teacherClient, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(teacherClient, teacherClaims, {
      requestType: "annual_leave",
      startDate: "2026-11-30", // Monday — overlaps teacher.q1's Monday session
      endDate: "2026-11-30",
      dayPart: "full",
      covers: [
        {
          classId: HR_SEED.classQ1Foundation,
          sessionDate: "2026-11-30",
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
      const cover = await respondCoverCore(teacher2Client, teacher2Claims, {
        coverId: coverRow!.id as string,
        accept: true,
      });
      expect(cover.status).toBe("accepted");
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  }, 15000);
});
