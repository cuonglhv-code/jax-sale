import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, RequestStatus, RequestType } from "@/lib/data/types";
import type { ReportFilterInput, OutstandingBalancesFilterInput, CoverageViewFilterInput } from "@/schemas/hr/report";
import { resolvePageSize, toRange, type Paginated } from "@/lib/pagination";

/**
 * US8 (T061, contracts/config-balance.actions.md "Reporting", SC-007): server-side aggregations
 * answering "leave taken by employee/centre/period", "requests by type & status", "outstanding
 * balances", and the coverage view — all role-scoped (centre_manager: own centre; super_admin:
 * network-wide) and paginated (constitution: no unbounded queries). Reports never expose medical-doc
 * content — only `hasAttachment` — and in fact never touch `request_attachment` at all, so there is
 * no content to leak.
 *
 * Scoping mirrors `listApprovalQueueCore` (hr-request.service.ts): an explicit `.eq("centre_id", …)`
 * for every role except `super_admin`, which reads network-wide — belt-and-suspenders alongside the
 * `hr_request`/`leave_balance` restricted-read RLS policies (data-model §12).
 */

const LEAVE_FAMILY_TYPES = ["annual_leave", "sick_leave", "personal_leave", "unpaid_leave"] as const;

function scopeToCallerCentre<T extends { eq: (col: string, val: unknown) => T }>(query: T, claims: Claims): T {
  if (claims.role === "super_admin") return query;
  return query.eq("centre_id", claims.centreId);
}

export interface LeaveByEmployeeRow {
  requestId: string;
  employeeId: string;
  employeeName: string;
  centreId: string;
  requestType: RequestType;
  status: RequestStatus;
  startDate: string | null;
  endDate: string | null;
  workingDays: number | null;
}

interface RawLeaveRow {
  id: string;
  submitter_id: string;
  centre_id: string;
  request_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  working_days: number | string | null;
  submitter: { full_name: string } | { full_name: string }[] | null;
}

function toEmployeeName(submitter: RawLeaveRow["submitter"]): string {
  if (!submitter) return "Nhân viên";
  const row = Array.isArray(submitter) ? submitter[0] : submitter;
  return row?.full_name ?? "Nhân viên";
}

/**
 * Leave taken by employee/centre/period (FR-038). Scoped to the leave-family types only (annual/
 * sick/personal/unpaid) — the other five request types carry no "leave taken" semantics.
 */
export async function listLeaveByEmployeeCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: ReportFilterInput,
): Promise<Paginated<LeaveByEmployeeRow>> {
  const pageSize = resolvePageSize(filter.pageSize);
  const page = filter.page ?? 1;
  const { from, to } = toRange(page, pageSize);

  let query = supabase
    .from("hr_request")
    .select(
      "id, submitter_id, centre_id, request_type, status, start_date, end_date, working_days, submitter:employees!hr_request_submitter_id_fkey(full_name)",
      { count: "exact" },
    )
    .in("request_type", LEAVE_FAMILY_TYPES)
    .order("start_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  query = scopeToCallerCentre(query, claims);
  if (filter.employeeId) query = query.eq("submitter_id", filter.employeeId);
  if (filter.startDate) query = query.gte("start_date", filter.startDate);
  if (filter.endDate) query = query.lte("end_date", filter.endDate);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = ((data ?? []) as unknown as RawLeaveRow[]).map((row) => ({
    requestId: row.id,
    employeeId: row.submitter_id,
    employeeName: toEmployeeName(row.submitter),
    centreId: row.centre_id,
    requestType: row.request_type as RequestType,
    status: row.status as RequestStatus,
    startDate: row.start_date,
    endDate: row.end_date,
    workingDays: row.working_days === null ? null : Number(row.working_days),
  }));

  return { rows, total: count ?? rows.length, page, pageSize };
}

export interface RequestsByTypeStatusRow {
  requestType: RequestType;
  status: RequestStatus;
  count: number;
}

/**
 * Requests by type & status (FR-038). This is a `GROUP BY`-shaped aggregation; per the constitution's
 * "no N+1, GROUP BY needs a SQL function" guidance, the alternative would be a new Postgres function.
 * Chosen instead: a single bounded, role-scoped `select` of just the two grouping columns (no request
 * bodies, no joins) with the grouping done in JS — HR request volume is low (a handful of centres,
 * unbounded historically but the caller can filter by period), and this avoids a new migration for a
 * one-off count. If volume grows enough to matter, this is the first candidate to move into a SQL
 * function — flagged here rather than silently accepted.
 */
export async function listRequestsByTypeStatusCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: ReportFilterInput,
): Promise<RequestsByTypeStatusRow[]> {
  let query = supabase.from("hr_request").select("request_type, status, start_date, end_date");
  query = scopeToCallerCentre(query, claims);
  if (filter.employeeId) query = query.eq("submitter_id", filter.employeeId);
  if (filter.startDate) query = query.gte("start_date", filter.startDate);
  if (filter.endDate) query = query.lte("end_date", filter.endDate);

  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = `${row.request_type}:${row.status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([key, count]) => {
    const [requestType, status] = key.split(":");
    return { requestType: requestType as RequestType, status: status as RequestStatus, count };
  });
}

export interface OutstandingBalanceRow {
  employeeId: string;
  employeeName: string;
  centreId: string;
  leaveYear: number;
  entitlementDays: number;
  consumedDays: number;
  openingAdjustmentDays: number;
  remainingDays: number;
}

interface RawBalanceRow {
  employee_id: string;
  leave_year: number;
  entitlement_days: number | string;
  consumed_days: number | string;
  opening_adjustment_days: number | string;
  employee: { full_name: string; centre_id: string } | { full_name: string; centre_id: string }[] | null;
}

function toEmployeeJoin(
  employee: RawBalanceRow["employee"],
): { full_name: string; centre_id: string } | null {
  if (!employee) return null;
  return Array.isArray(employee) ? (employee[0] ?? null) : employee;
}

/**
 * Outstanding annual-leave balances for every in-scope employee in a leave year (FR-038). Reuses the
 * same `leave_balance` shape as `getIndicativeAnnualBalanceCore` (hr-request.service.ts) but across
 * ALL employees in the caller's scope, not just one.
 */
export async function listOutstandingBalancesCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: OutstandingBalancesFilterInput,
): Promise<Paginated<OutstandingBalanceRow>> {
  const pageSize = resolvePageSize(filter.pageSize);
  const page = filter.page ?? 1;

  // The `leave_balance` table has no `centre_id` of its own, so a DB-level `.eq`/`.range` can't
  // scope-then-paginate in one step (a joined column isn't filterable via the JS client, and
  // paginating BEFORE the centre filter would make `total`/`.range()` reflect the network-wide
  // set — a centre_manager's own rows could then fall outside whatever page the client requests,
  // with `total` overstating what they can ever see). Fetch the full (leave_year-bounded, so still
  // small at this module's real scale — data-model "~10 centres, low-hundreds staff") set, filter
  // by centre in app code, THEN paginate the FILTERED array ourselves so `total`/`rows` agree.
  const { data, error } = await supabase
    .from("leave_balance")
    .select(
      "employee_id, leave_year, entitlement_days, consumed_days, opening_adjustment_days, employee:employees!leave_balance_employee_id_fkey(full_name, centre_id)",
    )
    .eq("leave_year", filter.leaveYear)
    .order("employee_id", { ascending: true });
  if (error) throw error;

  const scopedRows = ((data ?? []) as unknown as RawBalanceRow[])
    .map((row) => {
      const employee = toEmployeeJoin(row.employee);
      const entitlementDays = Number(row.entitlement_days);
      const consumedDays = Number(row.consumed_days);
      const openingAdjustmentDays = Number(row.opening_adjustment_days);
      return {
        employeeId: row.employee_id,
        employeeName: employee?.full_name ?? "Nhân viên",
        centreId: employee?.centre_id ?? "",
        leaveYear: row.leave_year,
        entitlementDays,
        consumedDays,
        openingAdjustmentDays,
        remainingDays: entitlementDays + openingAdjustmentDays - consumedDays,
      };
    })
    .filter((row) => claims.role === "super_admin" || row.centreId === claims.centreId);

  const { from, to } = toRange(page, pageSize);
  const rows = scopedRows.slice(from, to + 1);

  return { rows, total: scopedRows.length, page, pageSize };
}

export interface CoverageViewRow {
  requestId: string;
  offEmployeeId: string;
  offEmployeeName: string;
  coveringEmployeeId: string;
  coveringEmployeeName: string;
  classId: string;
  sessionDate: string;
  centreId: string;
}

interface RawCoverageRow {
  id: string; // cover_assignment.id
  class_id: string;
  session_date: string;
  nominee_id: string;
  nominee: { full_name: string } | { full_name: string }[] | null;
  request: {
    id: string;
    submitter_id: string;
    centre_id: string;
    submitter: { full_name: string } | { full_name: string }[] | null;
  } | {
    id: string;
    submitter_id: string;
    centre_id: string;
    submitter: { full_name: string } | { full_name: string }[] | null;
  }[] | null;
}

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * The coverage view (FR-039, SC-007): "who is off in a given period and who is covering" — joins
 * APPROVED leave requests to their ACCEPTED `cover_assignment` sessions falling in the period.
 * Answers without contacting anyone. Queried starting from `cover_assignment` (the row that carries
 * `session_date`) with a nested join up to the owning `hr_request` and both employees' names —
 * a single query, no N+1.
 */
export async function getCoverageViewCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: CoverageViewFilterInput,
): Promise<Paginated<CoverageViewRow>> {
  const pageSize = resolvePageSize(filter.pageSize);
  const page = filter.page ?? 1;

  // Same reasoning as listOutstandingBalancesCore: "approved request" and centre scope can only be
  // applied in app code (the joined hr_request.status/centre_id aren't reachable by a `.eq` on this
  // query), so paginating the DB query BEFORE that filter would let `total`/`.range()` reflect
  // covers whose owning request isn't even approved yet, or belongs to another centre — a
  // centre_manager's real rows could then land outside whatever page the client requests. The date
  // range (`filter.startDate`..`filter.endDate`) already bounds this query to a real period, so
  // fetching the full accepted-cover set for that period and paginating the FILTERED array
  // ourselves keeps `total`/`rows` consistent without an unbounded query.
  const { data, error } = await supabase
    .from("cover_assignment")
    .select(
      `id, class_id, session_date, nominee_id,
       nominee:employees!cover_assignment_nominee_id_fkey(full_name),
       request:hr_request!cover_assignment_request_id_fkey(
         id, submitter_id, centre_id, status,
         submitter:employees!hr_request_submitter_id_fkey(full_name)
       )`,
    )
    .eq("status", "accepted")
    .gte("session_date", filter.startDate)
    .lte("session_date", filter.endDate)
    .order("session_date", { ascending: true });

  if (error) throw error;

  const scopedRows: CoverageViewRow[] = [];
  for (const raw of (data ?? []) as unknown as RawCoverageRow[]) {
    const request = firstOf(raw.request) as
      | { id: string; submitter_id: string; centre_id: string; status?: string; submitter: RawCoverageRow["nominee"] }
      | null;
    if (!request) continue;
    // Only APPROVED requests count as "who is off" (FR-039) — a nominated/accepted cover on a
    // request still awaiting decision is not yet a confirmed absence.
    if (request.status !== "approved") continue;
    if (claims.role !== "super_admin" && request.centre_id !== claims.centreId) continue;

    const nominee = firstOf(raw.nominee);
    const submitter = firstOf(request.submitter);

    scopedRows.push({
      requestId: request.id,
      offEmployeeId: request.submitter_id,
      offEmployeeName: submitter?.full_name ?? "Nhân viên",
      coveringEmployeeId: raw.nominee_id,
      coveringEmployeeName: nominee?.full_name ?? "Nhân viên",
      classId: raw.class_id,
      sessionDate: raw.session_date,
      centreId: request.centre_id,
    });
  }

  const { from, to } = toRange(page, pageSize);
  const rows = scopedRows.slice(from, to + 1);

  return { rows, total: scopedRows.length, page, pageSize };
}
