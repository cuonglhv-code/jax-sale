/**
 * THE single permission-key registry (spec FR-024a). Maps each role → its permission-key set.
 * `assertPermission` reads from here. Adding a future module's capability = register new keys
 * here, without touching the permission-gate mechanism. `system.admin` is the catch-all grant.
 */

import type { AppRole } from "@/lib/data/types";

export const PERMISSION_KEYS = [
  "task.create",
  "task.assign",
  "task.changeStatus",
  "employee.deactivate",
  "employee.forceSignout",
  "roadmap.generate",
  "roadmap.send",
  "roadmap.audit",
  "personalKpi.recordActual",
  "personalKpi.approveActual",
  "personalKpi.setTarget",
  "departmentKpi.setTarget",
  // HR Requests (slice #004; data-model §13). own-only keys are app-checked at the service layer.
  "hrRequest.submit",
  "hrRequest.decide",
  "hrRequest.cancel",
  "cover.respond",
  "timetable.manage",
  "hrConfig.manage",
  "leaveBalance.adjust",
  "hrReport.view",
  "system.admin",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * Role → granted keys. `super_admin` holds only `system.admin` (the catch-all that satisfies any
 * check). Teacher can progress their own tasks (`task.changeStatus`) but cannot create/assign —
 * which makes the permission-rejection proof (SC-001) meaningful.
 */
const ROLE_GRANTS: Record<AppRole, readonly PermissionKey[]> = {
  super_admin: ["system.admin"],
  centre_manager: [
    "task.create",
    "task.assign",
    "task.changeStatus",
    "employee.deactivate",
    "employee.forceSignout",
    "roadmap.generate",
    "roadmap.send",
    "roadmap.audit",
    "personalKpi.approveActual",
    "personalKpi.setTarget",
    "hrRequest.submit",
    "hrRequest.decide",
    "hrRequest.cancel",
    "cover.respond",
    "timetable.manage",
    "hrReport.view",
  ],
  centre_admin: [
    "task.create",
    "task.assign",
    "task.changeStatus",
    "roadmap.generate",
    "roadmap.send",
    "roadmap.audit",
    "personalKpi.approveActual",
    "personalKpi.setTarget",
    "hrRequest.submit",
    "hrRequest.cancel",
    "cover.respond",
    "timetable.manage",
  ],
  sale_consultant: [
    "task.create",
    "task.assign",
    "task.changeStatus",
    "roadmap.generate",
    "roadmap.send",
    "personalKpi.recordActual",
    "hrRequest.submit",
    "hrRequest.cancel",
    "cover.respond",
  ],
  teacher: ["task.changeStatus", "hrRequest.submit", "hrRequest.cancel", "cover.respond"],
};

/** True if the role holds `key` (or the `system.admin` catch-all). */
export function roleHasPermission(role: AppRole, key: PermissionKey): boolean {
  const grants = ROLE_GRANTS[role];
  return grants.includes("system.admin") || grants.includes(key);
}

export function grantsForRole(role: AppRole): readonly PermissionKey[] {
  return ROLE_GRANTS[role];
}
