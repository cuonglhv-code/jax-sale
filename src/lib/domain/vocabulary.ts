/**
 * THE single vocabulary source (constitution Principle I, spec FR-024/024c). All Vietnamese
 * display labels, badge colors, the navigation/access matrix, and centre-resolution logic live
 * here — importable from both server and client, dependency-free. Enum VALUES are the contract
 * (see types.ts); only display text lives here. Never render a raw enum id.
 */

import {
  type AppRole,
  type ApprovalState,
  type AttainmentState,
  type ContractType,
  type CoverStatus,
  type EmploymentType,
  type LeaveDayPart,
  type MetricKey,
  type PersonalLeaveEvent,
  type Priority,
  type RequestStatus,
  type RequestType,
  type TaskGroup,
  type TaskStatus,
  NETWORK_WIDE_ROLES,
} from "@/lib/data/types";

// ── Badge color triples (reference design tokens; centralized for light/dark theming) ─────────
export interface BadgeColor {
  text: string;
  bg: string;
  border: string;
}

// ── Roles ────────────────────────────────────────────────────────────────────
export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Quản trị hệ thống",
  centre_manager: "Quản lý trung tâm",
  centre_admin: "Quản trị viên trung tâm",
  sale_consultant: "Tư vấn tuyển sinh",
  teacher: "Giáo viên",
};

// ── Task status ──────────────────────────────────────────────────────────────
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Cần làm",
  DOING: "Đang làm",
  DONE: "Hoàn thành",
  BLOCK: "Tạm dừng",
  RESCHEDULED: "Chuyển lịch",
  CANCELLED: "Hủy công việc",
};

/** Board column order (RESCHEDULED/CANCELLED are not columns — see types.BOARD_STATUSES). */
export const TASK_STATUS_ORDER: readonly TaskStatus[] = ["TODO", "DOING", "DONE", "BLOCK"];

/** Reuses the state-color hues rather than a 7th distinct palette (design_handoff_jax_sales README):
 *  TODO=neutral, DOING=navy, DONE=on-track green, BLOCK=red, RESCHEDULED=amber, CANCELLED=gray. */
export const TASK_STATUS_COLOR: Record<TaskStatus, BadgeColor> = {
  TODO: { text: "var(--color-att-notset-text)", bg: "var(--color-att-notset-bg)", border: "var(--color-att-notset-border)" },
  DOING: { text: "var(--color-st-doing-text)", bg: "var(--color-st-doing-bg)", border: "var(--color-st-doing-border)" },
  DONE: { text: "var(--color-att-ontrack-text)", bg: "var(--color-att-ontrack-bg)", border: "var(--color-att-ontrack-border)" },
  BLOCK: { text: "var(--color-st-rejected-text)", bg: "var(--color-st-rejected-bg)", border: "var(--color-st-rejected-border)" },
  RESCHEDULED: { text: "var(--color-st-pending-text)", bg: "var(--color-st-pending-bg)", border: "var(--color-st-pending-border)" },
  CANCELLED: { text: "var(--color-st-cancelled-text)", bg: "var(--color-st-cancelled-bg)", border: "var(--color-st-cancelled-border)" },
};

// ── Priority ─────────────────────────────────────────────────────────────────
export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: "Cao",
  MID: "Trung bình",
  LOW: "Thấp",
};

export const PRIORITY_COLOR: Record<Priority, BadgeColor> = {
  HIGH: { text: "var(--color-pri-high-text)", bg: "var(--color-pri-high-bg)", border: "var(--color-pri-high-border)" },
  MID: { text: "var(--color-pri-mid-text)", bg: "var(--color-pri-mid-bg)", border: "var(--color-pri-mid-border)" },
  LOW: { text: "var(--color-pri-low-text)", bg: "var(--color-pri-low-bg)", border: "var(--color-pri-low-border)" },
};

// ── Task group ───────────────────────────────────────────────────────────────
export const TASK_GROUP_LABEL: Record<TaskGroup, string> = {
  GIANG_DAY: "Giảng dạy",
  TUYEN_SINH: "Tuyển sinh",
  VAN_HANH_LOP: "Vận hành lớp",
  CHAM_SOC_HV: "Chăm sóc HV",
  SU_KIEN: "Sự kiện",
  HOP: "Họp",
  MARKETING_TRUYEN_THONG: "Marketing & Truyền thông",
  KHAC: "Khác",
};

/** Kanban card group-chip dot color (design_handoff_jax_sales — TUYEN_SINH/CHAM_SOC_HV/
 *  VAN_HANH_LOP/GIANG_DAY come from the handoff's own mock data; the other 4 groups extend the
 *  same palette rather than introducing new hues outside the design system). Solid hex, not a
 *  BadgeColor triple — this is a small dot indicator, not a bordered badge. */
export const TASK_GROUP_COLOR: Record<TaskGroup, string> = {
  TUYEN_SINH: "#2B3A8C",
  CHAM_SOC_HV: "#0E8AA8",
  VAN_HANH_LOP: "#C08A1A",
  GIANG_DAY: "#2E8B57",
  SU_KIEN: "#D01F26",
  HOP: "#5A4B8A",
  MARKETING_TRUYEN_THONG: "#B23A12",
  KHAC: "#5B6270",
};

// ── Sales Performance & KPI labels (slice #003) ──────────────────────────────
export const METRIC_LABEL: Record<MetricKey, string> = {
  enrolments_closed: "Số học viên chốt",
  revenue: "Doanh thu",
};

export const APPROVAL_STATE_LABEL: Record<ApprovalState, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
};

export const ATTAINMENT_STATE_LABEL: Record<AttainmentState, string> = {
  not_set: "Chưa đặt mục tiêu",
  on_track: "Đạt mục tiêu",
  behind: "Chưa đạt",
  no_result: "Chưa có kết quả",
};

export const ATTAINMENT_COLOR: Record<AttainmentState, BadgeColor> = {
  not_set: { text: "var(--color-att-notset-text)", bg: "var(--color-att-notset-bg)", border: "var(--color-att-notset-border)" },
  on_track: { text: "var(--color-att-ontrack-text)", bg: "var(--color-att-ontrack-bg)", border: "var(--color-att-ontrack-border)" },
  behind: { text: "var(--color-att-behind-text)", bg: "var(--color-att-behind-bg)", border: "var(--color-att-behind-border)" },
  no_result: { text: "var(--color-att-noresult-text)", bg: "var(--color-att-noresult-bg)", border: "var(--color-att-noresult-border)" },
};

// ── HR Requests labels (slice #004) ──────────────────────────────────────────
export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  annual_leave: "Nghỉ phép năm",
  sick_leave: "Nghỉ ốm",
  personal_leave: "Nghỉ việc riêng",
  unpaid_leave: "Nghỉ không lương",
  shift_swap: "Đổi ca / lịch dạy",
  overtime: "Làm thêm giờ",
  salary_advance: "Tạm ứng lương",
  purchase: "Đề nghị mua sắm",
  business_travel: "Công tác",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Chờ duyệt",
  awaiting_cover: "Chờ người dạy thay",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  cancelled: "Đã hủy",
  withdrawn: "Đã thu hồi",
};

export const REQUEST_STATUS_COLOR: Record<RequestStatus, BadgeColor> = {
  pending: { text: "var(--color-st-pending-text)", bg: "var(--color-st-pending-bg)", border: "var(--color-st-pending-border)" },
  awaiting_cover: { text: "var(--color-st-awaiting-text)", bg: "var(--color-st-awaiting-bg)", border: "var(--color-st-awaiting-border)" },
  approved: { text: "var(--color-st-approved-text)", bg: "var(--color-st-approved-bg)", border: "var(--color-st-approved-border)" },
  rejected: { text: "var(--color-st-rejected-text)", bg: "var(--color-st-rejected-bg)", border: "var(--color-st-rejected-border)" },
  cancelled: { text: "var(--color-st-cancelled-text)", bg: "var(--color-st-cancelled-bg)", border: "var(--color-st-cancelled-border)" },
  withdrawn: { text: "var(--color-st-withdrawn-text)", bg: "var(--color-st-withdrawn-bg)", border: "var(--color-st-withdrawn-border)" },
};

export const LEAVE_DAY_PART_LABEL: Record<LeaveDayPart, string> = {
  full: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
};

export const COVER_STATUS_LABEL: Record<CoverStatus, string> = {
  nominated: "Đã đề cử",
  accepted: "Đã nhận dạy thay",
  declined: "Đã từ chối",
  released: "Đã giải phóng",
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
};

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  indefinite: "Không xác định thời hạn",
  fixed_term: "Xác định thời hạn",
  probation: "Thử việc",
  seasonal: "Thời vụ",
};

export const PERSONAL_LEAVE_EVENT_LABEL: Record<PersonalLeaveEvent, string> = {
  marriage_self: "Bản thân kết hôn",
  marriage_child: "Con kết hôn",
  bereavement: "Tang lễ",
  other: "Khác",
};

/** ISO weekday (1=Monday … 7=Sunday) label for the timetable admin UI (US4, T041). */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

// ── Navigation = access matrix (ONE list; spec FR-009/024b) ───────────────────
// This is BOTH the sidebar definition AND the route-access matrix. Adding a future module = one
// entry here (no parallel list).
//
// Trimmed to modules that actually have a page.tsx (2026-07-20): the original design reserved
// entries here for not-yet-built modules ("dashboard", "activities", "leads", "students",
// "pathway", "team", "settings", "personnel", "workflows", "performanceActivity", "hrConfig",
// "hrReports"), which meant real users hit raw 404s from the sidebar for anything not yet
// shipped. Re-add a key here the same slice its page.tsx lands — never before.
export type ModuleKey =
  | "tasks"
  | "performance"
  | "roadmap"
  | "calendar"
  | "hrRequests"
  | "hrApprovals"
  | "hrTimetable"
  | "hrReports";

export interface NavItem {
  key: ModuleKey;
  route: string;
  label: string;
  roles: readonly AppRole[];
}

const ALL_ROLES: readonly AppRole[] = [
  "super_admin",
  "centre_manager",
  "centre_admin",
  "sale_consultant",
  "teacher",
];

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "tasks", route: "/tasks", label: "Công việc", roles: ALL_ROLES },
  {
    key: "performance",
    route: "/hieu-suat",
    label: "Hiệu suất kinh doanh",
    roles: ["super_admin", "centre_manager", "centre_admin", "sale_consultant"],
  },
  {
    key: "roadmap",
    route: "/lo-trinh-ielts",
    label: "Lộ trình IELTS",
    roles: ["super_admin", "centre_manager", "centre_admin", "sale_consultant"],
  },
  { key: "calendar", route: "/calendar", label: "Lịch công việc", roles: ALL_ROLES },
  // US1 (T022): employee submit + "my requests", reachable by EVERY role. Deliberately a
  // top-level route, not a /nhan-su sub-path (that prefix is reserved for admin-only HR
  // management sub-routes below). The route-guard proof lives in tests/unit/hr/hr-nav.test.ts.
  {
    key: "hrRequests",
    route: "/yeu-cau",
    label: "Yêu cầu nhân sự",
    roles: ALL_ROLES,
  },
  // HR management sub-routes under the reserved /nhan-su area (slice #004; data-model §13).
  {
    key: "hrApprovals",
    route: "/nhan-su/duyet",
    label: "Duyệt yêu cầu nhân sự",
    roles: ["super_admin", "centre_manager"],
  },
  {
    key: "hrTimetable",
    route: "/nhan-su/lich-day",
    label: "Lịch dạy",
    roles: ["super_admin", "centre_manager", "centre_admin"],
  },
  // US8 (T060–T062, key hrReport.view): reporting surface — leave-by-employee/period, requests by
  // type/status, outstanding balances, coverage view (SC-007). Re-added now that its page.tsx exists
  // (see the note above this ModuleKey union — it was trimmed away as a placeholder in the 2026-07-20
  // nav cleanup and only comes back the same slice its route lands).
  {
    key: "hrReports",
    route: "/nhan-su/bao-cao",
    label: "Báo cáo nhân sự",
    roles: ["super_admin", "centre_manager"],
  },
];

/** Sidebar section grouping (design_handoff_jax_sales): "Chung" (general) vs "Nhân sự" (HR). Purely
 *  a display grouping — access control still comes from NAV_ITEMS.roles alone. */
export const NAV_GROUP_LABEL: Record<"chung" | "nhanSu", string> = {
  chung: "Chung",
  nhanSu: "Nhân sự",
};

export const NAV_ITEM_GROUP: Record<ModuleKey, keyof typeof NAV_GROUP_LABEL> = {
  tasks: "chung",
  performance: "chung",
  roadmap: "chung",
  calendar: "chung",
  hrRequests: "nhanSu",
  hrApprovals: "nhanSu",
  hrTimetable: "nhanSu",
  hrReports: "nhanSu",
};

/** Top-bar breadcrumb + page title per route (design_handoff_jax_sales) — derived from NAV_ITEMS'
 *  own labels, not a second hand-written copy. `route` is matched by prefix (handles /nhan-su/duyet
 *  vs the reserved /nhan-su prefix having no page of its own). */
export function pageMetaForRoute(pathname: string): { pageTitle: string; crumb: string } {
  const item = NAV_ITEMS.find((i) => pathname === i.route || pathname.startsWith(`${i.route}/`));
  if (!item) return { pageTitle: "", crumb: "" };
  const groupTitle = NAV_GROUP_LABEL[NAV_ITEM_GROUP[item.key]];
  return { pageTitle: item.label, crumb: `Trang chủ · ${groupTitle === "Chung" ? item.label : `${groupTitle} · ${item.label}`}` };
}

/** The nav items a role may see — same list that governs route access (FR-009). */
export function navItemsForRole(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

// ── Centre resolution ────────────────────────────────────────────────────────
/** Sentinel for the centre switcher's "whole network" selection. */
export const ALL_CENTRES = "all" as const;

export function isNetworkWideRole(role: AppRole): boolean {
  return NETWORK_WIDE_ROLES.includes(role);
}

/**
 * Resolve the effective centre for a read filter. Only network-wide roles may override; every
 * other role is pinned to its own centre regardless of any client-supplied value (spec FR-014/015).
 * Returns `undefined` to mean "whole network" (Toàn hệ thống).
 */
export function resolveEffectiveCentre(
  role: AppRole,
  userCentreId: string,
  switcherFilter?: string,
): string | undefined {
  if (isNetworkWideRole(role)) {
    if (switcherFilter === undefined || switcherFilter === ALL_CENTRES) return undefined;
    return switcherFilter;
  }
  return userCentreId;
}

/** Vietnamese label for the whole-network scope. */
export const ALL_CENTRES_LABEL = "Toàn hệ thống";
