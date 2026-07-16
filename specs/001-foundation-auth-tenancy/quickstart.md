# Quickstart & Validation: Foundation — Auth, Roles, Tenancy & Tasks Vertical

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md)

This guide proves the slice end-to-end against **both** success bars (security-proof + working
vertical). It references [data-model.md](./data-model.md) and [contracts/](./contracts/) rather than
restating them. Implementation code lives in tasks.md / the implementation phase — this is a run &
verify guide.

## Prerequisites

- Node.js 20+, Supabase CLI installed, Docker running.
- Repo scaffolded (Next.js app + `supabase/` project).

## Setup

```bash
# 1. Install deps
npm install

# 2. Start the local Supabase stack (real Postgres + Auth) — required for real-DB tests
supabase start

# 3. Apply migrations (schema + RLS + access-token hook + guarded-write functions) and seed
supabase db reset      # runs migrations + seed.sql (idempotent)

# 4. Run the app
npm run dev            # Next.js dev server (http://localhost:3000)
```

Seed provides (per [spec §Assumptions] and data-model): **≥2 centres**, **≥1 user per role** with
cross-centre coverage, the flat **departments**, and some **tasks** across statuses — so every
scenario below is exercisable.

## Verification commands

```bash
npm run test          # Vitest — unit + integration, sequential vs live local Supabase
npm run test:cov      # coverage (target ≥80% — SC-009)
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
```

---

## Scenario 1 — Sign-in & route guard (US1 · FR-001/002/003/005)

1. Visit `/tasks` while signed out → redirected to `/login` (Layer 1 guard, `proxy.ts`).
2. Sign in with a seeded active user (correct password) → land in the workspace.
3. Sign in with a wrong password → generic Vietnamese error, no session, no email-existence leak.
4. Sign out → `/tasks` again redirects to `/login`.
5. Attempt sign-in as a **deactivated** seeded user → no usable session.

**Expected**: matches [auth.actions.md](./contracts/auth.actions.md). ✅ SC-005 (per-role sign-in),
SC-008 (<1 min).

## Scenario 2 — Role & centre scoping (US2 · FR-008/009/014/015/017)

For each seeded role, sign in and verify:

| Role | Navigation shows | Centre switcher | Tasks list scope |
|---|---|---|---|
| `super_admin` | all modules | **yes** (+ "Toàn hệ thống") | any/all centres |
| `centre_manager` | its modules | no | own centre only |
| `centre_admin` | its modules | no | own centre only |
| `sale_consultant` | its modules | no | own centre only |
| `teacher` | no CRM/team/settings | no | **own-assigned tasks only** |

- As `super_admin`, switch the active centre → tasks list rescopes; select whole-network → all
  centres (SC-007).
- As a centre-scoped user, manipulate a `centreId` URL param for another centre → **ignored**, stays
  pinned to own centre (FR-014).

**Expected**: nav = access matrix (single `NAV_ITEMS`, research R6). ✅ SC-005, SC-007.

## Scenario 3 — Create & assign a task, own-centre only (US3 · FR-018/019/022/024g)

1. As a centre-scoped writer, create a task (description, assignee in **own** centre, department,
   group, priority, deadline) → appears in the assignee's task view (SC-006).
2. Verify an initial `TaskStatusLog` (`null → TODO`) exists (FR-022) and an audit entry
   `task.create` was written (FR-024g).
3. Attempt to assign/create targeting **another centre's** employee → rejected; no cross-centre task
   created (FR-019).
4. As a role lacking `task.create` → action refused, nothing written.
5. Submit with a missing deadline → boundary validation error (FR-023).

**Expected**: matches [tasks.actions.md](./contracts/tasks.actions.md). ✅ SC-004a, SC-006.

## Scenario 4 — Status lifecycle & history (US4 · FR-020/021)

1. Advance a TODO task with no target → DOING; again → DONE; again → TODO (auto-cycle).
2. Explicitly set a task to BLOCK → stays blocked; auto-advancing does not move it; explicitly set
   back to TODO.
3. After **each** change, verify a `TaskStatusLog` row with actor, time, from→to (FR-021, SC-004).
4. Attempt a status change on a task outside the caller's permitted scope → refused, **no** log
   written.

**Expected**: matches the status rules in [data-model.md](./data-model.md) and
[tasks.actions.md](./contracts/tasks.actions.md). ✅ SC-004.

## Scenario 5 — Immediate revocation on deactivation (FR-005/007a · SC-003a)

1. As an admin, deactivate an employee of your centre → audit `employee.deactivate` written.
2. That employee's active session can no longer perform protected actions on its next request
   (immediate global sign-out).

**Expected**: matches [personnel.actions.md](./contracts/personnel.actions.md). ✅ SC-003a.

---

## Security-proof test suite (the non-negotiable bar — constitution Principle IV)

These run in `tests/integration/` against the **live local Supabase** stack, **sequentially**, with
**no mocking** of auth or DB:

- **Permission-rejection (SC-001)**: for every mutating action (`createTask`, `assignTask`,
  `changeTaskStatus`, `deactivateEmployee`), a caller lacking the key gets `{ error }` and causes no
  write.
- **Centre-isolation (SC-002/SC-003)**: a centre-A user cannot INSERT/UPDATE/DELETE any centre-B row
  for Task/TaskStatusLog/Employee — verified **even with the app-layer gate bypassed** (calling the
  data layer directly), proving RLS is authoritative (SC-003).
- **Audit completeness (SC-004a)**: each sensitive write produces exactly one audit entry.
- **Status-log completeness (SC-004)**: every status change (including creation) produces a log.

## Done / pass criteria

- All 5 scenarios pass manually or via E2E.
- Security-proof suite green; coverage ≥80% (SC-009).
- No screen renders a raw enum id / English system string (SC-010) — all copy via `vocabulary.ts`.

---

## Validation Results (recorded 2026-07-16, /speckit-implement)

Reproduced from a clean `supabase db reset` (all 6 migrations + seed applied) immediately before
this run — not cumulative test-run residue.

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `eslint .` | ✅ clean |
| Test suite | ✅ **17 files / 50 tests, 100% passing** |
| Coverage | ✅ Statements 87.79% · Branches 80.13% · Functions 86.36% · Lines 93.04% — all ≥80% (SC-009) |

**Scenario-by-scenario evidence** (via the automated integration suite, which exercises the same
code paths a manual walkthrough would — real Supabase auth, real RLS, no mocking):

| Scenario | Covered by | Verdict |
|---|---|---|
| 1 — Sign-in & route guard | `auth.signin.test.ts`, `auth.deactivated.test.ts`, `auth.guard.test.ts`, `auth.password-reset.test.ts`, `auth.no-self-signup.test.ts` | ✅ |
| 2 — Role & centre scoping | `scope.centre.test.ts`, `scope.teacher.test.ts`, `vocabulary.nav.test.ts` | ✅ |
| 3 — Create & assign, own-centre only | `tasks.perm.test.ts`, `tasks.isolation.test.ts`, `tasks.create-assign.test.ts`, `schemas.tasks.test.ts` | ✅ |
| 4 — Status lifecycle & history | `task-status.test.ts`, `tasks.statuslog.test.ts`, `tasks.status-perm.test.ts` | ✅ |
| 5 — Immediate revocation on deactivation | `personnel.deactivate.test.ts` | ✅ |

**Security-proof suite** (constitution Principle IV — real DB, sequential, no mocking):
- SC-001 (permission-rejection): `tasks.perm.test.ts`, `tasks.status-perm.test.ts` — a role lacking
  the grant is refused, verified against the live stack.
- SC-002/SC-003 (centre-isolation, RLS-authoritative): `tasks.isolation.test.ts` — includes a raw
  table INSERT bypassing the guarded Postgres function entirely, proving RLS's `WITH CHECK` clause
  is the true backstop, not just the app-layer guard.
- SC-003a (immediate revocation): `personnel.deactivate.test.ts` — a session established BEFORE
  deactivation is rejected on its very next request.
- SC-004/SC-004a (log/audit completeness): `tasks.statuslog.test.ts`, `tasks.create-assign.test.ts`,
  `personnel.deactivate.test.ts`.
- SC-008a (perceived-instant at mid-size-chain volume): verified directly against Postgres —
  `EXPLAIN ANALYZE` on the paginated tasks query at 5,000-row volume returned in **1.9ms**, using
  `idx_tasks_centre` as intended (synthetic data inserted and cleaned up for this check; not part
  of the committed seed).
- SC-010 (Vietnamese-only, no raw enum leakage): verified by source audit — every status/priority/
  group/role render in the UI resolves through `vocabulary.ts`'s label maps.

**Known, deliberate gaps** (documented, not oversights):
- `proxy.ts`'s cookie-refresh forwarding branch (mechanical Next.js/Supabase SSR wiring) is untested
  — not a decision point.
- `CreateTaskForm` (79 lines) exceeds the 50-line engineering-standard guideline after a genuine
  extraction pass (was 129); further splitting would move lines without reducing complexity.
