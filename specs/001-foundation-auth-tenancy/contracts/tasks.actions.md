# Contract: Tasks Actions

Mutation entry points for the Tasks vertical. Every one follows the canonical pipeline:
`withError(() => { assertPermission(key); const input = schema.parse(raw); return service(...) })`.
Reads use `assertAuthenticated()` + RLS. Result shape: `{ data } | { error }`.

---

## Reads

### `listTasks(filter)` — read
- **Gate**: `assertAuthenticated()`.
- **Input** (Zod): `{ centreId?: uuid | "all", status?: TaskStatus, group?: TaskGroup, mine?: boolean, page?: int≥1, pageSize?: int }`.
- **Behavior**: returns `Paginated<TaskView>`. Effective centre resolved server-side via
  `resolveEffectiveCentre(role, userCentreId, filter.centreId)` — only `super_admin` may pass an
  override or `"all"`; every other role is pinned to own centre (FR-014/015). `teacher` is forced
  `mine = true` (own-assigned only, FR-017). No unbounded query (FR-026, SC-008a).
- **`TaskView`**: task fields + resolved assignee/department/centre names + creator.
- **Success criteria**: FR-016, FR-017, SC-005, SC-007, SC-008a.

## Writes

### `createTask(input)` — mutating
- **Gate**: `assertPermission("task.create")`.
- **Input** (Zod): `{ description: non-empty, assigneeId: uuid, departmentId: uuid, group: TaskGroup, priority: Priority, deadline: date, note?: string }`.
- **Behavior**: creates a Task in the **caller's own centre** (centre never taken from client —
  derived from claims); `assigneeId` MUST be an **active** employee of that centre (else reject,
  FR-019). Atomically writes the initial `TaskStatusLog` (`null → TODO`, FR-022) and an audit entry
  `task.create`. Refuses cross-centre assignment at the app layer **and** RLS refuses a cross-centre
  insert regardless (FR-019, FR-013).
- **Success criteria**: FR-018, FR-019, FR-022, FR-024g, SC-004a, SC-006.

### `assignTask(input)` — mutating
- **Gate**: `assertPermission("task.assign")`.
- **Input**: `{ taskId: uuid, assigneeId: uuid }`.
- **Behavior**: reassigns a task to another **active employee of the same centre** — same-centre-only
  by design (FR-019; deliberate limitation §12). Cross-centre reassignment rejected. Writes audit
  `task.assign`.
- **Success criteria**: FR-019, FR-024g, SC-004a.

### `changeTaskStatus(input)` — mutating
- **Gate**: `assertPermission("task.changeStatus")`.
- **Input**: `{ taskId: uuid, target?: TaskStatus, note?: string }`.
- **Behavior**: routed through the `change_task_status` **Postgres function** (atomic). If `target`
  omitted → automatic cycle `TODO→DOING→DONE→TODO`. If `target` given → validated explicit
  transition (BLOCK/RESCHEDULED/CANCELLED reachable only this way; auto-cycle never enters/leaves
  BLOCK). **Every** transition writes a `TaskStatusLog` (FR-021). Refused if the caller's scope
  doesn't permit changing this task (no log written on refusal).
- **Success criteria**: FR-020, FR-021, SC-004, SC-006.

---

### Permission keys used
`task.create`, `task.assign`, `task.changeStatus` — all registered in the single permission-key
registry (`permissions.ts`), mapped per role. Read access is not key-gated (RLS + `mine` handle
scope).

### Negative-path contract (permission-rejection tests — SC-001)
For each mutating action above, a caller whose role lacks the key MUST receive a `{ error }` and
cause **no** write — proven by test against the live local DB.
