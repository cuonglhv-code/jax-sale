import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";
import {
  submissionNotifySubject,
  submissionNotifyBody,
  decisionNotifySubject,
  decisionNotifyBody,
  coverNominationNotifySubject,
  coverNominationNotifyBody,
  moneyFormApprovedNotifySubject,
  moneyFormApprovedNotifyBody,
  pendingReminderNotifySubject,
  pendingReminderNotifyBody,
  type SubmissionNotifyProps,
  type DecisionNotifyProps,
  type CoverNominationNotifyProps,
  type MoneyFormApprovedNotifyProps,
  type PendingReminderNotifyProps,
} from "@/emails/hr-notifications";

/**
 * US7 (T058, contracts/notifications.md, research R6): Vietnamese transactional email, one
 * function per trigger. Mirrors `sendSummitRoadmapCore`'s injected-Resend DI pattern EXACTLY
 * (`src/services/ielts/summit.service.ts`) — an optional `resend`-like param defaulting to
 * `new Resend(getServerEnv().RESEND_API_KEY).emails`. Because JS default parameters are lazy, a
 * test that passes its OWN fake `{ send: async () => ... }` never triggers `getServerEnv()`, so no
 * real API key or network call is needed to test these functions.
 *
 * THE ONE DELIBERATE DIFFERENCE from summit: summit's email failure is FATAL BY DESIGN (sending IS
 * the point of that action). HR notifications are the OPPOSITE — every function here is wrapped in
 * its own try/catch that logs and NEVER rethrows, so a failed notification never fails the
 * business mutation that triggered it (contracts/notifications.md: "a failed email must not fail
 * the business decision").
 */

export type ResendSender = Pick<Resend["emails"], "send">;

function defaultResend(): ResendSender {
  return new Resend(getServerEnv().RESEND_API_KEY).emails;
}

const FROM_ADDRESS = "Jaxtina HR <hr@jaxtina.test>";

/** Shared send + non-fatal error swallow — every trigger function below routes through this. */
async function sendNonFatal(
  resend: ResendSender,
  to: string,
  subject: string,
  text: string,
  logLabel: string,
): Promise<void> {
  try {
    const result = await resend.send({ from: FROM_ADDRESS, to, subject, text });
    if (result.error) {
      console.error(`[notification] ${logLabel} send failed`, result.error);
    }
  } catch (err) {
    console.error(`[notification] ${logLabel} threw`, err);
  }
}

/**
 * Wraps an entire trigger function (recipient resolution + sends) so a failure anywhere — not just
 * inside `sendNonFatal` — never propagates to the caller. The single place "notifications never
 * throw" is enforced, instead of each exported function repeating its own try/catch.
 */
async function notifyNonFatal(logLabel: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[notification] ${logLabel} failed to resolve recipients`, err);
  }
}

interface EmployeeContactRow {
  id: string;
  full_name: string;
  email: string;
}

/** Active centre_manager(s) of a centre — the "approver(s)" recipient set (contracts/notifications.md). */
async function getCentreManagers(supabase: SupabaseClient, centreId: string): Promise<EmployeeContactRow[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, email")
    .eq("centre_id", centreId)
    .eq("app_role", "centre_manager")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as EmployeeContactRow[];
}

/** Active super_admin(s) — stands in for "accounting" in v1 (contracts/notifications.md). */
async function getSuperAdmins(supabase: SupabaseClient): Promise<EmployeeContactRow[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, email")
    .eq("app_role", "super_admin")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as EmployeeContactRow[];
}

/** Exported for reuse by hr-request.service.ts (`getEmployeeName`) — one `employees`-by-id query, not two. */
export async function getEmployeeContact(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<EmployeeContactRow | null> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, email")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) throw error;
  return data as EmployeeContactRow | null;
}

/**
 * Trigger: request submitted. Recipient: centre_manager(s) of the submitter's centre
 * (contracts/notifications.md — NOT super_admin for this trigger).
 */
export async function notifySubmission(
  supabase: SupabaseClient,
  params: { centreId: string; submitterName: string; formTypeLabel: string; startDate: string | null; viewUrl: string },
  resend: ResendSender = defaultResend(),
): Promise<void> {
  await notifyNonFatal("notifySubmission", async () => {
    const managers = await getCentreManagers(supabase, params.centreId);
    await Promise.all(
      managers.map((manager) => {
        const props: SubmissionNotifyProps = {
          approverName: manager.full_name,
          submitterName: params.submitterName,
          formTypeLabel: params.formTypeLabel,
          startDate: params.startDate,
          viewUrl: params.viewUrl,
        };
        return sendNonFatal(
          resend,
          manager.email,
          submissionNotifySubject(props),
          submissionNotifyBody(props),
          "hrRequest.submit",
        );
      }),
    );
  });
}

/** Trigger: decision made. Recipient: the submitter. */
export async function notifyDecision(
  supabase: SupabaseClient,
  params: {
    submitterId: string;
    formTypeLabel: string;
    decision: "approve" | "reject";
    reason: string | null;
    viewUrl: string;
  },
  resend: ResendSender = defaultResend(),
): Promise<void> {
  await notifyNonFatal("notifyDecision", async () => {
    const submitter = await getEmployeeContact(supabase, params.submitterId);
    if (!submitter) return;
    const props: DecisionNotifyProps = {
      submitterName: submitter.full_name,
      formTypeLabel: params.formTypeLabel,
      decision: params.decision,
      reason: params.reason,
      viewUrl: params.viewUrl,
    };
    await sendNonFatal(
      resend,
      submitter.email,
      decisionNotifySubject(props),
      decisionNotifyBody(props),
      "hrRequest.decide",
    );
  });
}

/** Trigger: cover nominated. Recipient: the nominee. */
export async function notifyCoverNomination(
  supabase: SupabaseClient,
  params: { nomineeId: string; submitterName: string; sessionSummary: string; respondUrl: string },
  resend: ResendSender = defaultResend(),
): Promise<void> {
  await notifyNonFatal("notifyCoverNomination", async () => {
    const nominee = await getEmployeeContact(supabase, params.nomineeId);
    if (!nominee) return;
    const props: CoverNominationNotifyProps = {
      nomineeName: nominee.full_name,
      submitterName: params.submitterName,
      sessionSummary: params.sessionSummary,
      respondUrl: params.respondUrl,
    };
    await sendNonFatal(
      resend,
      nominee.email,
      coverNominationNotifySubject(),
      coverNominationNotifyBody(props),
      "cover.nominate",
    );
  });
}

/** Trigger: a money form is approved. Recipient: accounting (super_admin, v1). */
export async function notifyMoneyFormApproved(
  supabase: SupabaseClient,
  params: { formTypeLabel: string; submitterName: string; amount: number | null; viewUrl: string },
  resend: ResendSender = defaultResend(),
): Promise<void> {
  await notifyNonFatal("notifyMoneyFormApproved", async () => {
    const admins = await getSuperAdmins(supabase);
    await Promise.all(
      admins.map((admin) => {
        const props: MoneyFormApprovedNotifyProps = {
          formTypeLabel: params.formTypeLabel,
          submitterName: params.submitterName,
          amount: params.amount,
          viewUrl: params.viewUrl,
        };
        return sendNonFatal(
          resend,
          admin.email,
          moneyFormApprovedNotifySubject(props),
          moneyFormApprovedNotifyBody(props),
          "hrRequest.moneyFormApproved",
        );
      }),
    );
  });
}

/** Cron trigger: pending-request reminder digest. Recipient: a centre's approver(s). */
export async function notifyPendingReminder(
  supabase: SupabaseClient,
  params: { centreId: string; pendingCount: number; queueUrl: string },
  resend: ResendSender = defaultResend(),
): Promise<void> {
  await notifyNonFatal("notifyPendingReminder", async () => {
    const managers = await getCentreManagers(supabase, params.centreId);
    await Promise.all(
      managers.map((manager) => {
        const props: PendingReminderNotifyProps = {
          approverName: manager.full_name,
          pendingCount: params.pendingCount,
          queueUrl: params.queueUrl,
        };
        return sendNonFatal(
          resend,
          manager.email,
          pendingReminderNotifySubject(),
          pendingReminderNotifyBody(props),
          "hrRequest.pendingReminder",
        );
      }),
    );
  });
}
