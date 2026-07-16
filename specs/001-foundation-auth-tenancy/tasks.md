---
description: "Task list for Foundation — Auth, Roles, Tenancy & Tasks Vertical"
---

# Tasks: Foundation — Authentication, Roles, Tenancy & Tasks Vertical

**Input**: Design documents from `specs/001-foundation-auth-tenancy/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: TDD tests are **MANDATORY** here (not optional). Constitution Principle IV requires a
permission-rejection test per mutating action and a centre-isolation test per RLS table; spec
success criteria SC-001/002/003/004/004a demand them. Tests run with Vitest against a **live local
Supabase stack, sequentially, with no mocking of auth/DB** for isolation/permission assertions.

**Organization**: Grouped by user story. NOTE — the four user stories are *layered*, not
independent: US2 needs US1's session/claims; US3/US4 need US2's tenancy. The heavy lifting (extension
seams, RLS, claims hook, guarded-write functions) is in **Phase 2 (Foundational)** by design, so the
story phases stay thin and the security foundation is proven before any vertical write.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 (user-story tasks only; Setup/Foundational/Polish carry no story label)
- Paths follow [plan.md](./plan.md) Project Structure (single Next.js app at repo root).

⚠️ **Verify-at-implementation gate**: before writing any auth code (**T018, T027, T051**), confirm
the current Supabase Auth API surface — `getClaims()` vs `getSession()`, admin force-global-sign-out,
`resetPasswordForEmail` — against live Supabase docs (research R5). Do NOT assert these from memory.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the Next.js + Supabase project and tooling.

- [X] T001 Scaffold Next.js 16 App Router (TypeScript, React 19, Turbopack) at repo root per [plan.md](./plan.md) Project Structure
- [X] T002 Initialize local Supabase project (`supabase init`) under `supabase/`; verify `supabase start` brings up Postgres + Auth
- [X] T003 [P] Add dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `@tanstack/react-query`, `tailwindcss@4`, shadcn/ui, `dnd-kit`
- [X] T004 [P] Configure ESLint + Prettier + `tsc --noEmit` scripts in `package.json`
- [X] T005 [P] Configure Vitest for **sequential** runs against the live local Supabase stack (no parallelism; no auth/DB mocks) in `vitest.config.ts`
- [X] T006 [P] Add `.env.local.example` and startup env validation stub in `src/lib/env.ts` (fail-fast on missing vars; service key server-only, never `NEXT_PUBLIC_`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The load-bearing base + extension seams. **No user story can begin until this is done.**
This is deliberately the largest phase — it is where the foundation actually lives.

**⚠️ CRITICAL**: Everything below blocks all four user stories.

### Contract & vocabulary seams (extension points — FR-024a…f)

- [X] T007 [P] Define enums (contract values) + entity types (camelCase) in `src/lib/data/types.ts` per [data-model.md](./data-model.md) (`AppRole`, `TaskStatus`, `Priority`, `TaskGroup`, `TaskSource`, entity shapes)
- [X] T008 [P] Create the single vocabulary source in `src/lib/domain/vocabulary.ts`: Vietnamese labels + badge-color triples, `TASK_STATUS_ORDER`, `NAV_ITEMS` + `navItemsForRole`, `resolveEffectiveCentre`, `isNetworkWideRole`, `ALL_CENTRES` (FR-024b/024c, research R6)
- [X] T009 [P] Create the single permission-key registry in `src/lib/auth/permissions.ts` mapping each of the 5 roles → permission keys (`task.create`, `task.assign`, `task.changeStatus`, `employee.deactivate`, `system.admin` catch-all) (FR-024a)
- [X] T010 [P] Implement boundary helpers in `src/lib/case.ts` (`toCamelCase`/`toSnakeCase`) and `src/lib/pagination.ts` (`Paginated<T>`, `toRange`) (constitution §8, FR-026)
- [X] T011 [P] Implement `withError` wrapper in `src/lib/server-action.ts` returning discriminated `{ data } | { error }` (friendly Vietnamese in prod, raw in dev) (FR-025, Principle III)

### Database schema, RLS & guarded writes (Layer 3 + atomicity)

- [X] T012 Create migration: tables `centres`, `departments`, `employees`, `tasks`, `task_status_logs`, `audit_log` per [data-model.md](./data-model.md), with indexes on `centre_id`, `assignee_id`, `status`, `deadline` (research R2/R7)
- [X] T013 Create migration: enable RLS + policies on all tenant tables per [contracts/rls-policies.md](./contracts/rls-policies.md) — Pattern A (broad SELECT / centre-narrow write, `(select auth.jwt() ->> 'centre_id')`), Pattern B (Centre/Department reference), Pattern C (append-only audit)
- [X] T014 Create migration: `custom_access_token_hook(event jsonb)` injecting `app_role`/`centre_id`/`employee_id` claims; grants to `supabase_auth_admin`; `employees` read policy for the hook (research R1). NOT `security definer`
- [X] T015 [P] Create migration: `change_task_status(task_id, target?, note?)` Postgres function (atomic status update + `task_status_log` insert) (FR-020/021, research R3)
- [X] T016 [P] Create migration: atomic task-create path writing task + initial `null → TODO` log (FR-022); and `write_audit_log(...)` function (FR-024g)
- [X] T017 Enable the access-token hook in `supabase/config.toml` (`[auth.hook.custom_access_token]`); `supabase db reset` applies migrations clean

### Auth plumbing & route guard (Layers 1 & 2)

- [X] T018 ⚠ Implement `src/lib/auth/claims.ts` — fresh `@supabase/ssr` server client per request; verify JWT (`getClaims()`) to resolve role/centre/employee; never trust the cookie (Principle II, research R5) — **verify API surface first**
- [X] T019 Implement `src/lib/auth/assert-permission.ts` — `assertPermission(key)` (throws Unauthenticated/Forbidden, reads `permissions.ts`) and `assertAuthenticated()` (Layer 2, FR-010)
- [X] T020 Implement Layer-1 route guard `src/proxy.ts` that **imports and iterates `NAV_ITEMS`** to build its protected-route set (single list — no parallel matcher array) and redirects unauthenticated navigation to `/login` (FR-009, research R6)
- [X] T021 Implement the single data seam `src/lib/data/index.ts` (only client↔DB path) and TanStack Query provider wiring

### Seed (idempotent, real code paths)

- [X] T022 Write idempotent `supabase/seed.sql`: ≥2 centres, flat departments, ≥1 active employee per role with cross-centre coverage (+ a deactivated user), and sample tasks across statuses (spec §Assumptions; enables every isolation/working test)

**Checkpoint**: Auth resolves claims, RLS enforces tenancy, seams exist, seed runs — user stories can begin.

---

## Phase 3: User Story 1 — Sign-in & session (Priority: P1) 🎯 MVP

**Goal**: A staff member signs in (email+password), gets a claims-bearing session, can sign out and
reset a password; unauthenticated navigation is redirected.

**Independent Test**: Seeded user signs in → workspace; wrong password → friendly generic error;
signed-out visit to `/tasks` → redirect to `/login`; deactivated user → no session; reset password → sign in.

### Tests for User Story 1 (write FIRST, ensure they FAIL) ⚠️

- [X] T023 [P] [US1] Integration test: sign-in success sets role/centre/employee claims; wrong password returns generic Vietnamese error (no email-existence leak) in `tests/integration/auth.signin.test.ts` (FR-001/002)
- [X] T024 [P] [US1] Integration test: deactivated account cannot obtain a usable session (FR-005) in `tests/integration/auth.deactivated.test.ts`
- [X] T025 [P] [US1] Integration test: route guard redirects unauthenticated `/tasks` → `/login`; sign-out ends session in `tests/integration/auth.guard.test.ts`

### Implementation for User Story 1

- [X] T026 [P] [US1] Zod schemas for sign-in / reset in `src/schemas/auth.ts`
- [X] T027 [US1] ⚠ Auth server actions `signIn`, `signOut`, `requestPasswordReset`, `resetPassword` in `src/app/actions/auth/` per [contracts/auth.actions.md](./contracts/auth.actions.md) (canonical pipeline; verify API surface first)
- [X] T028 [P] [US1] Sign-in page in `src/app/(auth)/login/` and reset-password page in `src/app/(auth)/reset-password/` (Vietnamese copy via `vocabulary.ts`)
- [X] T029 [US1] App shell layout `src/app/(app)/layout.tsx` rendering nav from `navItemsForRole(role)` (post-sign-in landing)

**Checkpoint**: US1 fully functional — sign in/out, reset, guarded routes. MVP boundary.

---

## Phase 4: User Story 2 — Role & centre scoping (Priority: P1)

**Goal**: Each role sees a workspace shaped to its rights; network admin gets the centre switcher and
whole-network view; every other role is pinned to its own centre; teacher sees only own-assigned tasks.

**Independent Test**: For each of 5 seeded roles, verify visible navigation, centre-switcher
presence, and tasks-list centre scope; URL centre-override is ignored for centre-scoped roles.

### Tests for User Story 2 (write FIRST, ensure they FAIL) ⚠️

- [X] T030 [P] [US2] Integration test: `resolveEffectiveCentre` + `listTasks` scope per role; super_admin override honored, others pinned despite URL param (FR-014/015) in `tests/integration/scope.centre.test.ts`
- [X] T031 [P] [US2] Integration test: teacher `listTasks` returns only own-assigned tasks (FR-017) in `tests/integration/scope.teacher.test.ts`
- [X] T032 [P] [US2] Unit test: `navItemsForRole` returns exactly the permitted modules per role (FR-009) in `tests/unit/vocabulary.nav.test.ts`

### Implementation for User Story 2

- [X] T033 [US2] Implement `listTasks(filter)` read in `src/app/actions/tasks/` + `src/hooks/queries/useTasks.ts` per [contracts/tasks.actions.md](./contracts/tasks.actions.md): server-side `resolveEffectiveCentre`, teacher forced `mine=true`, `Paginated<TaskView>` (FR-016/017, SC-007/008a)
- [X] T034 [US2] Centre switcher component (super_admin only, incl. "Toàn hệ thống") wired to the tasks list scope in `src/app/(app)/` shell
- [X] T035 [US2] Render nav strictly from `navItemsForRole` in the shell; confirm no control appears outside a role's grants (FR-009)

**Checkpoint**: All 5 roles see correctly scoped workspaces; tenancy read-path proven.

---

## Phase 5: User Story 3 — Create & assign a task, own-centre only (Priority: P1)

**Goal**: An authorized user creates/assigns a task within their own centre; cross-centre is refused;
creation writes the initial status log + audit entry.

**Independent Test**: Create a same-centre task → appears for assignee, with initial log + audit;
cross-centre assign → refused; unauthorized role → refused; missing deadline → validation error.

### Tests for User Story 3 (write FIRST, ensure they FAIL) ⚠️

- [X] T036 [P] [US3] Permission-rejection test: role lacking `task.create`/`task.assign` refused, no write (SC-001) in `tests/integration/tasks.perm.test.ts`
- [X] T037 [P] [US3] Centre-isolation test: centre-A user cannot create/assign into centre B — **including with the app gate bypassed** (RLS authoritative, SC-002/003) in `tests/integration/tasks.isolation.test.ts`
- [X] T038 [P] [US3] Integration test: create writes initial `null→TODO` log (FR-022) + one `task.create` audit entry (FR-024g, SC-004a); assign writes `task.assign` audit in `tests/integration/tasks.create-assign.test.ts`
- [X] T039 [P] [US3] Unit test: create/assign Zod schemas reject missing deadline / invalid enum (FR-023) in `tests/unit/schemas.tasks.test.ts`

### Implementation for User Story 3

- [X] T040 [P] [US3] Zod schemas for create/assign in `src/schemas/tasks.ts`
- [X] T041 [US3] `task.service.ts` `createTask` / `assignTask` in `src/services/task.service.ts`: derive centre from claims, validate assignee is active & same-centre, call atomic create + audit (FR-018/019)
- [X] T042 [US3] `createTask` / `assignTask` server actions in `src/app/actions/tasks/` (canonical pipeline) + `src/hooks/mutations/` with query-key invalidation
- [X] T043 [US3] Task create/assign UI (form + assignee picker limited to own-centre active employees) in `src/app/(app)/tasks/`

**Checkpoint**: Guarded, centre-confined writes proven end-to-end with audit + isolation tests green.

---

## Phase 6: User Story 4 — Status lifecycle & history (Priority: P1)

**Goal**: Users move tasks through the full 6-status model (auto-cycle + explicit BLOCK/RESCHEDULED/
CANCELLED); every transition is logged; out-of-scope changes refused with no log.

**Independent Test**: Auto-cycle TODO→DOING→DONE→TODO; explicit BLOCK stays until named exit; each
change writes a log with actor/time/from→to; unauthorized change refused, no log.

### Tests for User Story 4 (write FIRST, ensure they FAIL) ⚠️

- [X] T044 [P] [US4] Unit test: `task-status.ts` pure transition matrix — auto-cycle order + explicit-only states; auto never enters/leaves BLOCK (FR-020) in `tests/unit/task-status.test.ts`
- [X] T045 [P] [US4] Integration test: every status change (incl. creation) writes exactly one `task_status_log` (FR-021, SC-004) in `tests/integration/tasks.statuslog.test.ts`
- [X] T046 [P] [US4] Permission-rejection test: status change outside caller's scope refused with no log written (SC-001) in `tests/integration/tasks.status-perm.test.ts`

### Implementation for User Story 4

- [X] T047 [P] [US4] Pure `src/services/task-status.ts` ⚙: `nextAutoStatus`, `resolveTargetStatus` (auto-cycle + explicit validation) per [data-model.md](./data-model.md)
- [X] T048 [US4] `changeTaskStatus` service + server action routing through the `change_task_status` Postgres function (atomic) in `src/services/task.service.ts` + `src/app/actions/tasks/`
- [X] T049 [US4] Kanban board (dnd-kit) columns TODO/DOING/DONE/BLOCK + status filter for RESCHEDULED/CANCELLED in `src/app/(app)/tasks/`; labels via `vocabulary.ts`

**Checkpoint**: Full task lifecycle + complete history; the atomicity/status-log invariant proven.

---

## Phase 7: Immediate revocation & audit for a non-Task entity (spans FR-005/007a/024g)

**Purpose**: Prove the audit seam is reusable (non-Task) and the immediate-revocation guarantee.
(Small phase; completes the security bar SC-003a. Not a separate user story — a cross-cutting proof.)

- [X] T050 [P] Integration test: `deactivateEmployee` writes `employee.deactivate` audit; deactivated user's session cannot act on next request (immediate global sign-out) (FR-005/007a, SC-003a) in `tests/integration/personnel.deactivate.test.ts`
- [X] T051 ⚠ Implement `deactivateEmployee` action + `employee.service.ts` + admin force-global-sign-out per [contracts/personnel.actions.md](./contracts/personnel.actions.md) (verify revocation API first)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T052 [P] Verify no screen renders a raw enum id / English system string; all copy via `vocabulary.ts` (SC-010)
- [X] T053 [P] Confirm CWV budget on the tasks list at seed volume (first page perceived-instant; no unbounded query) (SC-008a)
- [X] T054 Enforce size limits (files <800, functions <50, nesting ≤4) and immutable patterns across new modules
- [X] T055 Run coverage; ensure ≥80% overall with mutating actions + tenancy boundaries covered (SC-009)
- [X] T056 Run full [quickstart.md](./quickstart.md) validation (Scenarios 1–5 + security-proof suite) and record results
- [X] T057 [P] Assert no public self-registration exists (FR-006): add a test/guard confirming there is no self-signup route or account-creation action reachable without an existing authenticated admin session; accounts originate only from seed/admin provisioning in `tests/integration/auth.no-self-signup.test.ts`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup — **BLOCKS all user stories**. Largest phase (the real foundation).
- **US1 (P3)**: after Foundational. Prerequisite for US2 (session/claims).
- **US2 (P4)**: after US1 (needs a signed-in, claims-bearing session to scope).
- **US3 (P5)**: after US2 (needs tenancy read-path + effective-centre resolution).
- **US4 (P6)**: after US3 (operates on created tasks; shares `task.service`/actions).
- **Phase 7**: after Foundational + US1 (needs auth + audit seam); independent of US3/US4.
- **Polish (P8)**: after all desired stories.

> ⚠️ Unlike a typical Spec Kit feature, these stories are **layered, not parallel** — US1→US2→US3→US4
> is a hard chain because each proves a layer the next depends on. Parallelism is *within* phases
> (see below), not *across* stories.

### Within each story

- Tests written and **failing** before implementation (TDD, Principle IV).
- Schemas → pure logic/services → Postgres functions → server actions → hooks/UI.

### Parallel opportunities

- **Setup**: T003–T006 [P] together.
- **Foundational**: T007–T011 [P] (seams, different files); T015/T016 [P] (different migrations); T012→T013→T014→T017 are sequential (schema before RLS before hook before enabling).
- **Per story**: all test tasks marked [P] run together (different files) and must fail first; schema tasks [P].

---

## Parallel Example: Foundational seams (Phase 2)

```bash
# Extension seams — different files, no interdependencies:
Task: "Define enums + entity types in src/lib/data/types.ts"          # T007
Task: "Create vocabulary source in src/lib/domain/vocabulary.ts"       # T008
Task: "Create permission-key registry in src/lib/auth/permissions.ts"  # T009
Task: "Boundary helpers in src/lib/case.ts + src/lib/pagination.ts"    # T010
Task: "withError wrapper in src/lib/server-action.ts"                   # T011
```

## Parallel Example: User Story 3 tests (write first, must fail)

```bash
Task: "Permission-rejection test in tests/integration/tasks.perm.test.ts"        # T036
Task: "Centre-isolation test in tests/integration/tasks.isolation.test.ts"       # T037
Task: "Initial-log + audit test in tests/integration/tasks.create-assign.test.ts"# T038
Task: "Schema validation test in tests/unit/schemas.tasks.test.ts"               # T039
```

---

## Implementation Strategy

### MVP scope

Because the stories are layered, the **true MVP is Setup + Foundational + US1 + US2** — a signed-in
user seeing a correctly scoped (read-only) workspace. That is the smallest slice that demonstrates the
security foundation working. US3 + US4 add the write vertical that fully satisfies both success bars.

### Incremental delivery

1. Setup + Foundational → foundation + seams + RLS ready (nothing user-visible yet).
2. + US1 → sign in/out, reset, guarded routes.
3. + US2 → correctly scoped read workspace for all 5 roles (demoable).
4. + US3 → centre-confined create/assign with audit + isolation proofs.
5. + US4 → full task lifecycle + history.
6. + Phase 7 → immediate revocation proof.
7. Polish → coverage, CWV, quickstart validation.

### Notes

- [P] = different files, no dependency on incomplete tasks.
- Tests MUST fail before implementation (verify red → green).
- Auth tasks (T018, T027, T051) are gated on verifying the Supabase Auth API surface vs live docs (research R5) — do not code from memory.
- Commit after each task or logical group; stop at any checkpoint to validate.
