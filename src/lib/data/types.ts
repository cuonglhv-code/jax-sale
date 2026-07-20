/**
 * Domain contract — enum string VALUES are stable across the rebuild (spec Assumptions);
 * only Vietnamese display labels live in vocabulary.ts. App types are camelCase; DB columns are
 * snake_case (converted only at the service boundary via src/lib/case.ts).
 *
 * Enums are modeled as `as const` string tuples + a derived union type — the idiomatic TS way to
 * keep the string value as the contract while getting exhaustiveness checking.
 */

// ── Roles ────────────────────────────────────────────────────────────────────
export const APP_ROLES = [
  "super_admin",
  "centre_manager",
  "centre_admin",
  "sale_consultant",
  "teacher",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Only this role is network-wide (may pass a centre-switcher override). */
export const NETWORK_WIDE_ROLES: readonly AppRole[] = ["super_admin"];

// ── Task enums ───────────────────────────────────────────────────────────────
export const TASK_STATUSES = [
  "TODO",
  "DOING",
  "DONE",
  "BLOCK",
  "RESCHEDULED",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Board columns exclude RESCHEDULED/CANCELLED (they exit the active flow). */
export const BOARD_STATUSES: readonly TaskStatus[] = ["TODO", "DOING", "DONE", "BLOCK"];

export const PRIORITIES = ["HIGH", "MID", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_GROUPS = [
  "GIANG_DAY",
  "TUYEN_SINH",
  "VAN_HANH_LOP",
  "CHAM_SOC_HV",
  "SU_KIEN",
  "HOP",
  "MARKETING_TRUYEN_THONG",
  "KHAC",
] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

/** Generation sources (FROM_ACTIVITY / FROM_WORKFLOW / RECURRING) are deferred to later slices. */
export const TASK_SOURCES = ["ASSIGNED", "SELF_CREATED", "AD_HOC"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

// ── Entities (camelCase app shapes) ──────────────────────────────────────────
export interface Centre {
  id: string;
  name: string;
  code: string;
  isFunctional: boolean;
}

/** First-class, network-wide org unit (flat, no centreId). Spec FR-024f. */
export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: AppRole;
  centreId: string;
  departmentId: string;
  isActive: boolean;
  avatarColor: string;
}

export interface Task {
  id: string;
  centreId: string;
  assigneeId: string;
  departmentId: string;
  description: string;
  group: TaskGroup;
  priority: Priority;
  deadline: string; // ISO date
  status: TaskStatus;
  source: TaskSource;
  note: string | null;
  createdBy: string;
  createdAt: string; // ISO timestamp
}

/** Task with resolved display names for list/board views. */
export interface TaskView extends Task {
  assigneeName: string;
  departmentName: string;
  centreName: string;
  createdByName: string;
}

/** Immutable status-change record — written on EVERY transition (spec FR-021/022). */
export interface TaskStatusLog {
  id: string;
  taskId: string;
  centreId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedById: string;
  note: string | null;
  changedAt: string;
}

/** General audit trail — the seam future modules reuse (spec FR-024g). Append-only. */
export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string; // "<entity>.<verb>", e.g. "task.create"
  entityType: string;
  entityId: string;
  centreId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** The verified identity resolved from the session JWT (never client-supplied). */
export interface Claims {
  authUserId: string;
  role: AppRole;
  centreId: string;
  employeeId: string;
}

// ── Sales Performance & KPI (slice #003) ─────────────────────────────────────
export const METRIC_KEYS = ["enrolments_closed", "revenue"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const APPROVAL_STATES = ["pending", "approved", "rejected"] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

/** Derived attainment classification (never persisted). */
export const ATTAINMENT_STATES = ["not_set", "on_track", "behind", "no_result"] as const;
export type AttainmentState = (typeof ATTAINMENT_STATES)[number];

/** Personal KPI row — own-row, actual-only owner write; a §V lifecycle entity (spec FR-ACTUAL). */
export interface PersonalKpiEntry {
  id: string;
  consultantId: string;
  centreId: string;
  period: string; // YYYY-MM
  metricKey: MetricKey;
  target: number | null; // null = "not set" (never rendered/computed as 0%)
  actual: number;
  approvalStatus: ApprovalState;
  createdAt: string;
  updatedAt: string;
}

/** Network-wide department target (top-admin only; §13 kpi_metrics). NOT centre-confined. */
export interface DepartmentKpiTarget {
  id: string;
  departmentId: string;
  period: string;
  metricKey: MetricKey;
  target: number;
  createdAt: string;
  updatedAt: string;
}

/** Immutable approval-transition record — written on EVERY transition (constitution §V). */
export interface PersonalKpiStatusLog {
  id: string;
  entryId: string;
  centreId: string;
  fromStatus: ApprovalState | null;
  toStatus: ApprovalState;
  changedById: string;
  note: string | null;
  changedAt: string;
}

/** Derived attainment for one metric at a scope (never persisted). */
export interface Attainment {
  metricKey: MetricKey;
  approvedActual: number;
  target: number | null;
  ratio: number | null;
  state: AttainmentState;
}

/** A dashboard row at some scope (consultant | centre | department | network). */
export interface KpiDashboardRow {
  scopeId: string;
  scopeName: string;
  attainments: Attainment[];
}

// ── HR Requests (slice #004) ─────────────────────────────────────────────────
// Enum VALUES are the stable contract (data-model §1); Vietnamese labels in vocabulary.ts.

/** The nine form types — drives the FormDefinition registry (data-model §10). */
export const REQUEST_TYPES = [
  "annual_leave",
  "sick_leave",
  "personal_leave",
  "unpaid_leave",
  "shift_swap",
  "overtime",
  "salary_advance",
  "purchase",
  "business_travel",
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

/** Request lifecycle (data-model §9). `awaiting_cover` = submitted but a cover is unaccepted. */
export const REQUEST_STATUSES = [
  "pending",
  "awaiting_cover",
  "approved",
  "rejected",
  "cancelled",
  "withdrawn",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Half-day granularity (FR-015). `morning`/`afternoon` ⇒ 0.5 day. */
export const LEAVE_DAY_PARTS = ["full", "morning", "afternoon"] as const;
export type LeaveDayPart = (typeof LEAVE_DAY_PARTS)[number];

/** Cover-nomination lifecycle (data-model §9). */
export const COVER_STATUSES = ["nominated", "accepted", "declined", "released"] as const;
export type CoverStatus = (typeof COVER_STATUSES)[number];

/** Drives pro-rated accrual (FR-009/046). */
export const EMPLOYMENT_TYPES = ["full_time", "part_time"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** Vietnamese labour contract classes; accrual eligibility is config-driven, not per-value. */
export const CONTRACT_TYPES = ["indefinite", "fixed_term", "probation", "seasonal"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Statutory paid-personal-leave categories (FR-007); day-allowance per event is config. */
export const PERSONAL_LEAVE_EVENTS = ["marriage_self", "marriage_child", "bereavement", "other"] as const;
export type PersonalLeaveEvent = (typeof PERSONAL_LEAVE_EVENTS)[number];

// ── HR entity shapes (camelCase app views of the snake_case tables) ───────────

/** Core request row — all nine types; type-specific fields live in `payload` (data-model §5). */
export interface HrRequest {
  id: string;
  requestType: RequestType;
  submitterId: string;
  centreId: string;
  status: RequestStatus;
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date
  dayPart: LeaveDayPart | null;
  workingDays: number | null;
  amount: number | null; // money forms; sensitive
  payload: Record<string, unknown>;
  decidedBy: string | null;
  decidedAt: string | null; // ISO timestamp
  decisionReason: string | null;
  supersedesId: string | null;
  createdAt: string; // ISO timestamp
  /** US4 (T043a): true when an accepted cover was released post-approval and needs re-resolution. */
  needsReresolution: boolean;
}

/** Append-only per-request timeline — a from-null row is written at creation (data-model §5). */
export interface HrRequestStatusHistory {
  id: string;
  requestId: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  changedBy: string;
  reason: string | null;
  createdAt: string;
}

/** A nominated cover for one affected class session (data-model §6). */
export interface CoverAssignment {
  id: string;
  requestId: string;
  classId: string;
  sessionDate: string; // ISO date
  nomineeId: string;
  status: CoverStatus;
  respondedAt: string | null;
}

/** Attachment metadata mapping a private storage object to a request (data-model §7). */
export interface RequestAttachment {
  id: string;
  requestId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  isMedical: boolean;
  uploadedBy: string;
  purgeAfter: string | null; // ISO date
  createdAt: string;
}

/** Annual-leave ledger — one row per (employee, leave year). `remaining` is derived (data-model §8). */
export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveYear: number;
  entitlementDays: number;
  consumedDays: number;
  openingAdjustmentDays: number;
  updatedAt: string;
}

/** Statutory/policy config for a leave year (data-model §3). HR-editable; never hardcoded. */
export interface LeavePolicyConfig {
  id: string;
  leaveYear: number;
  annualBaselineDays: number;
  seniorityExtraDaysPerYears: number;
  seniorityYearsStep: number;
  leaveYearStart: string;
  workingWeek: number[]; // ISO weekday numbers counted as working
  noticeDays: number;
  carryoverEnabled: boolean;
  carryoverCapDays: number | null;
  medicalDocRetentionDays: number;
  partTimeProrate: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

/** Statutory paid-personal-leave day allowance per event (data-model §3). */
export interface LeaveEventAllowance {
  id: string;
  event: PersonalLeaveEvent;
  allowanceDays: number;
  paid: boolean;
}

/** Network-wide holiday; excluded from working-day counts (data-model §3). */
export interface PublicHoliday {
  id: string;
  holidayDate: string; // ISO date
  name: string;
}

/** Accepted attachment types/size per request type (data-model §3). */
export interface DocTypePolicy {
  id: string;
  requestType: RequestType;
  maxSizeBytes: number;
  allowedMime: string[];
  required: boolean;
}

/** Recurring class definition; a session is the computed (classId, sessionDate) tuple (data-model §4). */
export interface TeachingClass {
  id: string;
  centreId: string;
  courseLabel: string;
  teacherId: string;
  weekday: number; // ISO weekday 1–7
  startTime: string; // HH:MM[:SS]
  endTime: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  isActive: boolean;
}
