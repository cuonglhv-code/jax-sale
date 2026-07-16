# Implementation Plan: HR Requests Module

**Branch**: `004-hr-requests` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-hr-requests/spec.md`

## Summary

Add a lightweight internal request-and-approval module to the jax-sales app: employees submit any of
**nine HR forms** (annual / sick / personal / unpaid leave, shift-swap, overtime, salary advance,
purchase, business travel) from a phone in under a minute; the centre manager approves or rejects
everything for their centre from **one queue**; every decision is written to an immutable audit trail.
The module is the **system of record for annual-leave balance** (consumed on approval, never
over-drawn silently) and **detects class conflicts at submission**, requiring an accepted covering
teacher before a manager can approve.

**Technical approach**: One **form engine** — a single `hr_request` table with cross-cutting columns
plus a Zod-validated JSONB payload, driven by a `FormDefinition` registry (one entry per type). Every
mutation reuses the existing canonical pipeline (`withError → assertPermission → schema.parse → *Core
service → guarded Postgres RPC → write_audit_log`); new permission keys are appended to the single
registry; centre tenancy is the existing RLS mechanism, but HR request/balance tables use
**restricted read** (own + centre-manager + super_admin) because they carry salary amounts, leave
reasons, and medical-doc pointers — consistent with the `audit_log`/`personal_kpis` precedent. The
annual-leave ledger consumes balance inside an atomic `approve_request` function that row-locks the
balance (no double-spend) and recomputes remaining fresh at approval time. A **minimal timetable**
stores recurring `class` definitions and computes affected sessions on the fly (no materialized
sessions). **Three net-new seams**, absent from the foundation, are added as reusable infrastructure:
transactional email (Resend + React Email, sent non-fatally from the service layer), private file
storage with storage-RLS + short-TTL signed URLs for medical documents (service-role upload, app-layer
gate on view), and scheduled jobs (Vercel Cron → secured route handlers) for approver reminders and
medical-doc auto-purge. UI reuses the existing plain-state + server-Zod form convention via a
schema-driven renderer (no new form library, no shadcn). Tests run with Vitest against a live local
Supabase stack, sequentially, with no mocking of auth/DB for permission and centre-isolation proofs —
extended here with a medical-doc **confidentiality** proof and a balance **no-double-spend** proof.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ (Next.js 16 App Router, React 19.2.x)

**Primary Dependencies**: Next.js 16 (App Router + Server Actions), `@supabase/ssr` +
`@supabase/supabase-js`, Zod (boundary schemas), TanStack Query (server-state). **New**: Resend +
React Email (transactional email — R6); Supabase Storage (private bucket — R8); Vercel Cron (scheduled
jobs — R7). No shadcn/ui, no react-hook-form (R9 — reuse existing plain-state + server-Zod pattern).

**Storage**: Supabase Postgres + Row-Level Security (authoritative tenancy). **New**: a private
Supabase Storage bucket `medical-documents` with storage-RLS (R8). New tables: `hr_request`,
`hr_request_status_history`, `cover_assignment`, `request_attachment`, `leave_balance`,
`leave_policy_config`, `leave_event_allowance`, `public_holiday`, `doc_type_policy`, `class`; plus
`employees` column additions (`hire_date`, `employment_type`, `contract_type`). See
[data-model.md](./data-model.md).

**Testing**: Vitest against a **live local Supabase stack**, run **sequentially**, no mocking of auth/DB
for security proofs (Principle IV). Storage tests need explicit bucket fixture setup/teardown (seed.sql
seeds Postgres rows only — R8 caveat).

**Target Platform**: Web app (server-rendered + client components) on Vercel fluid-compute; modern
evergreen browsers; submission flow usable at phone width.

**Project Type**: Web application (single Next.js app; Server Actions + RSC + client components) —
extends the existing app, no new project.

**Performance Goals**: Core Web Vitals — LCP < 2.5s, INP < 200ms, CLS < 0.1. Submission flow completes
in **< 60s on a phone** (SC-001). Approval queue is a single indexed `(centre_id, status)` read. Email
send is non-fatal and sub-second; never blocks a decision's success.

**Constraints**: Medical-doc confidentiality enforced at the storage/DB layer, never UI-only
(FR-032/033, SC-006). Balance never silently over-drawn — row-locked consume-on-approval (FR-013,
SC-004). Every mutation flows the canonical pipeline; sensitive writes emit audit rows. No parallel
auth/permission/nav/notification/form-validation system (FR-044). Files < 800 lines, functions < 50,
nesting ≤ 4. Vietnamese-first; ≥80% coverage.

**Scale/Scope**: Mid-size chain — ~10 centres, low-hundreds of staff, ~thousands of HR requests/year
(low volume vs tasks). This slice's scope: the nine-form engine, leave-balance ledger, minimal
timetable + conflict/cover, approval routing, documentation with protected access, notifications,
reporting, audit. Out of scope: payroll, performance reviews, recruitment, contracts, attendance,
scheduling-system features, org-chart/manager hierarchy, multi-step/threshold approval, new HR/Accounting
roles, historical-balance migration, external timetable sync (see spec Out-of-Scope).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

| Principle | Gate | Status |
|---|---|---|
| **I. Vietnamese-First (single vocabulary source)** | All labels/statuses/errors Vietnamese via the one shared vocabulary module; no raw enum id rendered. | ✅ PASS — new `<ENUM>_LABEL` maps added to `vocabulary.ts` (R10); email templates are Vietnamese content; Zod messages inline per the existing accepted exception. FR-045. |
| **II. Layered Security & Multi-Tenant Isolation (NON-NEGOTIABLE)** | Three layers (route guard / `assertPermission` / RLS), never collapsed; writes centre-narrow; JWT verified; fresh client per request; service-role server-only. | ✅ PASS **with an explicit, precedented read-scope choice** — HR request/balance tables use **restricted read** (own + centre-manager + super_admin), following the `audit_log` (Pattern C) and `personal_kpis` precedent because they carry sensitive personal data; writes remain centre-narrow via guarded RPCs (R5). Service-role client is used only for storage upload/mint/purge, server-only. See Complexity Tracking. |
| **III. Canonical Mutation Pipeline & Boundary Validation** | Every mutation: `withError → assertPermission → schema.parse → service`; discriminated `{data}\|{error}`; audit on sensitive writes; env validated at startup. | ✅ PASS — every HR action reuses the pipeline; new keys appended to the registry (FR-042/044); guarded RPCs emit `write_audit_log` (FR-040). New env (`RESEND_API_KEY`, `CRON_SECRET`) added to startup validation. |
| **IV. Test-First with Isolation Proof (NON-NEGOTIABLE)** | TDD, ≥80%; permission-rejection test per mutating action; centre-isolation test per RLS table; no mocked auth/DB; real local DB, sequential. | ✅ PASS — plus two new proof classes: a **medical-doc confidentiality** proof (peer cannot read another's attachment via storage RLS — SC-006) and a **no-double-spend** proof (concurrent approvals don't over-draw — SC-004). |
| **V. Atomicity, Idempotency & Immutability** | Compound/guarded writes atomic via a single DB function; stable idempotency; status-log on every transition; immutability. | ✅ PASS — `create_hr_request_with_log`, `approve_request` (row-locked), `reject/cancel/withdraw`, `respond_cover` are atomic Postgres functions; `hr_request_status_history` writes on every transition incl. creation (`from_status=null`); double-approval is a no-op via the `status='pending'` precondition (the idempotency guard); approved requests corrected by new rows via `supersedes_id`, never edited (FR-041). |

**Engineering standards**: size limits; camelCase↔snake_case at the service boundary; single data
seam (client never touches DB directly); pagination on every list (queue, my-requests, reports);
navigation-is-the-access-matrix (register `personnel` + HR sub-entries in the one `NAV_ITEMS` list);
CWV targets; explicit error handling with friendly Vietnamese. ✅ PASS.

**KPI-invariant analogy**: the constitution's `personal_kpis` rule (own-row, RLS-enforced) is the direct
precedent for `leave_balance` (own-row read; guarded-fn write) — the HR ledger follows it.

**Initial gate result: PASS.** One item is recorded in Complexity Tracking (restricted-read scope) as a
justified, precedented choice — not a violation.

**Post-Design re-check (after Phase 1): PASS.** Each principle now traces to a concrete artifact:
- I → [data-model.md](./data-model.md) enums-as-contract + `vocabulary.ts` label maps (research R10).
- II → [contracts/rls-policies.md](./contracts/rls-policies.md) (restricted-read SELECT + centre-narrow
  write clauses) and [contracts/storage-policies.md](./contracts/storage-policies.md) (medical-doc
  storage RLS + app-layer gate). Writes stay centre-confined via SECURITY INVOKER guarded fns.
- III → [contracts/hr-requests.actions.md](./contracts/hr-requests.actions.md) restates the pipeline in
  every action; audit mapping in data-model §14.
- IV → [quickstart.md](./quickstart.md) security-proof suite: permission-rejection + centre-isolation +
  medical-doc-confidentiality + no-double-spend, vs live local DB, sequential, no mocks.
- V → guarded Postgres functions (data-model §11) with row-lock + status-log-on-every-transition +
  supersede-don't-edit.
- The net-new seams (email R6, storage R8, cron R7) are introduced as reusable seams consistent with
  existing patterns (service-layer non-fatal side effect; RLS-guarded storage; secured route handler) —
  not forks. Residual **VERIFY-AT-IMPLEMENTATION** flags (research R12) are research cautions protecting
  Principles II/III (no memory-asserted infra), not violations. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-hr-requests/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── hr-requests.actions.md   # submit / decide / cancel-withdraw server-action contracts
│   ├── cover-timetable.actions.md  # timetable upsert, cover nominate/respond, conflict resolver
│   ├── config-balance.actions.md   # leave config, entitlement, balance adjust, reports
│   ├── rls-policies.md          # per-table RLS (restricted-read + centre-narrow write)
│   ├── storage-policies.md      # private bucket + storage RLS + upload/view/purge flow
│   └── notifications.md         # email trigger points + template prop contracts + cron jobs
├── checklists/
│   └── requirements.md  # Spec quality checklist (present; 16/16 PASS)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (app)/
│   │   └── nhan-su/                 # the reserved /nhan-su area — HR module mounts here
│   │       ├── page.tsx             # HR landing / my-requests + submit entry (all roles)
│   │       ├── duyet/               # approval queue (centre_manager / super_admin)
│   │       ├── lich-day/            # class timetable admin (centre_admin+)
│   │       ├── cau-hinh/            # leave policy config (super_admin)
│   │       └── bao-cao/             # reporting + coverage view (manager / super_admin)
│   ├── actions/
│   │   └── hr/                      # Server Actions (sole mutation entry points)
│   │       ├── submit-request.ts    # one engine entry (all nine types)
│   │       ├── decide-request.ts    # approve / reject (guarded)
│   │       ├── cancel-request.ts    # cancel / withdraw
│   │       ├── respond-cover.ts     # accept / decline nomination
│   │       ├── upsert-class.ts      # timetable
│   │       ├── update-config.ts     # leave policy config
│   │       ├── adjust-balance.ts    # opening-balance adjustment
│   │       └── attachment.ts        # upload / signed-view (service-role)
│   └── api/cron/
│       ├── pending-reminders/route.ts   # Vercel Cron → approver digest (secured)
│       └── purge-documents/route.ts     # Vercel Cron → medical-doc auto-purge (secured)
├── services/
│   ├── hr-request.service.ts        # submit/decide/cancel *Core (RPC + audit + email)
│   ├── cover.service.ts             # nominate/respond; conflict resolver invocation
│   ├── leave-balance.service.ts     # entitlement compute, adjust, consume/restore wrappers
│   ├── timetable.service.ts         # class upsert; session resolver (compute tuples)
│   ├── hr-config.service.ts         # policy/holiday/allowance/doc-policy CRUD
│   ├── attachment.service.ts        # upload/sign/purge (service-role storage)
│   └── notification.service.ts      # sendXxxNotification (Resend; non-fatal)
├── lib/
│   ├── domain/
│   │   ├── vocabulary.ts            # + HR <ENUM>_LABEL maps; + NAV_ITEMS HR entries
│   │   └── hr-forms.ts              # the FormDefinition registry (the engine)
│   ├── hr/
│   │   ├── working-days.ts          # pure: working-day count vs working-week + holidays
│   │   └── conflict.ts              # pure: (teacher, range) → affected session tuples
│   └── auth/permissions.ts          # + HR permission keys / grants
├── schemas/hr/                      # Zod schemas per form type + config/timetable
├── hooks/{queries,mutations}/hr/    # useHrRequests, useSubmitRequest, useDecideRequest, …
├── emails/                          # React Email templates (Vietnamese, narrow props)
└── components/                      # extracted shared Field/SelectField/DateField/FileField

supabase/
├── migrations/                      # NNN_hr_schema, _hr_rls, _hr_functions, _hr_storage, _employees_hr_cols
└── seed.sql                         # + classes, policy config, holidays, sample requests (idempotent)

tests/
├── integration/hr/                  # permission-gate + centre-isolation + confidentiality + no-double-spend (live local DB)
└── unit/hr/                         # working-days, conflict resolver, form-definition validation
```

**Structure Decision**: Single Next.js web application, extending the existing tree. HR pages mount at
the already-reserved `personnel` `/nhan-su` area (nav entry exists, scoped to `super_admin` +
`centre_manager`; sub-routes add their own access-matrix entries). Server Actions under
`src/app/actions/hr/*` are the sole mutation entry points; domain logic in `src/services/hr-*`; pure
logic (`working-days`, `conflict`) split out for unit tests; the form engine lives in
`lib/domain/hr-forms.ts`; storage/email/cron are new service seams. RLS + guarded functions + the
storage bucket live in `supabase/migrations/*`.

## Complexity Tracking

| Decision | Why needed | Simpler alternative rejected because |
|---|---|---|
| **Restricted read** on `hr_request`/`leave_balance` (not the default broad read) | HR records carry salary amounts, leave reasons, and medical-doc pointers; broad network-wide read would expose peers' sensitive personal data, violating FR-032/034 and SC-006. | Broad read + app-layer field hiding — rejected: the constitution requires DB-layer protection for sensitive data; UI hiding is not a security boundary. This mirrors the existing `audit_log` (Pattern C) and `personal_kpis` precedents, so it is a precedented scope choice, not new complexity. |
| **Three net-new infra seams** (email, private storage, cron) | The foundation has none, and the spec requires notifications, protected medical-doc attachments, and scheduled reminders/auto-purge. | Doing without — rejected: they are explicit requirements (FR-031/033a/035/036). Each is built as a single reusable seam consistent with existing patterns, not a fork. |
