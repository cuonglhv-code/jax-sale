import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, HrRequest, LeaveDayPart } from "@/lib/data/types";
import type { AnnualLeaveInput } from "@/schemas/hr/submit";
import type { DecideRequestInput } from "@/schemas/hr/decide";
import { countWorkingDays } from "@/lib/hr/working-days";
import { DomainError } from "@/lib/server-action";

/** Non-terminal statuses that still hold a live date range against the ledger/timetable (§9). */
const NON_TERMINAL_STATUSES = ["pending", "awaiting_cover", "approved"] as const;

interface RawHrRequestRow {
  id: string;
  request_type: string;
  submitter_id: string;
  centre_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  day_part: string | null;
  working_days: number | string | null;
  amount: number | string | null;
  payload: Record<string, unknown>;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  supersedes_id: string | null;
  created_at: string;
}

function toHrRequest(row: RawHrRequestRow): HrRequest {
  return {
    id: row.id,
    requestType: row.request_type as HrRequest["requestType"],
    submitterId: row.submitter_id,
    centreId: row.centre_id,
    status: row.status as HrRequest["status"],
    startDate: row.start_date,
    endDate: row.end_date,
    dayPart: row.day_part as LeaveDayPart | null,
    workingDays: row.working_days === null ? null : Number(row.working_days),
    amount: row.amount === null ? null : Number(row.amount),
    payload: row.payload ?? {},
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    supersedesId: row.supersedes_id,
    createdAt: row.created_at,
  };
}

/**
 * T020a: reject a submission whose [startDate, endDate] overlaps the submitter's OWN non-terminal
 * request. Generic over request type (any row carrying dates counts as "leave-family" for this
 * purpose) so it applies unchanged once sick/personal/unpaid leave register in US5 — no per-type
 * special-casing needed here.
 */
async function assertNoSelfOverlap(
  supabase: SupabaseClient,
  claims: Claims,
  startDate: string,
  endDate: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("hr_request")
    .select("id")
    .eq("submitter_id", claims.employeeId)
    .in("status", NON_TERMINAL_STATUSES)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) {
    throw new DomainError(
      "Bạn đã có một yêu cầu nghỉ khác trùng thời gian này. Vui lòng chọn khoảng thời gian khác.",
    );
  }
}

/**
 * INDICATIVE working-day count at submit time (display + audit trail only — US3 recomputes
 * authoritatively at approval, per plan). Reads the leave year's policy (working week) + the
 * network-wide holiday calendar, both broad-read (Pattern B RLS).
 */
async function computeIndicativeWorkingDays(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  dayPart: LeaveDayPart,
): Promise<number> {
  const leaveYear = Number(startDate.slice(0, 4));

  const { data: policy, error: policyError } = await supabase
    .from("leave_policy_config")
    .select("working_week")
    .eq("leave_year", leaveYear)
    .maybeSingle();
  if (policyError) throw policyError;
  if (!policy) {
    throw new DomainError(`Chưa cấu hình chính sách nghỉ phép cho năm ${leaveYear}.`);
  }

  const { data: holidays, error: holidayError } = await supabase.from("public_holiday").select("holiday_date");
  if (holidayError) throw holidayError;

  return countWorkingDays({
    start: startDate,
    end: endDate,
    workingWeek: policy.working_week as number[],
    holidays: (holidays ?? []).map((h) => h.holiday_date as string),
    dayPart,
  });
}

/** T029: `submitRequestCore`'s return, extended with an indicative over-balance flag (annual_leave only). */
export interface SubmitRequestResult extends HrRequest {
  /**
   * True when this leave request's working-day count exceeds the submitter's CURRENT indicative
   * remaining balance (entitlement + opening adjustment − consumed) at submit time. Display-only —
   * never blocks submission (data-model §10: "warn if over"); the authoritative check happens again
   * at approval time via a fresh recompute (US2). Always false when no balance row exists yet.
   */
  overBalanceWarning: boolean;
}

/**
 * FR-002/015/024g (US1): submit annual leave through the single-engine pipeline. Centre + submitter
 * are taken from `claims` INSIDE the `create_hr_request_with_log` RPC (never from `input`), so
 * nothing in `input` can cross a centre boundary or submit on someone else's behalf.
 */
export async function submitRequestCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: AnnualLeaveInput,
): Promise<SubmitRequestResult> {
  await assertNoSelfOverlap(supabase, claims, input.startDate, input.endDate);
  const workingDays = await computeIndicativeWorkingDays(supabase, input.startDate, input.endDate, input.dayPart);

  const { data, error } = await supabase.rpc("create_hr_request_with_log", {
    p_request_type: input.requestType,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_day_part: input.dayPart,
    p_working_days: workingDays,
    p_amount: null,
    p_payload: input.note ? { note: input.note } : {},
  });

  if (error) throw new DomainError(error.message);
  const request = toHrRequest(data as RawHrRequestRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "hrRequest.submit",
    p_entity_type: "hr_request",
    p_entity_id: request.id,
    p_metadata: { requestType: request.requestType },
  });
  if (auditError) {
    // Accepted trade-off (constitution §6): only an audit-log gap risks here, never corrupted
    // business data — log server-side, don't fail the whole submit.
    console.error("[audit] hrRequest.submit failed to log", auditError);
  }

  // T029: over-balance warning — indicative only, read AFTER creation so it never blocks the write.
  const leaveYear = Number(input.startDate.slice(0, 4));
  const balance = await getIndicativeAnnualBalanceCore(supabase, claims.employeeId, leaveYear);
  const overBalanceWarning = balance !== null && workingDays > balance.remainingDays;

  return { ...request, overBalanceWarning };
}

/** "My requests" list (US1 acceptance: a submitted request appears here) — own-submitter scoped. */
export async function listMyRequestsCore(supabase: SupabaseClient, claims: Claims): Promise<HrRequest[]> {
  const { data, error } = await supabase
    .from("hr_request")
    .select(
      "id, request_type, submitter_id, centre_id, status, start_date, end_date, day_part, working_days, amount, payload, decided_by, decided_at, decision_reason, supersedes_id, created_at",
    )
    .eq("submitter_id", claims.employeeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as RawHrRequestRow[]).map(toHrRequest);
}

/**
 * US2 (T035): the manager's approval queue — requests awaiting a decision
 * (`pending`/`awaiting_cover`), soonest-start first (nulls last, for non-date request types).
 * `centre_manager` is scoped to their own centre (both by this explicit `.eq` AND the RLS
 * `hr_request_select_scoped` policy — belt and suspenders, consistent with the restricted-read
 * precedent, data-model §12); `super_admin` sees network-wide, matching their broader RLS read
 * scope (no centre-switcher UI exists yet for this slice — out of scope here).
 */
export async function listApprovalQueueCore(supabase: SupabaseClient, claims: Claims): Promise<HrRequest[]> {
  let query = supabase
    .from("hr_request")
    .select(
      "id, request_type, submitter_id, centre_id, status, start_date, end_date, day_part, working_days, amount, payload, decided_by, decided_at, decision_reason, supersedes_id, created_at",
    )
    .in("status", ["pending", "awaiting_cover"])
    .order("start_date", { ascending: true, nullsFirst: false });

  if (claims.role !== "super_admin") {
    query = query.eq("centre_id", claims.centreId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawHrRequestRow[]).map(toHrRequest);
}

export interface IndicativeAnnualBalance {
  entitlementDays: number;
  consumedDays: number;
  openingAdjustmentDays: number;
  remainingDays: number;
}

/**
 * Read-only balance snapshot for inline display at submit time (US3, T026–T029, owns the guarded
 * ledger writes — this never mutates `leave_balance`).
 */
export async function getIndicativeAnnualBalanceCore(
  supabase: SupabaseClient,
  employeeId: string,
  leaveYear: number,
): Promise<IndicativeAnnualBalance | null> {
  const { data, error } = await supabase
    .from("leave_balance")
    .select("entitlement_days, consumed_days, opening_adjustment_days")
    .eq("employee_id", employeeId)
    .eq("leave_year", leaveYear)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const entitlementDays = Number(data.entitlement_days);
  const consumedDays = Number(data.consumed_days);
  const openingAdjustmentDays = Number(data.opening_adjustment_days);
  return {
    entitlementDays,
    consumedDays,
    openingAdjustmentDays,
    remainingDays: entitlementDays + openingAdjustmentDays - consumedDays,
  };
}

/**
 * US2 (T034): approve/reject a request. Routes to the guarded `approve_request`/`reject_request`
 * RPCs (T033). Self-approval (FR-026) is checked HERE first — app-layer, with a friendlier
 * Vietnamese message pointing the manager to a system admin — before ever calling the RPC; the RPC
 * ALSO re-asserts the same guard (defense in depth per contracts/hr-requests.actions.md), so a
 * direct RPC call (bypassing this service) is never able to self-approve either.
 */
export async function decideRequestCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: DecideRequestInput,
): Promise<HrRequest> {
  const { data: existing, error: fetchError } = await supabase
    .from("hr_request")
    .select("submitter_id")
    .eq("id", input.requestId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) {
    throw new DomainError("Không tìm thấy yêu cầu hoặc bạn không có quyền xem yêu cầu này");
  }
  if (existing.submitter_id === claims.employeeId) {
    throw new DomainError(
      "Bạn không thể tự duyệt/từ chối yêu cầu của chính mình. Vui lòng chuyển cho quản trị hệ thống xử lý.",
    );
  }

  if (input.decision === "approve") {
    const { data, error } = await supabase.rpc("approve_request", { p_request_id: input.requestId });
    if (error) throw new DomainError(error.message);
    const request = toHrRequest(data as RawHrRequestRow);

    const { error: auditError } = await supabase.rpc("write_audit_log", {
      p_action: "hrRequest.approve",
      p_entity_type: "hr_request",
      p_entity_id: request.id,
      p_metadata: { workingDays: request.workingDays },
    });
    if (auditError) console.error("[audit] hrRequest.approve failed to log", auditError);

    return request;
  }

  const { data, error } = await supabase.rpc("reject_request", {
    p_request_id: input.requestId,
    p_reason: input.reason,
  });
  if (error) throw new DomainError(error.message);
  const request = toHrRequest(data as RawHrRequestRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "hrRequest.reject",
    p_entity_type: "hr_request",
    p_entity_id: request.id,
    p_metadata: { reason: input.reason },
  });
  if (auditError) console.error("[audit] hrRequest.reject failed to log", auditError);

  return request;
}

/** Shared by cancelOrWithdrawCore and closePendingRequestsFor: call the RPC + audit the outcome. */
async function callCancelOrWithdrawRpc(supabase: SupabaseClient, requestId: string): Promise<HrRequest> {
  const { data, error } = await supabase.rpc("cancel_or_withdraw_request", { p_request_id: requestId });
  if (error) throw new DomainError(error.message);
  const request = toHrRequest(data as RawHrRequestRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: request.status === "withdrawn" ? "hrRequest.withdraw" : "hrRequest.cancel",
    p_entity_type: "hr_request",
    p_entity_id: request.id,
    p_metadata: null,
  });
  if (auditError) console.error("[audit] hrRequest.cancel/withdraw failed to log", auditError);

  return request;
}

/**
 * US2 (T037): submitter (own request) or super_admin/centre_manager (own-centre) cancels a
 * pending/awaiting_cover request, or withdraws an approved one (restoring any consumed annual-leave
 * balance). Routes to the guarded `cancel_or_withdraw_request` RPC (T033), which performs the
 * idempotent status flip + balance restore + cover release atomically.
 */
export async function cancelOrWithdrawCore(
  supabase: SupabaseClient,
  claims: Claims,
  requestId: string,
): Promise<HrRequest> {
  const { data: existing, error: fetchError } = await supabase
    .from("hr_request")
    .select("submitter_id, centre_id")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) {
    throw new DomainError("Không tìm thấy yêu cầu hoặc bạn không có quyền xem yêu cầu này");
  }
  const isOwnRequest = existing.submitter_id === claims.employeeId;
  const isDeciderOfCentre =
    claims.role === "super_admin" || (claims.role === "centre_manager" && existing.centre_id === claims.centreId);
  if (!isOwnRequest && !isDeciderOfCentre) {
    throw new DomainError("Bạn không có quyền hủy/rút yêu cầu này");
  }

  return callCancelOrWithdrawRpc(supabase, requestId);
}

/**
 * T037a: bulk-close every non-terminal request belonging to `employeeId` (edge case — the submitter
 * is deactivated while a request is still pending/awaiting_cover/approved). Reuses
 * `cancel_or_withdraw_request` per row — it already restores any consumed balance (for an
 * `approved` row) and releases covers, so no separate bulk RPC is needed; the loop here is just
 * fan-out over the employee's live rows, auditing each the same way `cancelOrWithdrawCore` does.
 * Called from `deactivateEmployeeCore` (personnel.service.ts) with the SAME `supabase` client the
 * caller (a centre_manager/super_admin, who already holds decide rights over the deactivated
 * employee's centre) used for the deactivation itself — `cancel_or_withdraw_request`'s own
 * centre/role check authorizes this; no separate permission check is needed here.
 */
export async function closePendingRequestsFor(supabase: SupabaseClient, employeeId: string): Promise<void> {
  const { data, error } = await supabase
    .from("hr_request")
    .select("id")
    .eq("submitter_id", employeeId)
    .in("status", NON_TERMINAL_STATUSES);
  if (error) throw error;

  for (const row of data ?? []) {
    await callCancelOrWithdrawRpc(supabase, row.id as string);
  }
}
