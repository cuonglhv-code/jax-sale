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
