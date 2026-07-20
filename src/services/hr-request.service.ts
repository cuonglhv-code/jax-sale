import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, HrRequest, LeaveDayPart } from "@/lib/data/types";
import type { ShiftSwapInput } from "@/schemas/hr/shift-swap";
import type { DecideRequestInput } from "@/schemas/hr/decide";
import type { CoverNominationInput } from "@/schemas/hr/cover";
import type { SubmitInput } from "@/lib/domain/hr-forms";
import { countWorkingDays } from "@/lib/hr/working-days";
import { resolveAffectedSessions } from "@/lib/hr/conflict";
import { listActiveClassesForTeacher, toConflictClass } from "@/services/class.service";
import { DomainError } from "@/lib/server-action";
import { getFormDefinition, HR_FORM_REGISTRY } from "@/lib/domain/hr-forms";
import { hasAttachmentForRequests } from "@/services/attachment.service";

/**
 * The leave-family shape shared by annual/sick/personal/unpaid leave (US1/US5) — a date-range
 * request with day-part granularity and optional cover nominations. Distinguishing this from the
 * money/overtime forms is a structural (payload-shape) check, not a type-name allowlist, so a
 * future leave-family addition needs no new branch here — only a new FormDefinition (FR-002).
 */
interface LeaveFamilyInput {
  requestType: string;
  startDate: string;
  endDate: string;
  dayPart: LeaveDayPart;
  covers?: readonly CoverNominationInput[];
  note?: string;
  reason?: string;
  event?: string;
}

function isLeaveFamilyInput(input: SubmitInput): input is SubmitInput & LeaveFamilyInput {
  return (
    input.requestType === "annual_leave" ||
    input.requestType === "sick_leave" ||
    input.requestType === "personal_leave" ||
    input.requestType === "unpaid_leave"
  );
}

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
  needs_reresolution?: boolean;
}

/**
 * `hasAttachment` defaults to `false` for single-row mutation results (submit/decide/cancel) — at
 * those call sites no attachment could exist yet (fresh submit) or the mutation's own result value
 * doesn't drive any attachment-bearing UI; only the LIST projections (US6, T054) need the real,
 * batched existence check — see `listMyRequestsCore`/`listApprovalQueueCore` below.
 */
function toHrRequest(row: RawHrRequestRow, hasAttachment = false): HrRequest {
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
    needsReresolution: row.needs_reresolution ?? false,
    createdAt: row.created_at,
    hasAttachment,
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

/** Read the leave year's `am_pm_boundary_time` (config-driven — research R3's caveat). */
async function getAmPmBoundary(supabase: SupabaseClient, leaveYear: number): Promise<string> {
  const { data, error } = await supabase
    .from("leave_policy_config")
    .select("am_pm_boundary_time")
    .eq("leave_year", leaveYear)
    .maybeSingle();
  if (error) throw error;
  return (data?.am_pm_boundary_time as string | undefined) ?? "12:00:00";
}

/**
 * US4 (T042): for a conflict-scoped submission (annual_leave, shift_swap, …), resolve which of the
 * SUBMITTER's own sessions the request overlaps, and — if any — validate the caller-supplied cover
 * nominations against them: every affected session must have exactly one nominee named, and every
 * nominee is re-resolved (via the SAME pure resolver, called with the NOMINEE's id) to confirm they
 * have no hard conflict at that exact class/session (FR-020) and are an active same-centre teacher.
 * Returns the validated `{classId, sessionDate, nomineeId}[]` ready to pass into the create RPC —
 * empty when the request affects no taught session.
 */
async function resolveRequiredCovers(
  supabase: SupabaseClient,
  claims: Claims,
  startDate: string,
  endDate: string,
  dayPart: LeaveDayPart,
  covers: readonly CoverNominationInput[] | undefined,
): Promise<CoverNominationInput[]> {
  const leaveYear = Number(startDate.slice(0, 4));
  const [submitterClasses, holidayRows, amPmBoundary] = await Promise.all([
    listActiveClassesForTeacher(supabase, claims.employeeId),
    supabase.from("public_holiday").select("holiday_date"),
    getAmPmBoundary(supabase, leaveYear),
  ]);
  if (holidayRows.error) throw holidayRows.error;
  const holidays = (holidayRows.data ?? []).map((h) => h.holiday_date as string);

  const affectedSessions = resolveAffectedSessions({
    classes: submitterClasses.map(toConflictClass),
    teacherId: claims.employeeId,
    startDate,
    endDate,
    dayPart,
    holidays,
    amPmBoundary,
  });

  if (affectedSessions.length === 0) return [];

  if (!covers || covers.length === 0) {
    throw new DomainError(
      "Yêu cầu này trùng với buổi dạy của bạn. Vui lòng đề cử giáo viên dạy thay trước khi gửi yêu cầu.",
    );
  }

  const coverBySession = new Map(covers.map((c) => [`${c.classId}:${c.sessionDate}`, c]));
  for (const session of affectedSessions) {
    const key = `${session.classId}:${session.sessionDate}`;
    if (!coverBySession.has(key)) {
      throw new DomainError(
        `Vui lòng đề cử giáo viên dạy thay cho buổi học ngày ${session.sessionDate}.`,
      );
    }
  }

  // Re-validate EVERY nominee (not just the ones matching an affected session, since the caller may
  // have named additional class/session pairs — e.g. shift_swap's standalone use, or an attempted
  // hard-conflict bypass) — every nominee must be a same-centre active teacher with no hard
  // conflict at their OWN named session, resolved via the SAME pure resolver called with the
  // nominee's id.
  const nomineeClassesCache = new Map<string, Awaited<ReturnType<typeof listActiveClassesForTeacher>>>();
  for (const cover of covers) {
    const { data: nominee, error: nomineeError } = await supabase
      .from("employees")
      .select("id, centre_id, is_active, app_role")
      .eq("id", cover.nomineeId)
      .maybeSingle();
    if (nomineeError) throw nomineeError;
    if (
      !nominee ||
      !nominee.is_active ||
      nominee.app_role !== "teacher" ||
      nominee.centre_id !== claims.centreId
    ) {
      throw new DomainError("Giáo viên dạy thay phải thuộc cùng trung tâm và đang hoạt động.");
    }

    let nomineeClasses = nomineeClassesCache.get(cover.nomineeId);
    if (!nomineeClasses) {
      nomineeClasses = await listActiveClassesForTeacher(supabase, cover.nomineeId);
      nomineeClassesCache.set(cover.nomineeId, nomineeClasses);
    }

    const nomineeConflicts = resolveAffectedSessions({
      classes: nomineeClasses.map(toConflictClass),
      teacherId: cover.nomineeId,
      startDate: cover.sessionDate,
      endDate: cover.sessionDate,
      dayPart: "full",
      holidays,
      amPmBoundary,
    });
    if (nomineeConflicts.length > 0) {
      throw new DomainError(
        `Giáo viên được đề cử đang có lịch dạy trùng vào ngày ${cover.sessionDate}, không thể nhận dạy thay.`,
      );
    }
  }

  return [...covers];
}

/** Shared tail of submitRequestCore: create RPC call, audit, return — everything after cover validation. */
async function createAndAuditRequest(
  supabase: SupabaseClient,
  params: {
    requestType: string;
    startDate: string | null;
    endDate: string | null;
    dayPart: LeaveDayPart | null;
    workingDays: number | null;
    amount?: number | null;
    payload: Record<string, unknown>;
    covers: readonly CoverNominationInput[];
  },
): Promise<HrRequest> {
  const { data, error } = await supabase.rpc("create_hr_request_with_log", {
    p_request_type: params.requestType,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_day_part: params.dayPart,
    p_working_days: params.workingDays,
    p_amount: params.amount ?? null,
    p_payload: params.payload,
    p_covers: params.covers.map((c) => ({
      class_id: c.classId,
      session_date: c.sessionDate,
      nominee_id: c.nomineeId,
    })),
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

  return request;
}

/**
 * US4 (T044): submit a shift-swap through the single-engine pipeline. Unlike the leave family,
 * shift_swap has no date range for the resolver to derive affected sessions from — the submitter
 * directly names the ONE class/session/nominee (FR-021, data-model §10: payload = `note` only). The
 * nominee is still re-validated the SAME way (same-centre active teacher, no hard conflict at that
 * session) via the shared resolver, called with the nominee's id.
 */
async function submitShiftSwap(
  supabase: SupabaseClient,
  claims: Claims,
  input: ShiftSwapInput,
): Promise<SubmitRequestResult> {
  const leaveYear = Number(input.cover.sessionDate.slice(0, 4));
  const [holidayRows, amPmBoundary] = await Promise.all([
    supabase.from("public_holiday").select("holiday_date"),
    getAmPmBoundary(supabase, leaveYear),
  ]);
  if (holidayRows.error) throw holidayRows.error;
  const holidays = (holidayRows.data ?? []).map((h) => h.holiday_date as string);

  const { data: nominee, error: nomineeError } = await supabase
    .from("employees")
    .select("id, centre_id, is_active, app_role")
    .eq("id", input.cover.nomineeId)
    .maybeSingle();
  if (nomineeError) throw nomineeError;
  if (!nominee || !nominee.is_active || nominee.app_role !== "teacher" || nominee.centre_id !== claims.centreId) {
    throw new DomainError("Giáo viên dạy thay phải thuộc cùng trung tâm và đang hoạt động.");
  }

  const nomineeClasses = await listActiveClassesForTeacher(supabase, input.cover.nomineeId);
  const nomineeConflicts = resolveAffectedSessions({
    classes: nomineeClasses.map(toConflictClass),
    teacherId: input.cover.nomineeId,
    startDate: input.cover.sessionDate,
    endDate: input.cover.sessionDate,
    dayPart: "full",
    holidays,
    amPmBoundary,
  });
  if (nomineeConflicts.length > 0) {
    throw new DomainError(
      `Giáo viên được đề cử đang có lịch dạy trùng vào ngày ${input.cover.sessionDate}, không thể nhận dạy thay.`,
    );
  }

  const request = await createAndAuditRequest(supabase, {
    requestType: input.requestType,
    startDate: null,
    endDate: null,
    dayPart: null,
    workingDays: null,
    payload: input.note ? { note: input.note } : {},
    covers: [input.cover],
  });

  return { ...request, overBalanceWarning: false };
}

/** Payload fields carried by leave-family inputs, minus the promoted columns (data-model §10). */
function leaveFamilyPayload(input: SubmitInput & LeaveFamilyInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.note) payload.note = input.note;
  if (input.reason) payload.reason = input.reason;
  if (input.event) payload.event = input.event;
  return payload;
}

/**
 * US1 (T020a/029) + US4 (T042) + US5 (T047): submit a leave-family request (annual/sick/personal/
 * unpaid leave) — shared date-range core. Only `annual_leave`'s FormDefinition declares
 * `sideEffect: "draw_annual_balance"` (FR-007/FR-014), so the over-balance warning is computed ONLY
 * for that type; sick/personal/unpaid never touch the balance, at submission or at approval
 * (`approve_request`'s own `request_type = 'annual_leave'` guard is the authoritative enforcement —
 * this is display-only, indicative-at-submit behaviour, data-model §10).
 */
async function submitLeaveFamily(
  supabase: SupabaseClient,
  claims: Claims,
  input: SubmitInput & LeaveFamilyInput,
): Promise<SubmitRequestResult> {
  await assertNoSelfOverlap(supabase, claims, input.startDate, input.endDate);
  const workingDays = await computeIndicativeWorkingDays(supabase, input.startDate, input.endDate, input.dayPart);

  const definition = getFormDefinition(input.requestType as never);
  const covers = definition.conflictScoped
    ? await resolveRequiredCovers(supabase, claims, input.startDate, input.endDate, input.dayPart, input.covers)
    : [];

  const request = await createAndAuditRequest(supabase, {
    requestType: input.requestType,
    startDate: input.startDate,
    endDate: input.endDate,
    dayPart: input.dayPart,
    workingDays,
    payload: leaveFamilyPayload(input),
    covers,
  });

  // T029: over-balance warning — indicative only, read AFTER creation so it never blocks the write.
  // Only annual_leave draws the balance (FR-007/FR-014); other leave-family types never warn.
  let overBalanceWarning = false;
  if (definition.sideEffect === "draw_annual_balance") {
    const leaveYear = Number(input.startDate.slice(0, 4));
    const balance = await getIndicativeAnnualBalanceCore(supabase, claims.employeeId, leaveYear);
    overBalanceWarning = balance !== null && workingDays > balance.remainingDays;
  }

  return { ...request, overBalanceWarning };
}

/**
 * US5 (T047): submit a non-leave-family, non-shift-swap request — overtime (no dates) or a money
 * form (salary_advance/purchase — no dates; business_travel — has a date range but is explicitly
 * NOT conflict-scoped per data-model §10, so no cover resolver runs and no self-overlap/working-days
 * logic applies, since it isn't an absence from teaching). No leave-balance interaction for any of
 * these types.
 */
async function submitNonLeaveRequest(
  supabase: SupabaseClient,
  input: Exclude<SubmitInput, LeaveFamilyInput | ShiftSwapInput>,
): Promise<SubmitRequestResult> {
  const asRecord = input as unknown as Record<string, unknown>;
  const startDate = typeof asRecord.startDate === "string" ? asRecord.startDate : null;
  const endDate = typeof asRecord.endDate === "string" ? asRecord.endDate : null;
  const amount = typeof asRecord.amount === "number" ? asRecord.amount : null;

  const payload: Record<string, unknown> = {};
  for (const key of ["date", "hours", "justification", "repaymentIntent", "item", "vendor", "destination"]) {
    if (asRecord[key] !== undefined) payload[key] = asRecord[key];
  }

  const request = await createAndAuditRequest(supabase, {
    requestType: input.requestType,
    startDate,
    endDate,
    dayPart: null,
    workingDays: null,
    amount,
    payload,
    covers: [],
  });

  return { ...request, overBalanceWarning: false };
}

/**
 * FR-002/015/024g (US1) + FR-021 (US4) + US5: submit a request through the single-engine pipeline.
 * Centre + submitter are taken from `claims` INSIDE the `create_hr_request_with_log` RPC (never from
 * `input`), so nothing in `input` can cross a centre boundary or submit on someone else's behalf.
 * Dispatches by request SHAPE, not an exhaustive per-type switch: the leave family resolves affected
 * sessions from a date range (US4, T042); `shift_swap` (US4, T044) names its one class/session/
 * nominee directly (no date range); everything else (overtime, money forms) has no leave semantics
 * at all (US5, T047).
 */
export async function submitRequestCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: SubmitInput,
): Promise<SubmitRequestResult> {
  if (input.requestType === "shift_swap") {
    return submitShiftSwap(supabase, claims, input as ShiftSwapInput);
  }

  if (isLeaveFamilyInput(input)) {
    return submitLeaveFamily(supabase, claims, input);
  }

  return submitNonLeaveRequest(supabase, input as Exclude<SubmitInput, LeaveFamilyInput | ShiftSwapInput>);
}

/** "My requests" list (US1 acceptance: a submitted request appears here) — own-submitter scoped. */
export async function listMyRequestsCore(supabase: SupabaseClient, claims: Claims): Promise<HrRequest[]> {
  const { data, error } = await supabase
    .from("hr_request")
    .select(
      "id, request_type, submitter_id, centre_id, status, start_date, end_date, day_part, working_days, amount, payload, decided_by, decided_at, decision_reason, supersedes_id, created_at, needs_reresolution",
    )
    .eq("submitter_id", claims.employeeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as RawHrRequestRow[];
  // US6 (T054): only a boolean per row is ever exposed here — never the attachment row itself.
  const attached = await hasAttachmentForRequests(supabase, rows.map((r) => r.id));
  return rows.map((row) => toHrRequest(row, attached.has(row.id)));
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
      "id, request_type, submitter_id, centre_id, status, start_date, end_date, day_part, working_days, amount, payload, decided_by, decided_at, decision_reason, supersedes_id, created_at, needs_reresolution",
    )
    .in("status", ["pending", "awaiting_cover"])
    .order("start_date", { ascending: true, nullsFirst: false });

  if (claims.role !== "super_admin") {
    query = query.eq("centre_id", claims.centreId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RawHrRequestRow[];
  // US6 (T054): approval queue shows only "Có tài liệu đính kèm" (boolean) — never the doc itself.
  const attached = await hasAttachmentForRequests(supabase, rows.map((r) => r.id));
  return rows.map((row) => toHrRequest(row, attached.has(row.id)));
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

    // T048 (US5, FR-025): the three money forms (salary_advance/purchase/business_travel) must
    // notify accounting (super_admin in v1) on approval — the notification infra (Resend, email
    // templates) doesn't exist yet (US7, Phase 9), so this does NOT send anything today. Flagging
    // `isMoneyForm`/`amount` in the audit metadata now gives the eventual US7 notification hook
    // (`notification.service.ts`, wired after this same audit write per tasks.md Phase 9) something
    // to key off without a second read of the form definition. DO NOT fake an email here.
    const definition = HR_FORM_REGISTRY[request.requestType];
    const auditMetadata: Record<string, unknown> = { workingDays: request.workingDays };
    if (definition?.isMoneyForm) {
      auditMetadata.isMoneyForm = true;
      auditMetadata.amount = request.amount;
      // TODO(US7): notify accounting (super_admin) that a money-form request was approved.
    }

    const { error: auditError } = await supabase.rpc("write_audit_log", {
      p_action: "hrRequest.approve",
      p_entity_type: "hr_request",
      p_entity_id: request.id,
      p_metadata: auditMetadata,
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
