import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, Task, TaskView } from "@/lib/data/types";
import type { ListTasksFilter, CreateTaskInput, AssignTaskInput, ChangeTaskStatusInput, ListEmployeesFilter } from "@/schemas/tasks";
import { resolveEffectiveCentre } from "@/lib/domain/vocabulary";
import { resolvePageSize, toRange, type Paginated } from "@/lib/pagination";
import { DomainError } from "@/lib/server-action";

interface TaskRow {
  id: string;
  centre_id: string;
  assignee_id: string;
  department_id: string;
  description: string;
  group: string;
  priority: string;
  deadline: string;
  status: string;
  source: string;
  note: string | null;
  created_by: string;
  created_at: string;
  assignee: { full_name: string } | null;
  department: { name: string } | null;
  centre: { name: string } | null;
  creator: { full_name: string } | null;
}

function toTaskView(row: TaskRow): TaskView {
  return {
    id: row.id,
    centreId: row.centre_id,
    assigneeId: row.assignee_id,
    departmentId: row.department_id,
    description: row.description,
    group: row.group as TaskView["group"],
    priority: row.priority as TaskView["priority"],
    deadline: row.deadline,
    status: row.status as TaskView["status"],
    source: row.source as TaskView["source"],
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    assigneeName: row.assignee?.full_name ?? "",
    departmentName: row.department?.name ?? "",
    centreName: row.centre?.name ?? "",
    createdByName: row.creator?.full_name ?? "",
  };
}

/**
 * Read entry point for the Tasks vertical (FR-016/017, SC-007/008a). Reads are broadly permitted
 * (FR-011) — gated only by `assertAuthenticated`, never a permission key. Effective centre is
 * resolved SERVER-SIDE via `resolveEffectiveCentre`; a teacher is always forced to their own
 * assigned tasks regardless of any client-supplied `mine` value (FR-017).
 */
export async function listTasksCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: ListTasksFilter,
): Promise<Paginated<TaskView>> {
  const effectiveCentre = resolveEffectiveCentre(claims.role, claims.centreId, filter.centreId);
  const mine = claims.role === "teacher" ? true : (filter.mine ?? false);

  const pageSize = resolvePageSize(filter.pageSize);
  const page = filter.page ?? 1;
  const { from, to } = toRange(page, pageSize);

  let query = supabase
    .from("tasks")
    .select(
      `id, centre_id, assignee_id, department_id, description, "group", priority, deadline, status, source, note, created_by, created_at,
       assignee:employees!tasks_assignee_id_fkey(full_name),
       department:departments!tasks_department_id_fkey(name),
       centre:centres!tasks_centre_id_fkey(name),
       creator:employees!tasks_created_by_fkey(full_name)`,
      { count: "exact" },
    );

  if (effectiveCentre !== undefined) {
    query = query.eq("centre_id", effectiveCentre);
  }
  if (mine) {
    query = query.eq("assignee_id", claims.employeeId);
  }
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.group) query = query.eq("group", filter.group);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    rows: ((data ?? []) as unknown as TaskRow[]).map(toTaskView),
    total: count ?? 0,
    page,
    pageSize,
  };
}

interface RawTaskRow {
  id: string;
  centre_id: string;
  assignee_id: string;
  department_id: string;
  description: string;
  group: string;
  priority: string;
  deadline: string;
  status: string;
  source: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

function toTask(row: RawTaskRow): Task {
  return {
    id: row.id,
    centreId: row.centre_id,
    assigneeId: row.assignee_id,
    departmentId: row.department_id,
    description: row.description,
    group: row.group as Task["group"],
    priority: row.priority as Task["priority"],
    deadline: row.deadline,
    status: row.status as Task["status"],
    source: row.source as Task["source"],
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * FR-018/019/022/024g: create a task via the atomic `create_task_with_log` Postgres function
 * (task + initial null→TODO log in one write), then record the `task.create` audit entry.
 * Assumes the caller already holds `task.create` (checked by the action, not here — this is pure
 * service logic per the canonical pipeline).
 */
export async function createTaskCore(
  supabase: SupabaseClient,
  _claims: Claims,
  input: CreateTaskInput,
): Promise<Task> {
  const { data, error } = await supabase.rpc("create_task_with_log", {
    p_assignee_id: input.assigneeId,
    p_department_id: input.departmentId,
    p_description: input.description,
    p_group: input.group,
    p_priority: input.priority,
    p_deadline: input.deadline,
    p_source: input.source,
    p_note: input.note ?? null,
  });

  if (error) throw new DomainError(error.message);
  const task = toTask(data as RawTaskRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "task.create",
    p_entity_type: "task",
    p_entity_id: task.id,
    p_metadata: null,
  });
  if (auditError) {
    // Accepted trade-off (constitution §6): a missing audit-log row is the only failure risk here,
    // never corrupted business data. Log server-side; do not fail the whole create.
    console.error("[audit] task.create failed to log", auditError);
  }

  return task;
}

/** FR-019: reassign a task, confined to the SAME centre as the task (§12 deliberate limitation). */
export async function assignTaskCore(
  supabase: SupabaseClient,
  _claims: Claims,
  input: AssignTaskInput,
): Promise<Task> {
  const { data, error } = await supabase.rpc("assign_task", {
    p_task_id: input.taskId,
    p_assignee_id: input.assigneeId,
  });

  if (error) throw new DomainError(error.message);
  const task = toTask(data as RawTaskRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "task.assign",
    p_entity_type: "task",
    p_entity_id: task.id,
    p_metadata: null,
  });
  if (auditError) {
    console.error("[audit] task.assign failed to log", auditError);
  }

  return task;
}

/**
 * FR-020/021: change a task's status via the atomic `change_task_status` Postgres function (status
 * update + status-log insert in one write; `target` omitted → automatic cycle). The function also
 * enforces the teacher-own-task scope check atomically with the write (US4 acceptance scenario 5)
 * — no separate log is written for a rejected attempt, since the whole transaction rolls back.
 * Distinct from the general audit seam (FR-024g): status changes are NOT also written to
 * `audit_log` — `task_status_logs` is their dedicated, complete history.
 */
export async function changeTaskStatusCore(
  supabase: SupabaseClient,
  _claims: Claims,
  input: ChangeTaskStatusInput,
): Promise<Task> {
  const { data, error } = await supabase.rpc("change_task_status", {
    p_task_id: input.taskId,
    p_target: input.target ?? null,
    p_note: input.note ?? null,
  });

  if (error) throw new DomainError(error.message);
  return toTask(data as RawTaskRow);
}

export interface EmployeeListRow {
  id: string;
  fullName: string;
  departmentId: string;
  departmentName: string;
  avatarColor: string;
}

interface EmployeeRow {
  id: string;
  full_name: string;
  department_id: string;
  avatar_color: string;
  department: { name: string } | null;
}

/** Active employees in centre scope, for the Daily Work view's per-employee grouping. Reads are
 *  broad (FR-011 pattern) — gated only by `assertAuthenticated`, never a permission key. */
export async function listEmployeesCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: ListEmployeesFilter,
): Promise<EmployeeListRow[]> {
  const effectiveCentre = resolveEffectiveCentre(claims.role, claims.centreId, filter.centreId);

  let query = supabase
    .from("employees")
    .select(
      `id, full_name, department_id, avatar_color,
       department:departments!employees_department_id_fkey(name)`,
    )
    .eq("is_active", true);

  if (effectiveCentre !== undefined) {
    query = query.eq("centre_id", effectiveCentre);
  }

  const { data, error } = await query.order("full_name");
  if (error) throw error;

  return ((data ?? []) as unknown as EmployeeRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    departmentId: row.department_id,
    departmentName: row.department?.name ?? "",
    avatarColor: row.avatar_color,
  }));
}
