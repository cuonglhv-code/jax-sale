# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`jax-sales` (Jaxtina) is a Next.js 16 (App Router) + React 19 + TypeScript + Supabase internal CRM/ops tool. It has four vertical slices in progress: an IELTS roadmap builder (PDF proposal generation), a sales task/Kanban board, a sales performance/KPI tracker (recording, approval, targets, tiered dashboard), and an HR requests module (leave submission/approval/ledger built; class-conflict-and-cover scheduling in progress). No `README.md` exists — this file and `specs/00N-*/spec.md` are the source of truth for intent.

## Commands

```bash
npm run dev          # next dev --turbopack
npm run build
npm run start         # next start (serve production build)
npm run lint          # eslint .
npm run typecheck     # tsc --noEmit
npm run test           # vitest run (single run)
npm run test:watch     # vitest watch mode
npm run test:cov       # vitest run --coverage
npm run db:start       # supabase start (local stack)
npm run db:reset       # supabase db reset (re-applies all migrations + seed)
npm run db:stop        # supabase stop
```

Run a single test file: `npx vitest run tests/unit/kpi/attainment.test.ts`

**Tests require a running local Supabase stack** (`npm run db:start` first) and a populated `.env.local` (see `.env.local.example`). There is no mocking of Supabase/auth — `tests/helpers/auth.ts` signs in as real seeded users (`superAdmin`, `managerQ1`, `adminQ3`, `saleQ1`, `saleQ3`, `teacherQ1`, `deactivatedQ1`, password `Password123!`). `vitest.config.ts` forces `fileParallelism: false` / `maxWorkers: 1` because integration tests share live DB state sequentially — do not "fix" this by parallelizing.

## Architecture

### Layering convention (every vertical slice follows this)

```
schemas/*.ts (zod validation + inferred types)
  → lib/domain/*        pure domain rules/vocab, no I/O
  → services/*.ts        Supabase I/O + orchestration ("...Core" functions)
  → app/actions/*.ts      "use server" — auth + permission check + zod.parse + call service
  → hooks/queries|mutations   React Query wrapping the action
  → components                call the hook
```

Concrete example (Tasks — the most complete slice): `src/schemas/tasks.ts` → `src/lib/domain/vocabulary.ts` → `src/services/task.service.ts` (`createTaskCore`) → `src/app/actions/tasks/create-task.ts` → `src/hooks/queries/useTasks.ts` (query-key factory) + `src/hooks/mutations/useCreateTask.ts` → `src/app/(app)/tasks/CreateTaskForm.tsx`.

The IELTS roadmap slice adds a **delivery seam**: `src/services/ielts/delivery/adapter.ts` defines a `DeliveryAdapter` interface so the PDF/email delivery mechanism is swappable. The current implementation (`download-maildraft.ts`) only downloads the PDF client-side and opens a `mailto:` draft — it does not send real email yet.

### Server Actions: canonical mutation pipeline

Every mutating server action is wrapped with `withError` from `src/lib/server-action.ts`:

```ts
"use server";
export async function createTask(raw: unknown): Promise<ActionResult<Task>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "task.create");
    const input = createTaskSchema.parse(raw);
    return createTaskCore(supabase, claims, input);
  });
}
```

- `ActionResult<T> = { data: T } | { error: string }` — never throws to the caller.
- Errors (`UnauthenticatedError`, `ForbiddenError`, `ZodError`, `DomainError`) are mapped to Vietnamese user-facing messages; full detail is always `console.error`'d server-side, never silently swallowed.
- `DomainError` messages are authored to already be user-safe Vietnamese and are surfaced as-is (e.g. cross-centre assignment rejections).
- Permission checks go through `src/lib/auth/assert-permission.ts` against the registry in `src/lib/auth/permissions.ts`.

### Auth — three layers, only the last two are authoritative

1. **`src/proxy.ts`** — Next.js middleware (deliberately renamed from `middleware.ts`, per a comment citing CVE-2025-29927 middleware-bypass defenses). `PROTECTED_ROUTES` is derived by iterating `NAV_ITEMS` (`src/lib/domain/vocabulary.ts`) — never a hand-maintained parallel list, since that divergence is exactly what caused a past bug. UX-only redirect to `/login`; proves nothing about mutation safety.
2. **`src/app/(app)/layout.tsx`** — server-side `getVerifiedClaims(supabase)` re-check + redirect. Real gate for page rendering.
3. **Postgres RLS** — the authoritative layer (see below). Never assume layers 1–2 protect a mutation; every service/action must be safe if called directly.

### Supabase

- `src/lib/supabase/server.ts` — `createServerSupabaseClient()` creates a **fresh** `@supabase/ssr` client per request (never a shared module-level client), using Next 16's async `cookies()`. `createServiceRoleClient()` bypasses RLS — server-only, for admin/seed operations, never importable from client code.
- `src/lib/supabase/client.ts` — `createBrowserSupabaseClient()`, consumed only through the data seam `src/lib/data/index.ts`.
- `supabase/migrations/*.sql` — chronologically named `YYYYMMDDHHMMSS_description.sql`, grouped by slice: `001` foundation schema/RLS/access-token-hook, `002` roadmap records, `003` KPI schema/RLS, `004` HR employee cols/schema/RLS.
- RLS is explicitly patterned (see `supabase/migrations/20260716120002_rls.sql`): **Pattern B** = network-wide read, admin-only write (`centres`, `departments`); **Pattern A** = broad read, centre-narrow write (`employees`, `tasks`). Claims (`app_role`, `centre_id`, `employee_id`) are injected into the JWT via a Custom Access Token Hook and read in policies as `(select auth.jwt() ->> 'centre_id')`.
- No Supabase Edge Functions exist yet (`supabase/functions/` absent). `.mcp.json` points at a hosted Supabase MCP server for a different project ref than local dev — be aware which Supabase you're targeting.

### Spec-driven workflow (Spec Kit)

Features are developed as slices under `specs/00N-kebab-name/` (`spec.md` → `plan.md` → `tasks.md`, plus `research.md`, `data-model.md`, `quickstart.md`, `checklists/`, `contracts/`), using the `.specify/` templates and `speckit-*` skills. Current slices: `001-foundation-auth-tenancy`, `002-ielts-roadmap-builder`, `003-sales-performance-kpi` (US1/US2/US3/US7 built — record/approve/target/dashboard; US6 security-proof tests written but not yet green — `tests/integration/kpi/{permission-matrix,audit-completeness,isolation-e2e}.test.ts`; US4 leaderboard and US5 CSV/PDF export not started), `004-hr-requests` (US1+US3+US2 built — submit/ledger/decide; US4 class-conflict-and-cover in progress, files exist but `tasks.md` T038–T044 unchecked), `005-ielts-summit`. Integration tests are named `us{N}-*.test.ts` per slice, tying each test file directly to the `tasks.md`/`spec.md` user story it proves (e.g. `tests/integration/hr/us4-cover.test.ts`).

**Known inconsistency to check before resuming any slice's implementation:** `.specify/memory/constitution.md` was rewritten to v2.0.0, re-centering it around the IELTS-roadmap "presentation instrument" framing and removing prior CRM/tenancy principles from the core. The file's own sync-impact note says specs 001–004 were validated against v1.0.0 and must be re-validated against v2.0.0 before further work — so don't assume the HR/KPI work still matches current governing principles without checking.

### KPI dashboard tiering (slice #003)

`getDashboard` (`src/app/actions/kpi/get-dashboard.ts`) calls `rpc('kpi_dashboard', ...)`, a `SECURITY INVOKER` Postgres function — it runs with the caller's own RLS, so tier-scoping (consultant → own rows only, centre manager/admin → own centre, super_admin → network-wide) happens automatically inside the query rather than being filtered in application code. Only `approval_status = 'approved'` rows ever reach aggregates; `pending`/`rejected` are excluded at the RLS/function layer. A `NULL` target renders as "Chưa đặt mục tiêu" (not set) — never coerced to 0%. Targets are set separately from actuals: `TargetEditor.tsx` (manager sets per-consultant, admin sets department-wide) vs. the consultant's own actual-recording flow — a manager cannot write `actual` (blocked by an `enforce_actual_only` trigger), and editing an already-approved actual silently reverts it to `pending`. `setPersonalTargetCore` (`src/services/kpi/kpi.service.ts`) re-resolves the target consultant's real `centre_id` from `employees` rather than trusting the caller's claims — the RLS insert check only verifies `centre_id = caller's centre`, not that the named consultant actually belongs to it, so trusting client input here would let a manager plant a target row for a consultant in a different centre.

### HR class scheduling & cover assignment (slice #004, US4, in progress)

Leave that overlaps a taught class session requires an accepted same-centre cover before it can be approved. `src/lib/hr/conflict.ts` (`resolveAffectedSessions`) is a **pure, DB-free** resolver — callers fetch `class` rows and the `public_holiday` calendar and pass them in; it walks the leave date range against each class's weekday/recurrence window to enumerate affected sessions, excluding holidays and matching AM/PM half-days against a config-driven boundary (`leave_policy_config.am_pm_boundary_time`, defaults to noon — never hardcode this). The same resolver runs twice: once against the submitter (to require cover nominations) and once against a proposed nominee (any emitted session is a hard conflict that blocks that nominee). Class CRUD goes through the guarded `upsert_class` RPC (`src/services/class.service.ts`), which enforces the same-centre-teacher invariant in Postgres rather than in TypeScript, mirroring the existing `assign_task` pattern.

### PDF / Email

- IELTS roadmap PDFs are generated with `@react-pdf/renderer` (`src/lib/ielts/pdf/RoadmapDocument.tsx`, brand fonts in `src/lib/ielts/pdf/fonts*`).
- `resend` + `@react-email/components` are dependencies reserved for the HR module's notification system (Phase 9, not yet implemented) — no email-sending code or cron route exists yet despite `RESEND_API_KEY`/`CRON_SECRET` being present in `.env.local.example`.

### Config notes

- Path alias `@/*` → `./src/*` (tsconfig). `strict: true`, target ES2022.
- npm is the package manager (package-lock.json; no yarn/pnpm lockfile).
- `.env.local.example` documents required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
