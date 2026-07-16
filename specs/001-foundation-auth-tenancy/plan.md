# Implementation Plan: Foundation — Authentication, Roles, Tenancy & Tasks Vertical

**Branch**: `001-foundation-auth-tenancy` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-foundation-auth-tenancy/spec.md`

## Summary

Stand up the load-bearing base of the Jaxtina CRM rebuild — email/password authentication with
session-borne role/centre/department claims, all five roles behind a server-side permission gate,
database-enforced multi-centre tenancy (broad read / narrow write), and a general audit-log seam —
proven end-to-end through the Tasks vertical (list · create · assign same-centre · full 6-status
lifecycle with status history). The slice also establishes the **extension seams** future modules
(sales performance, course suggestions, HR, more CRM) plug into: a single permission-key registry,
one shared Vietnamese vocabulary source, one unified navigation/access matrix, the canonical
mutation pipeline, and a reusable centre-tenancy pattern — plus **Department** as a first-class
network-wide entity.

**Technical approach**: Next.js 16 App Router with Server Actions as the only mutation entry points;
Supabase (Postgres + Row-Level Security + Auth) as the authoritative tenancy boundary; a custom
access-token hook injecting `app_role`/`centre_id`/`employee_id` as top-level JWT claims read
directly by RLS policies; Zod boundary validation; TanStack Query for server-state; a single data
seam between client and DB; and compound/guarded writes (status transitions, task generation, audit)
executed through Postgres functions to preserve atomicity and the status-log-on-every-transition
invariant. Tests run with Vitest against a live local Supabase stack, sequentially, with no mocking
of auth or DB for the isolation/permission proofs.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ (Next.js 16 App Router, React 19)

**Primary Dependencies**: Next.js 16 (App Router + Server Actions, Turbopack), `@supabase/ssr` +
`@supabase/supabase-js`, Zod (boundary schemas), TanStack Query (server-state cache), Tailwind CSS
v4 + shadcn/ui (Base UI), dnd-kit (kanban board), `papaparse` (deferred, not this slice)

**Storage**: Supabase Postgres with Row-Level Security; Supabase Auth for identity (email/password).
Authoritative tenancy at the DB via RLS policies reading JWT claims.

**Testing**: Vitest against a **live local Supabase stack** (`supabase start`), run **sequentially**
with shared state (intentional). No mocking of auth/DB for RLS-isolation or permission-gate
assertions (constitution Principle IV).

**Target Platform**: Web application (server-rendered + client components) deployed to a
serverless/fluid-compute host; modern evergreen browsers.

**Project Type**: Web application (single Next.js app; server actions + RSC + client components).

**Performance Goals**: Core Web Vitals — LCP < 2.5s, INP < 200ms, CLS < 0.1. Tasks list first page
returns perceived-instant at the mid-size-chain baseline. RLS policies read JWT claims directly (no
per-row join) to keep row filtering cheap.

**Constraints**: Database-enforced tenant isolation is mandatory (FR-013/SC-003) — rules out any
data layer that cannot enforce row-level isolation; Postgres RLS satisfies it. Every mutation flows
`withError → assertPermission → schema.parse → service`. Files < 800 lines, functions < 50 lines,
nesting ≤ 4. Vietnamese-first; ≥80% coverage. Server code verifies the JWT (`getClaims()`), never
trusts the cookie; a fresh DB client per request; service-role key server-only, never
`NEXT_PUBLIC_`.

**Scale/Scope**: Mid-size chain — ~10 centres, low-hundreds of staff, ~tens of thousands of
tasks/records per year (hundreds of thousands over the product's life). This slice's scope: auth +
5 roles + tenancy + Department + audit seam + Tasks vertical. All other modules out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

| Principle | Gate | Status |
|---|---|---|
| **I. Vietnamese-First (single vocabulary source)** | All labels/statuses/errors Vietnamese via one shared, dependency-free vocabulary module; no raw enum id rendered. | ✅ PASS — FR-024/024c mandate the single vocabulary source; Phase 1 defines `vocabulary.ts` as the sole label authority. |
| **II. Layered Security & Multi-Tenant Isolation (NON-NEGOTIABLE)** | Three independent layers (route guard / `assertPermission` / RLS), never collapsed; reads broad, writes centre-narrow; JWT verified not trusted; fresh client per request; service-role server-only. | ✅ PASS — the entire slice exists to establish these; FR-008…015, FR-007/007a. Supabase RLS = Layer 3. |
| **III. Canonical Mutation Pipeline & Boundary Validation** | Every mutation: `withError → assertPermission → schema.parse → service`; discriminated `{data}\|{error}`; audit on sensitive writes; env validated at startup. | ✅ PASS — FR-010/023/024d/024g. Audit seam (FR-024g) realizes the audit convention directly. |
| **IV. Test-First with Isolation Proof (NON-NEGOTIABLE)** | TDD, ≥80%; permission-rejection test per mutating action; centre-isolation test per RLS table; no mocked auth/DB for those; real local DB, sequential. | ✅ PASS — SC-001/002/003/003a/004a/009; test infra decided (live local Supabase, sequential). |
| **V. Atomicity, Idempotency & Immutability** | Guarded/compound writes atomic via a single DB function; stable idempotency keys; status-log on every transition; immutability. | ✅ PASS — FR-020/021/022 (status log on every transition incl. creation); status changes routed through a Postgres function for atomicity. No task *generation* in this slice, so cross-centre fan-out / generationKey is deferred (not violated). |

**Engineering standards**: size limits, camelCase↔snake_case boundary conversion, single data seam,
pagination everywhere, navigation-is-the-access-matrix (FR-024b — one list), CWV targets, explicit
error handling — all reflected in Technical Context and Phase 1 structure. ✅ PASS.

**Initial gate result: PASS.** No violations; Complexity Tracking not required.

**Post-Design re-check (after Phase 1): PASS.** The design artifacts strengthen, and nowhere weaken,
constitutional compliance — each principle now traces to a concrete artifact:
- Principle I → `data-model.md` enums-as-contract + `vocabulary.ts` as sole label source (research R6).
- Principle II → `contracts/rls-policies.md` (broad SELECT / centre-narrow write clauses); teacher
  own-scope kept at the app layer *by design* so the "reads broad" property is not contradicted.
- Principle III → the `withError → assertPermission → schema.parse → service` contract restated in
  every action file; audit seam in `personnel.actions.md` + `rls-policies.md`.
- Principle IV → `quickstart.md` security-proof suite (permission-rejection + centre-isolation vs
  live local DB, no mocks, sequential); coverage target carried.
- Principle V → `change_task_status` Postgres function + atomic create-with-initial-log (research R3,
  data-model status rules). No cross-centre fan-out in this slice ⇒ no `SECURITY DEFINER` data fn yet.
- One residual **verify-at-implementation** flag (auth API surface — research R5) is a *research*
  caution, not a constitution violation: it protects Principle II by forbidding memory-asserted auth
  code. Still PASS; flagged for the implement phase.

## Project Structure

### Documentation (this feature)

```text
specs/001-foundation-auth-tenancy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (server-action + RLS-policy contracts)
│   ├── auth.actions.md
│   ├── tasks.actions.md
│   ├── personnel.actions.md
│   └── rls-policies.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already present)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/                 # sign-in page (email/password)
│   │   └── reset-password/        # password-reset flow
│   ├── (app)/                     # authenticated shell (sidebar/header)
│   │   ├── layout.tsx             # shell; renders nav from NAV_ITEMS + role
│   │   ├── dashboard/             # minimal landing (placeholder in this slice)
│   │   └── tasks/                 # tasks board (list) + daily view
│   └── actions/
│       ├── auth/                  # sign-in/out, reset, force-signout (mutation entry points)
│       ├── tasks/                 # create, assign, changeStatus (mutation entry points)
│       └── personnel/             # deactivate account (exercises audit seam)
├── services/
│   ├── task.service.ts            # createTask, assignTask, changeTaskStatus (auto cycle + explicit)
│   ├── employee.service.ts        # deactivate; role/centre/department resolution helpers
│   ├── audit.service.ts           # writeAuditLog(actor, action, entityType, entityId, metadata?)
│   └── task-status.ts ⚙          # pure: status-cycle transition logic (TODO→DOING→DONE / BLOCK etc.)
├── schemas/                       # Zod input schemas (per action)
├── hooks/
│   ├── queries/                   # useTasks, etc. (query-key factories)
│   └── mutations/                 # useCreateTask, useChangeTaskStatus, etc.
├── lib/
│   ├── data/
│   │   ├── index.ts               # the single data seam
│   │   └── types.ts               # enums (contract) + entity shapes (camelCase)
│   ├── domain/
│   │   └── vocabulary.ts          # Vietnamese labels + badge colors + NAV_ITEMS + resolveEffectiveCentre
│   ├── auth/
│   │   ├── assert-permission.ts   # assertPermission / assertAuthenticated (Layer 2)
│   │   ├── permissions.ts         # the single permission-key registry (role → keys)
│   │   └── claims.ts              # getClaims() — verify JWT, resolve role/centre/employee
│   ├── server-action.ts           # withError wrapper (discriminated {data}|{error})
│   ├── pagination.ts              # Paginated<T>, toRange (1-based page → DB range)
│   ├── case.ts                    # toCamelCase / toSnakeCase boundary helpers
│   └── env.ts                     # startup env validation (fail fast)
├── proxy.ts                       # Layer 1 route guard (renamed middleware)
└── ...

supabase/
├── migrations/                    # schema + RLS policies + access-token hook + status/audit fns
└── seed.sql                       # idempotent seed (≥2 centres, all roles, departments, tasks)

tests/
├── integration/                   # permission-gate + RLS-isolation (vs live local Supabase, sequential)
└── unit/                          # pure logic (task-status cycle, pagination, case, vocabulary)
```

**Structure Decision**: Single Next.js web application (the constitution and reference impl assume
one app, not a split frontend/backend). Server Actions under `src/app/actions/*` are the sole
mutation entry points; domain logic lives in `src/services/*`; pure logic is split out for
unit-testing; the data seam (`src/lib/data/index.ts`) is the only client↔DB path; `vocabulary.ts`
and `permissions.ts` are the single-source-of-truth extension seams. RLS policies + access-token
hook + guarded-write Postgres functions live in `supabase/migrations/*`.

## Complexity Tracking

No constitution violations — this section intentionally left empty.
