import type { TaskStatus } from "@/lib/data/types";

/**
 * Pure status-transition logic (⚙ research R3). Mirrors — but does not replace — the authoritative
 * `change_task_status` Postgres function; this module exists so the transition matrix (FR-020) is
 * unit-testable without a database. Automatic cycle TODO→DOING→DONE→TODO; explicit-only states
 * (BLOCK/RESCHEDULED/CANCELLED) are entered/left only by naming them and are never touched by the
 * automatic cycle.
 */

const AUTO_CYCLE: Partial<Record<TaskStatus, TaskStatus>> = {
  TODO: "DOING",
  DOING: "DONE",
  DONE: "TODO",
};

/** Next status in the automatic cycle, or `null` if `current` has no automatic exit (FR-020). */
export function nextAutoStatus(current: TaskStatus): TaskStatus | null {
  return AUTO_CYCLE[current] ?? null;
}

/**
 * Resolve the target status for a change request. `target` omitted → automatic cycle (throws if
 * `current` has no automatic exit, e.g. BLOCK). `target` given → that exact status (the only way
 * to enter/leave BLOCK/RESCHEDULED/CANCELLED).
 */
export function resolveTargetStatus(current: TaskStatus, target?: TaskStatus): TaskStatus {
  if (target === undefined) {
    const next = nextAutoStatus(current);
    if (next === null) {
      throw new Error(`Không thể tự động chuyển trạng thái từ ${current}`);
    }
    return next;
  }
  return target;
}
