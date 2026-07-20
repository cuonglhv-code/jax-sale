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

// ── Priority ─────────────────────────────────────────────────────────────────
export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: "Cao",
  MID: "Trung bình",
  LOW: "Thấp",
};

export const PRIORITY_COLOR: Record<Priority, BadgeColor> = {
  HIGH: { text: "var(--pri-high-text)", bg: "var(--pri-high-bg)", border: "var(--pri-high-border)" },
  MID: { text: "var(--pri-mid-text)", bg: "var(--pri-mid-bg)", border: "var(--pri-mid-border)" },
  LOW: { text: "var(--pri-low-text)", bg: "var(--pri-low-bg)", border: "var(--pri-low-border)" },
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
  not_set: { text: "var(--att-notset-text)", bg: "var(--att-notset-bg)", border: "var(--att-notset-border)" },
  on_track: { text: "var(--att-ontrack-text)", bg: "var(--att-ontrack-bg)", border: "var(--att-ontrack-border)" },
  behind: { text: "var(--att-behind-text)", bg: "var(--att-behind-bg)", border: "var(--att-behind-border)" },
  no_result: { text: "var(--att-noresult-text)", bg: "var(--att-noresult-bg)", border: "var(--att-noresult-border)" },
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

// ── Navigation = access matrix (ONE list; spec FR-009/024b) ───────────────────
// This is BOTH the sidebar definition AND the route-access matrix. Adding a future module = one
// entry here (no parallel list). Only `dashboard` and `tasks` have pages in this slice; the rest
// are reserved access-matrix entries whose pages arrive in later slices.
export type ModuleKey =
  | "dashboard"
  | "tasks"
  | "activities"
  | "leads"
  | "students"
  | "pathway"
  | "team"
  | "settings"
  | "personnel"
  | "workflows"
  | "performance"
  | "performanceActivity"
  | "roadmap"
  | "hrRequests"
  | "hrApprovals"
  | "hrTimetable"
  | "hrConfig"
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
  { key: "dashboard", route: "/dashboard", label: "Bảng điều khiển", roles: ALL_ROLES },
  { key: "tasks", route: "/tasks", label: "Công việc", roles: ALL_ROLES },
  { key: "activities", route: "/activities", label: "Hoạt động", roles: ALL_ROLES },
  {
    key: "leads",
    route: "/crm",
    label: "Tuyển sinh",
    roles: ["super_admin", "centre_manager", "centre_admin", "sale_consultant"],
  },
  { key: "students", route: "/students", label: "Học viên", roles: ALL_ROLES },
  { key: "pathway", route: "/lo-trinh", label: "Lộ trình", roles: ALL_ROLES },
  {
    key: "team",
    route: "/team",
    label: "Đội ngũ",
    roles: ["super_admin", "centre_manager", "centre_admin", "sale_consultant"],
  },
  {
    key: "settings",
    route: "/settings",
    label: "Cài đặt",
    roles: ["super_admin", "centre_manager", "centre_admin"],
  },
  {
    key: "personnel",
    route: "/nhan-su",
    label: "Quản trị nhân sự",
    roles: ["super_admin", "centre_manager"],
  },
  {
    key: "workflows",
    route: "/quy-trinh",
    label: "Quy trình tự động",
    roles: ["super_admin", "centre_manager"],
  },
  {
    key: "performance",
    route: "/hieu-suat",
    label: "Hiệu suất kinh doanh",
    roles: ["super_admin", "centre_manager", "centre_admin", "sale_consultant"],
  },
  {
    key: "performanceActivity",
    route: "/hoat-dong-kinh-doanh",
    label: "Nhật ký hoạt động",
    roles: ["super_admin", "centre_manager", "sale_consultant"],
  },
  {
    key: "roadmap",
    route: "/lo-trinh-ielts",
    label: "Lộ trình IELTS",
    roles: ["super_admin", "centre_manager", "centre_admin", "sale_consultant"],
  },
  // US1 (T022): employee submit + "my requests", reachable by EVERY role. Deliberately a NEW
  // top-level route, not a /nhan-su sub-path — the existing `personnel` entry above restricts
  // /nhan-su to super_admin/centre_manager, so a sub-path would (a) be hidden from every other
  // role's sidebar and (b) risk a page-file collision with slice-001's future personnel-management
  // landing at /nhan-su/page.tsx. The route-guard proof lives in tests/unit/hr/hr-nav.test.ts.
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
  {
    key: "hrConfig",
    route: "/nhan-su/cau-hinh",
    label: "Cấu hình nghỉ phép",
    roles: ["super_admin"],
  },
  {
    key: "hrReports",
    route: "/nhan-su/bao-cao",
    label: "Báo cáo nhân sự",
    roles: ["super_admin", "centre_manager"],
  },
];

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
