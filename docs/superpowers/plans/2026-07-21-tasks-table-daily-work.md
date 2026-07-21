# Tasks Page Redesign: Table + Daily Work Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/tasks` Kanban board with a dense sortable Task Table (click-to-cycle status) and a per-employee Daily Work checklist, switchable via tabs.

**Architecture:** Pure presentation-layer replacement. The existing `TaskView` data model, `task-status.ts` transition logic, `useChangeTaskStatus` mutation, and `TASK_STATUS_LABEL`/`PRIORITY_LABEL`/`PRIORITY_COLOR`/`TASK_GROUP_LABEL`/`TASK_GROUP_COLOR`/`TASK_STATUS_COLOR` vocabulary are all reused unchanged. One new read-only server action + service function + hook (`listEmployees`) backs the Daily Work view, following the exact layering convention every other slice uses. `KanbanColumns.tsx` is deleted; `TaskCard.tsx` is kept (still used by the existing exited-status list).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Supabase (`@supabase/ssr`), TanStack Query, Zod, Vitest.

## Global Constraints

- Every mutating server action wraps its body in `withError` from `src/lib/server-action.ts`; every action authenticates via `assertAuthenticated`/`assertPermission` from `src/lib/auth/assert-permission.ts` — never trust client-supplied `centreId`/role.
- Centre-scoping for network-wide roles (`super_admin`) always goes through `resolveEffectiveCentre(role, callerCentreId, requestedCentreId)` from `src/lib/domain/vocabulary.ts` — never hand-roll centre filtering.
- No raw enum id ever renders in the UI — always go through the `*_LABEL`/`*_COLOR` maps in `src/lib/domain/vocabulary.ts`.
- DB columns are `snake_case`; app/TS shapes are `camelCase` — conversion happens only at the service boundary (see `toTaskView` in `src/services/task.service.ts` for the pattern).
- Tests require a running local Supabase stack (`npm run db:start`) and sign in as real seeded users via `tests/helpers/auth.ts` (`signInAs`, `SEEDED_USERS`) — no mocking.
- `vitest.config.ts` forces `fileParallelism: false` — integration tests share live DB state sequentially; do not parallelize.
- Follow TDD: write the failing test, watch it fail, implement minimally, watch it pass, commit.

---

### Task 1: `listEmployees` service function + schema + server action

**Files:**
- Modify: `src/schemas/tasks.ts` — add `listEmployeesFilterSchema`.
- Modify: `src/services/task.service.ts` — add `listEmployeesCore`.
- Create: `src/app/actions/tasks/list-employees.ts`.
- Test: `tests/integration/tasks.list-employees.test.ts`.

**Interfaces:**
- Consumes: `Claims` (`src/lib/data/types.ts:131`, fields `authUserId, role, centreId, employeeId`), `resolveEffectiveCentre(role: AppRole, userCentreId: string, switcherFilter?: string): string | undefined` (`src/lib/domain/vocabulary.ts:332`), `withError<T>(fn: () => Promise<T>): Promise<ActionResult<T>>` (`src/lib/server-action.ts:54`), `assertAuthenticated(supabase): Promise<Claims>` (`src/lib/auth/assert-permission.ts:20`), `ALL_CENTRES = "all"` (`src/lib/domain/vocabulary.ts:321`).
- Produces: `EmployeeListRow` type — `{ id: string; fullName: string; departmentId: string; departmentName: string; avatarColor: string }`. `listEmployeesCore(supabase, claims, filter: ListEmployeesFilter): Promise<EmployeeListRow[]>`. `listEmployees(raw: unknown): Promise<ActionResult<EmployeeListRow[]>>`. `ListEmployeesFilter = { centreId?: string }` (parsed by `listEmployeesFilterSchema`). Task 4 (`useEmployees` hook) consumes `listEmployees` and `EmployeeListRow`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/tasks.list-employees.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { listEmployeesCore } from "@/services/task.service";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, SEED_CENTRE_Q1, SEED_CENTRE_Q3 } from "../helpers/auth";

describe("tasks: listEmployeesCore", () => {
  it("scopes to the caller's own centre for a non-network-wide role", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertAuthenticated(client);

    const rows = await listEmployeesCore(client, claims, {});

    expect(rows.length).toBeGreaterThan(0);
    // every returned row must resolve (via RLS) to Q1 — proven indirectly: the same query run as
    // a Q3 user must NOT return the same ids as this one.
    const q1Ids = new Set(rows.map((r) => r.id));

    const q3Client = await signInAs(SEEDED_USERS.managerQ3);
    const q3Claims = await assertAuthenticated(q3Client);
    const q3Rows = await listEmployeesCore(q3Client, q3Claims, {});

    for (const r of q3Rows) {
      expect(q1Ids.has(r.id)).toBe(false);
    }
  });

  it("returns fullName, departmentId, departmentName, avatarColor for each row", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertAuthenticated(client);

    const rows = await listEmployeesCore(client, claims, {});

    expect(rows[0]).toMatchObject({
      id: expect.any(String),
      fullName: expect.any(String),
      departmentId: expect.any(String),
      departmentName: expect.any(String),
      avatarColor: expect.any(String),
    });
  });

  it("super_admin sees network-wide employees when centreId is omitted", async () => {
    const client = await signInAs(SEEDED_USERS.superAdmin);
    const claims = await assertAuthenticated(client);

    const all = await listEmployeesCore(client, claims, {});
    const q1Only = await listEmployeesCore(client, claims, { centreId: SEED_CENTRE_Q1 });
    const q3Only = await listEmployeesCore(client, claims, { centreId: SEED_CENTRE_Q3 });

    expect(all.length).toBeGreaterThanOrEqual(q1Only.length + q3Only.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:start` (if not already running), then `npx vitest run tests/integration/tasks.list-employees.test.ts`
Expected: FAIL — `listEmployeesCore` is not exported from `@/services/task.service`.

- [ ] **Step 3: Add the schema**

In `src/schemas/tasks.ts`, add after `listTasksFilterSchema`:

```typescript
export const listEmployeesFilterSchema = z.object({
  centreId: z.string().optional(), // uuid or the "all" sentinel (super_admin only — enforced server-side)
});
export type ListEmployeesFilter = z.infer<typeof listEmployeesFilterSchema>;
```

- [ ] **Step 4: Add `listEmployeesCore` to the service**

In `src/services/task.service.ts`, add the import and function:

```typescript
import type { ListTasksFilter, CreateTaskInput, AssignTaskInput, ChangeTaskStatusInput, ListEmployeesFilter } from "@/schemas/tasks";
```

Append at the end of the file:

```typescript
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
```

Note: `employees_department_id_fkey` is Postgres's auto-generated constraint name for the inline `department_id uuid not null references public.departments (id)` column in `supabase/migrations/20260716120001_schema.sql:28` — verified, no explicit constraint name was set, so the default `<table>_<column>_fkey` pattern applies.

- [ ] **Step 5: Run test to verify it still fails (schema/service done, action missing)**

Run: `npx vitest run tests/integration/tasks.list-employees.test.ts`
Expected: still FAIL if the test imports `listEmployeesCore` correctly it should now PASS at the service layer — re-run and confirm. If it passes, proceed to Step 6 for the action layer (not exercised by this test, but required by Task 4's hook).

- [ ] **Step 6: Add the server action**

Create `src/app/actions/tasks/list-employees.ts`:

```typescript
"use server";

import { listEmployeesFilterSchema } from "@/schemas/tasks";
import { listEmployeesCore, type EmployeeListRow } from "@/services/task.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

/** Read entry point for the Daily Work view's employee list — reads are broad (FR-011 pattern). */
export async function listEmployees(raw: unknown): Promise<ActionResult<EmployeeListRow[]>> {
  return withError(async () => {
    const filter = listEmployeesFilterSchema.parse(raw);
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    return listEmployeesCore(supabase, claims, filter);
  });
}
```

- [ ] **Step 7: Run the full test file to verify all three cases pass**

Run: `npx vitest run tests/integration/tasks.list-employees.test.ts -v`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add src/schemas/tasks.ts src/services/task.service.ts src/app/actions/tasks/list-employees.ts tests/integration/tasks.list-employees.test.ts
git commit -m "feat(tasks): add listEmployees service/action for Daily Work view"
```

---

### Task 2: `useEmployees` query hook

**Files:**
- Create: `src/hooks/queries/useEmployees.ts`.

**Interfaces:**
- Consumes: `listEmployees(raw: unknown): Promise<ActionResult<EmployeeListRow[]>>` (Task 1), `ListEmployeesFilter` (Task 1, `src/schemas/tasks.ts`).
- Produces: `useEmployees(filter: ListEmployeesFilter)` — TanStack Query hook returning `{ data: EmployeeListRow[] | undefined, isLoading, error }`. `employeesQueryKeys` factory. Task 5 (`DailyWorkView`) consumes this hook.

This hook has no independent business logic to unit-test (it mirrors `useTasks.ts` exactly) — no test step; correctness is verified end-to-end in Task 6's manual verification and covered indirectly by Task 1's integration test on the underlying service.

- [ ] **Step 1: Write the hook**

Create `src/hooks/queries/useEmployees.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { listEmployees } from "@/app/actions/tasks/list-employees";
import type { ListEmployeesFilter } from "@/schemas/tasks";

/** Query-key factory, mirrors useTasks.ts. */
export const employeesQueryKeys = {
  all: ["employees"] as const,
  list: (filter: ListEmployeesFilter) => [...employeesQueryKeys.all, "list", filter] as const,
};

export function useEmployees(filter: ListEmployeesFilter) {
  return useQuery({
    queryKey: employeesQueryKeys.list(filter),
    queryFn: async () => {
      const result = await listEmployees(filter);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/queries/useEmployees.ts
git commit -m "feat(tasks): add useEmployees query hook"
```

---

### Task 3: `TaskViewTabs` component

**Files:**
- Create: `src/app/(app)/tasks/TaskViewTabs.tsx`.

**Interfaces:**
- Consumes: nothing external — pure presentational component.
- Produces: `TaskBoardView = "table" | "daily"` type, `TaskViewTabs({ active, onChange }: { active: TaskBoardView; onChange: (view: TaskBoardView) => void })`. Task 6 (`TasksBoard.tsx`) consumes both.

- [ ] **Step 1: Write the component**

Create `src/app/(app)/tasks/TaskViewTabs.tsx`:

```tsx
export type TaskBoardView = "table" | "daily";

const TABS: { key: TaskBoardView; label: string }[] = [
  { key: "table", label: "Bảng" },
  { key: "daily", label: "Theo người" },
];

/** View switcher for the Tasks page — replaces the old Kanban board with Table/Daily Work views. */
export function TaskViewTabs({
  active,
  onChange,
}: {
  active: TaskBoardView;
  onChange: (view: TaskBoardView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`h-[30px] rounded-md px-3 text-[12.5px] font-semibold transition-colors ${
              isActive ? "bg-surface text-navy shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/tasks/TaskViewTabs.tsx"
git commit -m "feat(tasks): add TaskViewTabs view switcher"
```

---

### Task 4: Pure sort helper for the Task Table (TDD unit)

**Files:**
- Create: `src/services/task-sort.ts`.
- Test: `tests/unit/task-sort.test.ts`.

**Interfaces:**
- Consumes: `TaskView` (`src/lib/data/types.ts:99`), `Priority` (`src/lib/data/types.ts:38`, values `"HIGH" | "MID" | "LOW"`).
- Produces: `type TaskSortKey = "deadline" | "priority"`, `type SortDirection = "asc" | "desc"`, `sortTasks(rows: TaskView[], key: TaskSortKey, direction: SortDirection): TaskView[]` (pure, non-mutating — returns a new array). Task 7 (`TaskTable.tsx`) consumes this.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/task-sort.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sortTasks } from "@/services/task-sort";
import type { TaskView } from "@/lib/data/types";

function makeTask(overrides: Partial<TaskView>): TaskView {
  return {
    id: "id",
    centreId: "c1",
    assigneeId: "a1",
    departmentId: "d1",
    description: "desc",
    group: "KHAC",
    priority: "MID",
    deadline: "2026-01-01",
    status: "TODO",
    source: "SELF_CREATED",
    note: null,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    assigneeName: "A",
    departmentName: "D",
    centreName: "C",
    createdByName: "U",
    ...overrides,
  };
}

describe("task-sort: sortTasks", () => {
  it("sorts by deadline ascending", () => {
    const rows = [
      makeTask({ id: "1", deadline: "2026-03-01" }),
      makeTask({ id: "2", deadline: "2026-01-01" }),
      makeTask({ id: "3", deadline: "2026-02-01" }),
    ];
    const sorted = sortTasks(rows, "deadline", "asc");
    expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by deadline descending", () => {
    const rows = [
      makeTask({ id: "1", deadline: "2026-03-01" }),
      makeTask({ id: "2", deadline: "2026-01-01" }),
    ];
    const sorted = sortTasks(rows, "deadline", "desc");
    expect(sorted.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("sorts by priority HIGH > MID > LOW ascending means HIGH first", () => {
    const rows = [
      makeTask({ id: "1", priority: "LOW" }),
      makeTask({ id: "2", priority: "HIGH" }),
      makeTask({ id: "3", priority: "MID" }),
    ];
    const sorted = sortTasks(rows, "priority", "asc");
    expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("does not mutate the input array", () => {
    const rows = [makeTask({ id: "1", deadline: "2026-03-01" }), makeTask({ id: "2", deadline: "2026-01-01" })];
    const original = [...rows];
    sortTasks(rows, "deadline", "asc");
    expect(rows).toEqual(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/task-sort.test.ts`
Expected: FAIL — `Cannot find module '@/services/task-sort'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/task-sort.ts`:

```typescript
import type { TaskView, Priority } from "@/lib/data/types";

export type TaskSortKey = "deadline" | "priority";
export type SortDirection = "asc" | "desc";

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MID: 1, LOW: 2 };

/** Pure, non-mutating sort for the Task Table view. */
export function sortTasks(rows: TaskView[], key: TaskSortKey, direction: SortDirection): TaskView[] {
  const sorted = [...rows].sort((a, b) => {
    const cmp =
      key === "deadline"
        ? a.deadline.localeCompare(b.deadline)
        : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/task-sort.test.ts -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/task-sort.ts tests/unit/task-sort.test.ts
git commit -m "feat(tasks): add pure sortTasks helper for the Task Table view"
```

---

### Task 5: `TaskTable` component

**Files:**
- Create: `src/app/(app)/tasks/TaskTable.tsx`.

**Interfaces:**
- Consumes: `TaskView` (`src/lib/data/types.ts:99`), `sortTasks(rows, key, direction)` + `TaskSortKey` + `SortDirection` (Task 4, `@/services/task-sort`), `nextAutoStatus(current: TaskStatus): TaskStatus | null` (`src/services/task-status.ts:18`), `useChangeTaskStatus()` (`src/hooks/mutations/useChangeTaskStatus.ts` — `.mutate({ taskId: string, target?: TaskStatus })`, `.isPending`, `.isError`, `.error`), `TASK_STATUS_LABEL`, `TASK_STATUS_COLOR`, `PRIORITY_LABEL`, `PRIORITY_COLOR`, `TASK_GROUP_LABEL`, `TASK_GROUP_COLOR` (all `@/lib/domain/vocabulary`), `TASK_STATUSES` (`@/lib/data/types`, for the explicit-target dropdown), `initials(name: string): string` (`@/lib/format` — shared avatar-chip helper, extracted from `TaskCard.tsx` in a prerequisite commit before this task; do NOT redefine it locally).
- Produces: `TaskTable({ rows }: { rows: TaskView[] })`. Task 8 (`TasksBoard.tsx`) consumes this.

No new business logic beyond what Task 4 already covers with unit tests and what `TaskCard.tsx`'s existing `isOverdue` helper (and the shared `initials` from `@/lib/format`) already prove — this component is presentational wiring, verified manually in Task 8's end-to-end check plus `npm run typecheck`/`npm run lint`.

- [ ] **Step 1: Write the component**

Create `src/app/(app)/tasks/TaskTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useChangeTaskStatus } from "@/hooks/mutations/useChangeTaskStatus";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_COLOR,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  TASK_GROUP_LABEL,
  TASK_GROUP_COLOR,
} from "@/lib/domain/vocabulary";
import { TASK_STATUSES } from "@/lib/data/types";
import type { TaskView, TaskStatus } from "@/lib/data/types";
import { nextAutoStatus } from "@/services/task-status";
import { sortTasks, type TaskSortKey, type SortDirection } from "@/services/task-sort";
import { initials } from "@/lib/format";

function isOverdue(deadline: string, status: TaskStatus): boolean {
  if (status === "DONE") return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

function StatusPill({ task }: { task: TaskView }) {
  const changeStatus = useChangeTaskStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const color = TASK_STATUS_COLOR[task.status];
  const next = nextAutoStatus(task.status);

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        disabled={changeStatus.isPending || next === null}
        onClick={() => next && changeStatus.mutate({ taskId: task.id })}
        title={next ? `Chuyển sang ${TASK_STATUS_LABEL[next]}` : "Không thể tự động chuyển trạng thái"}
        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px] disabled:cursor-not-allowed"
        style={{ color: color.text, background: color.bg, borderColor: color.border }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
        {TASK_STATUS_LABEL[task.status]}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="text-text-faint hover:text-text-muted"
        aria-label="Chọn trạng thái khác"
      >
        ⋯
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 flex flex-col rounded-md border border-border bg-surface py-1 shadow-md">
          {TASK_STATUSES.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                changeStatus.mutate({ taskId: task.id, target: s });
                setMenuOpen(false);
              }}
              className="whitespace-nowrap px-3 py-1 text-left text-[12px] text-text hover:bg-surface-3"
            >
              {TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      {changeStatus.isError && <p className="text-[11px] text-red">{(changeStatus.error as Error).message}</p>}
    </div>
  );
}

/** Dense sortable task table — replaces the Kanban board (superpowers brainstorm 2026-07-21). */
export function TaskTable({ rows }: { rows: TaskView[] }) {
  const [sortKey, setSortKey] = useState<TaskSortKey>("deadline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sorted = sortTasks(rows, sortKey, sortDirection);

  function toggleSort(key: TaskSortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <table className="min-w-[900px] w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="px-3 py-2 font-semibold">Trạng thái</th>
            <th
              className="cursor-pointer px-3 py-2 font-semibold"
              onClick={() => toggleSort("priority")}
            >
              Ưu tiên {sortKey === "priority" && (sortDirection === "asc" ? "↑" : "↓")}
            </th>
            <th className="px-3 py-2 font-semibold">Nhóm</th>
            <th className="px-3 py-2 font-semibold">Công việc</th>
            <th className="px-3 py-2 font-semibold">Người phụ trách</th>
            <th className="px-3 py-2 font-semibold">Bộ phận</th>
            <th
              className="cursor-pointer px-3 py-2 font-semibold"
              onClick={() => toggleSort("deadline")}
            >
              Hạn {sortKey === "deadline" && (sortDirection === "asc" ? "↑" : "↓")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task, i) => {
            const overdue = isOverdue(task.deadline, task.status);
            const priorityColor = PRIORITY_COLOR[task.priority];
            return (
              <tr
                key={task.id}
                className={`border-b border-border ${i % 2 === 0 ? "bg-surface" : "bg-surface-2"}`}
              >
                <td className="px-3 py-[9px]">
                  <StatusPill task={task} />
                </td>
                <td className="px-3 py-[9px]">
                  <span
                    className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold"
                    style={{ color: priorityColor.text, background: priorityColor.bg, borderColor: priorityColor.border }}
                  >
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </td>
                <td className="px-3 py-[9px]">
                  <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-text-muted">
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: TASK_GROUP_COLOR[task.group] }} />
                    {TASK_GROUP_LABEL[task.group]}
                  </span>
                </td>
                <td className="px-3 py-[9px] font-medium text-text">{task.description}</td>
                <td className="px-3 py-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[10.5px] font-bold text-navy">
                      {initials(task.assigneeName)}
                    </span>
                    <span className="text-text-muted">{task.assigneeName}</span>
                  </div>
                </td>
                <td className="px-3 py-[9px] text-text-muted">{task.departmentName}</td>
                <td className="px-3 py-[9px]">
                  <span style={{ color: overdue ? "var(--color-red)" : "var(--color-text-muted)" }}>
                    {new Date(task.deadline).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-text-faint">
                Không có công việc phù hợp bộ lọc
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/tasks/TaskTable.tsx"
git commit -m "feat(tasks): add sortable TaskTable view with click-to-cycle status"
```

---

### Task 6: Pure grouping helper for Daily Work (TDD unit)

**Files:**
- Create: `src/services/daily-work.ts`.
- Test: `tests/unit/daily-work.test.ts`.

**Interfaces:**
- Consumes: `TaskView` (`src/lib/data/types.ts:99`), `EmployeeListRow` (Task 1, `@/services/task.service`).
- Produces: `interface DailyEmployeeGroup { employee: EmployeeListRow; tasksToday: TaskView[]; doneCount: number; totalCount: number }`, `groupTasksByEmployeeForToday(employees: EmployeeListRow[], tasks: TaskView[], today: string): DailyEmployeeGroup[]` (pure; `today` is an injected ISO date string `YYYY-MM-DD` so the function stays deterministic/testable — the caller passes `new Date().toISOString().slice(0, 10)`). Task 7 (`DailyWorkView.tsx`) consumes this.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/daily-work.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { groupTasksByEmployeeForToday } from "@/services/daily-work";
import type { TaskView } from "@/lib/data/types";
import type { EmployeeListRow } from "@/services/task.service";

function makeEmployee(overrides: Partial<EmployeeListRow>): EmployeeListRow {
  return { id: "e1", fullName: "Nguyễn Văn A", departmentId: "d1", departmentName: "Giảng dạy", avatarColor: "#000", ...overrides };
}

function makeTask(overrides: Partial<TaskView>): TaskView {
  return {
    id: "t1", centreId: "c1", assigneeId: "e1", departmentId: "d1", description: "desc",
    group: "KHAC", priority: "MID", deadline: "2026-07-21", status: "TODO", source: "SELF_CREATED",
    note: null, createdBy: "u1", createdAt: "2026-07-21T00:00:00Z", assigneeName: "Nguyễn Văn A",
    departmentName: "D", centreName: "C", createdByName: "U", ...overrides,
  };
}

describe("daily-work: groupTasksByEmployeeForToday", () => {
  it("groups only today's tasks under each employee", () => {
    const employees = [makeEmployee({ id: "e1" })];
    const tasks = [
      makeTask({ id: "t1", assigneeId: "e1", deadline: "2026-07-21" }),
      makeTask({ id: "t2", assigneeId: "e1", deadline: "2026-07-22" }), // not today
    ];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups).toHaveLength(1);
    expect(groups[0].tasksToday.map((t) => t.id)).toEqual(["t1"]);
  });

  it("includes employees with zero tasks today", () => {
    const employees = [makeEmployee({ id: "e1" }), makeEmployee({ id: "e2", fullName: "B" })];
    const tasks = [makeTask({ id: "t1", assigneeId: "e1", deadline: "2026-07-21" })];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups).toHaveLength(2);
    const e2Group = groups.find((g) => g.employee.id === "e2");
    expect(e2Group?.tasksToday).toEqual([]);
    expect(e2Group?.totalCount).toBe(0);
  });

  it("computes doneCount/totalCount for today's tasks", () => {
    const employees = [makeEmployee({ id: "e1" })];
    const tasks = [
      makeTask({ id: "t1", assigneeId: "e1", deadline: "2026-07-21", status: "DONE" }),
      makeTask({ id: "t2", assigneeId: "e1", deadline: "2026-07-21", status: "TODO" }),
      makeTask({ id: "t3", assigneeId: "e1", deadline: "2026-07-21", status: "DOING" }),
    ];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups[0].doneCount).toBe(1);
    expect(groups[0].totalCount).toBe(3);
  });

  it("ignores tasks whose assignee is not in the employees list", () => {
    const employees = [makeEmployee({ id: "e1" })];
    const tasks = [makeTask({ id: "t1", assigneeId: "unknown-employee", deadline: "2026-07-21" })];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups[0].tasksToday).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/daily-work.test.ts`
Expected: FAIL — `Cannot find module '@/services/daily-work'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/daily-work.ts`:

```typescript
import type { TaskView } from "@/lib/data/types";
import type { EmployeeListRow } from "@/services/task.service";

export interface DailyEmployeeGroup {
  employee: EmployeeListRow;
  tasksToday: TaskView[];
  doneCount: number;
  totalCount: number;
}

/** Pure grouping for the Daily Work view. `today` is injected (ISO `YYYY-MM-DD`) to keep this
 *  testable without mocking the system clock. */
export function groupTasksByEmployeeForToday(
  employees: EmployeeListRow[],
  tasks: TaskView[],
  today: string,
): DailyEmployeeGroup[] {
  return employees.map((employee) => {
    const tasksToday = tasks.filter((t) => t.assigneeId === employee.id && t.deadline === today);
    const doneCount = tasksToday.filter((t) => t.status === "DONE").length;
    return { employee, tasksToday, doneCount, totalCount: tasksToday.length };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/daily-work.test.ts -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/daily-work.ts tests/unit/daily-work.test.ts
git commit -m "feat(tasks): add pure groupTasksByEmployeeForToday helper for Daily Work view"
```

---

### Task 7: `DailyWorkView` component

**Files:**
- Create: `src/app/(app)/tasks/DailyWorkView.tsx`.

**Interfaces:**
- Consumes: `useEmployees(filter: ListEmployeesFilter)` (Task 2, `@/hooks/queries/useEmployees` — returns `{ data: EmployeeListRow[] | undefined, isLoading, error }`), `groupTasksByEmployeeForToday(employees, tasks, today)` + `DailyEmployeeGroup` (Task 6, `@/services/daily-work`), `TASK_STATUS_LABEL`, `TASK_STATUS_COLOR` (`@/lib/domain/vocabulary`), `TaskView` (`@/lib/data/types`), `initials(name: string): string` (`@/lib/format` — shared avatar-chip helper; do NOT redefine it locally).
- Produces: `DailyWorkView({ rows, centreId }: { rows: TaskView[]; centreId?: string })`. Task 8 (`TasksBoard.tsx`) consumes this.

- [ ] **Step 1: Write the component**

Create `src/app/(app)/tasks/DailyWorkView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useEmployees } from "@/hooks/queries/useEmployees";
import { groupTasksByEmployeeForToday } from "@/services/daily-work";
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from "@/lib/domain/vocabulary";
import { initials } from "@/lib/format";
import type { TaskView } from "@/lib/data/types";

/** Per-employee "who's on track today" checklist (superpowers brainstorm 2026-07-21). */
export function DailyWorkView({ rows, centreId }: { rows: TaskView[]; centreId?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: employees, isLoading, error } = useEmployees(centreId ? { centreId } : {});
  const today = new Date().toISOString().slice(0, 10);

  if (isLoading) return <p className="text-text-muted">Đang tải...</p>;
  if (error) return <p className="text-red">{error.message}</p>;

  const groups = groupTasksByEmployeeForToday(employees ?? [], rows, today);

  if (groups.length === 0) {
    return <p className="text-text-muted">Không có nhân sự phù hợp.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((group) => {
        const pct = group.totalCount === 0 ? 0 : Math.round((group.doneCount / group.totalCount) * 100);
        const isExpanded = expandedId === group.employee.id;
        return (
          <div key={group.employee.id} className="rounded-[var(--radius-panel)] border border-border bg-surface-2">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : group.employee.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: group.employee.avatarColor }}
              >
                {initials(group.employee.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13px] font-semibold text-text">{group.employee.fullName}</p>
                <p className="m-0 text-[11.5px] text-text-muted">{group.employee.departmentName}</p>
              </div>
              <div className="flex w-32 shrink-0 flex-col items-end gap-1">
                <span className="text-[11.5px] font-medium text-text-muted">
                  {group.doneCount}/{group.totalCount} hoàn thành
                </span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="flex flex-col gap-1.5 border-t border-border px-4 py-3">
                {group.tasksToday.length === 0 && (
                  <p className="m-0 text-[12px] text-text-faint">Không có công việc nào hôm nay.</p>
                )}
                {group.tasksToday.map((task) => {
                  const color = TASK_STATUS_COLOR[task.status];
                  return (
                    <div key={task.id} className="flex items-center gap-2 text-[12.5px]">
                      <span
                        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11px] font-semibold"
                        style={{ color: color.text, background: color.bg, borderColor: color.border }}
                      >
                        {TASK_STATUS_LABEL[task.status]}
                      </span>
                      <span className="text-text">{task.description}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/tasks/DailyWorkView.tsx"
git commit -m "feat(tasks): add DailyWorkView per-employee checklist"
```

---

### Task 8: Wire views into `TasksBoard`, delete `KanbanColumns`

**Files:**
- Modify: `src/app/(app)/tasks/TasksBoard.tsx`.
- Delete: `src/app/(app)/tasks/KanbanColumns.tsx`.

**Interfaces:**
- Consumes: `TaskViewTabs` + `TaskBoardView` (Task 3), `TaskTable` (Task 5), `DailyWorkView` (Task 7) — all from `./` relative imports within `src/app/(app)/tasks/`.
- Produces: nothing further downstream — this is the final integration point.

- [ ] **Step 1: Edit `TasksBoard.tsx`**

Current relevant section (`src/app/(app)/tasks/TasksBoard.tsx`, full file shown for context — modify as follows):

Replace the imports block:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTasks } from "@/hooks/queries/useTasks";
import { ALL_CENTRES, isNetworkWideRole } from "@/lib/domain/vocabulary";
import type { AppRole, TaskStatus, TaskView } from "@/lib/data/types";
import { CreateTaskDrawer } from "./CreateTaskDrawer";
import { TaskFilters } from "./TaskFilters";
import { TaskTable } from "./TaskTable";
import { DailyWorkView } from "./DailyWorkView";
import { TaskViewTabs, type TaskBoardView } from "./TaskViewTabs";
import { TaskCard } from "./TaskCard";
```

Remove the now-unused `groupByStatus` function entirely (it was only used by the deleted `KanbanColumns`):

```tsx
// DELETE this whole function:
// function groupByStatus(rows: TaskView[]): Record<TaskStatus, TaskView[]> { ... }
```

Inside the `TasksBoard` component, add view state after the existing `useState` calls:

```tsx
const [view, setView] = useState<TaskBoardView>("table");
```

Replace the `columns` memo and the render section. Remove:

```tsx
// DELETE:
// const columns = useMemo(() => groupByStatus(filteredRows), [filteredRows]);
```

Replace the return block's board section:

```tsx
  return (
    <div className="flex flex-col gap-[18px] px-6 py-5 pb-7">
      <div className="flex items-center gap-3">
        <TaskViewTabs active={view} onChange={setView} />
      </div>

      <TaskFilters
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        search={search}
        onSearchChange={setSearch}
        exitedFilter={exitedFilter}
        onExitedFilterChange={setExitedFilter}
        visibleCount={filteredRows.length}
        totalCount={data?.rows.length ?? 0}
        onOpenCreate={() => setCreateOpen(true)}
      />

      {isLoading && <p className="text-text-muted">Đang tải...</p>}
      {error && <p className="text-red">{error.message}</p>}

      {data && !exitedFilter && view === "table" && <TaskTable rows={filteredRows} />}
      {data && !exitedFilter && view === "daily" && (
        <DailyWorkView rows={filteredRows} centreId={showSwitcher ? centreId : undefined} />
      )}

      {data && exitedFilter && (
        <div className="flex flex-col gap-2">
          {filteredRows.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {filteredRows.length === 0 && <p className="text-text-muted">Không có công việc nào.</p>}
        </div>
      )}

      <CreateTaskDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} departments={departments} />
    </div>
  );
}
```

Full resulting file should read:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTasks } from "@/hooks/queries/useTasks";
import { ALL_CENTRES, isNetworkWideRole } from "@/lib/domain/vocabulary";
import type { AppRole } from "@/lib/data/types";
import { CreateTaskDrawer } from "./CreateTaskDrawer";
import { TaskFilters } from "./TaskFilters";
import { TaskTable } from "./TaskTable";
import { DailyWorkView } from "./DailyWorkView";
import { TaskViewTabs, type TaskBoardView } from "./TaskViewTabs";
import { TaskCard } from "./TaskCard";

interface DepartmentOption {
  id: string;
  name: string;
}

/** Centre scope now comes from the shell's `?centre=` param (CentreSwitcher, layout.tsx) rather
 *  than a page-local dropdown — see design_handoff_jax_sales step 4. */
export function TasksBoard({
  role,
  departments,
}: {
  role: AppRole;
  departments: DepartmentOption[];
}) {
  const [exitedFilter, setExitedFilter] = useState<TaskStatus | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "HIGH" | "MID" | "LOW">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<TaskBoardView>("table");
  const searchParams = useSearchParams();
  const showSwitcher = isNetworkWideRole(role);
  const centreId = searchParams.get("centre") ?? ALL_CENTRES;

  const baseFilter = showSwitcher ? { centreId } : {};
  const { data, isLoading, error } = useTasks(
    exitedFilter ? { ...baseFilter, status: exitedFilter } : baseFilter,
  );

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter(
      (t) =>
        (priorityFilter === "all" || t.priority === priorityFilter) &&
        (!q || t.description.toLowerCase().includes(q) || t.assigneeName.toLowerCase().includes(q)),
    );
  }, [data, search, priorityFilter]);

  return (
    <div className="flex flex-col gap-[18px] px-6 py-5 pb-7">
      <div className="flex items-center gap-3">
        <TaskViewTabs active={view} onChange={setView} />
      </div>

      <TaskFilters
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        search={search}
        onSearchChange={setSearch}
        exitedFilter={exitedFilter}
        onExitedFilterChange={setExitedFilter}
        visibleCount={filteredRows.length}
        totalCount={data?.rows.length ?? 0}
        onOpenCreate={() => setCreateOpen(true)}
      />

      {isLoading && <p className="text-text-muted">Đang tải...</p>}
      {error && <p className="text-red">{error.message}</p>}

      {data && !exitedFilter && view === "table" && <TaskTable rows={filteredRows} />}
      {data && !exitedFilter && view === "daily" && (
        <DailyWorkView rows={filteredRows} centreId={showSwitcher ? centreId : undefined} />
      )}

      {data && exitedFilter && (
        <div className="flex flex-col gap-2">
          {filteredRows.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {filteredRows.length === 0 && <p className="text-text-muted">Không có công việc nào.</p>}
        </div>
      )}

      <CreateTaskDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} departments={departments} />
    </div>
  );
}
```

Note: `TaskStatus` import was removed from `@/lib/data/types` since `groupByStatus` (the only consumer) is deleted; `exitedFilter`'s `useState<TaskStatus | null>` still needs the `TaskStatus` type — re-add it to the type-only import: `import type { AppRole, TaskStatus } from "@/lib/data/types";`.

- [ ] **Step 2: Delete `KanbanColumns.tsx`**

```bash
rm "src/app/(app)/tasks/KanbanColumns.tsx"
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean, no references to the deleted `KanbanColumns` or `groupByStatus` remain.

- [ ] **Step 4: Manual end-to-end verification**

Run: `npm run db:start` (if not running), then `npm run dev`, visit `http://localhost:3000/tasks`, sign in as `sale.q1@jaxtina.test` / `Password123!` (per `tests/helpers/auth.ts` seeded users):

- Confirm the "Bảng" tab shows the sortable table with all existing tasks; click a status pill and confirm it cycles TODO→DOING→DONE→TODO; click the "⋯" next to a pill and confirm BLOCK/RESCHEDULED/CANCELLED are reachable.
- Click the deadline and priority column headers and confirm sort order toggles.
- Switch to "Theo người" tab and confirm one card per employee appears, each showing correct today's-task counts; expand a card and confirm its task list matches.
- Sign in as `admin@jaxtina.test` (super_admin), confirm the centre switcher still works and Daily Work respects it (network-wide when `?centre=all`, scoped when a specific centre is selected).
- Switch the exited-status select (Chuyển lịch / Hủy công việc) and confirm the original card-list view still renders via `TaskCard.tsx`, unchanged.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: PASS — all pre-existing `tests/integration/tasks.*.test.ts` and `tests/unit/task-status.test.ts` remain green since no server action/service/schema for existing task flows was changed; new tests from Tasks 1, 4, 6 pass.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/tasks/TasksBoard.tsx"
git rm "src/app/(app)/tasks/KanbanColumns.tsx"
git commit -m "feat(tasks): wire Table/Daily Work views into TasksBoard, remove Kanban board"
```

---

## Self-Review Notes

- **Spec coverage**: Task Table (Task 5) ✓, Daily Work (Task 7) ✓, click-to-cycle status (Task 5's `StatusPill`) ✓, tabs above filter bar (Task 3, wired in Task 8) ✓, centre-scoped employee list with super_admin network-wide support (Task 1) ✓, reuse of existing `TaskView`/vocabulary/`task-status.ts`/`useChangeTaskStatus` ✓, `KanbanColumns.tsx` removed (Task 8) ✓, `TaskCard.tsx`/`TaskFilters.tsx`/`CreateTaskDrawer.tsx`/schemas/services for existing flows left untouched ✓.
- **Type consistency checked**: `EmployeeListRow` (Task 1) is the exact shape `useEmployees` (Task 2), `groupTasksByEmployeeForToday` (Task 6), and `DailyWorkView` (Task 7) all consume — `id, fullName, departmentId, departmentName, avatarColor` used consistently across all four. `TaskSortKey`/`SortDirection` (Task 4) match `TaskTable`'s (Task 5) usage exactly. `TaskBoardView` (Task 3) matches `TasksBoard`'s (Task 8) `view` state type exactly.
- **FK name verified**: `employees_department_id_fkey` confirmed against `supabase/migrations/20260716120001_schema.sql:28` (Postgres's default auto-generated name for the unnamed inline FK) — no live DB connection needed to confirm this.
- **Duplication fixed pre-execution**: the original draft had Task 5 (`TaskTable.tsx`) and Task 7 (`DailyWorkView.tsx`) each define their own local `initials()`, verbatim-duplicating the one already in `TaskCard.tsx`. Resolved before dispatching any implementer by extracting `initials()` to `src/lib/format.ts` (with its own unit test, `tests/unit/format.test.ts`) as a prerequisite commit, updating `TaskCard.tsx` to import it, and updating Tasks 5/7 above to import from `@/lib/format` instead of redefining it. `src/lib/format.ts` now exists on `master` prior to Task 1's dispatch.
