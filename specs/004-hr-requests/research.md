# Research: HR Requests Module (slice 004) — Phase 0

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Format per item: **Decision** · **Rationale** · **Alternatives considered**. Items marked
⚠ **VERIFY-AT-IMPLEMENTATION** must be confirmed against live docs / the running stack before coding
(consistent with the constitution's "never assert auth/infra behavior from memory" posture and slice
001's research R5). Two external-doc research passes (email/scheduling, private storage) could not reach
Context7 live and were grounded in the actual repo conventions + model knowledge — every version-specific
API claim below is therefore flagged.

---

## R1 — Extend the foundation; do not fork it

**Decision**: Reuse the slice-001 seams verbatim — the canonical mutation pipeline (`withError →
assertPermission → schema.parse → *Core service → guarded RPC → write_audit_log`), the single
permission-key registry, the centre-tenancy RLS patterns, the single vocabulary source, the
nav/access-matrix (mount at the reserved `personnel` `/nhan-su` area), and the `audit_log` seam. Add
capability only where the foundation has none.

**Rationale**: Confirmed by codebase inspection — the pipeline, registry, tenancy, and audit seam
already exist and are exactly what FR-044 mandates binding to. Forking any of them violates
Constitution Principles I–III.

**Alternatives considered**: A standalone HR sub-app / parallel auth — rejected (violates FR-044 and
the constitution's single-vocabulary / single-registry / navigation-is-the-access-matrix rules).

---

## R2 — "One engine, nine forms": one table + Zod-validated JSONB payload

**Decision**: A single `hr_request` table. Cross-cutting fields that RLS, indexing, the ledger, or the
conflict resolver need (`request_type`, `submitter_id`, `centre_id`, `status`, `start_date`,
`end_date`, `day_part`, `working_days`, `amount`) are **real columns**; everything type-specific
(`reason`, `hours`, `vendor`, `event`, `repayment_intent`, …) lives in a `payload jsonb` validated
per-type by a Zod schema in a `FormDefinition` registry (`data-model.md` §10). The submission action is
one code path selecting a definition by type.

**Rationale**: Satisfies "one engine, not nine implementations" (FR-002, non-negotiable) while keeping
the database able to enforce tenancy (centre column), the ledger (dates/amount), and conflict detection
(dates) with real indexed columns — a pure-JSONB blob could not be RLS/indexed cleanly. Adding a tenth
form = one `FormDefinition`.

**Alternatives considered**: (a) nine tables — rejected (explicitly forbidden; duplicated pipeline).
(b) fully generic EAV/JSONB with no promoted columns — rejected (loses indexable tenancy/ledger
columns, weak validation).

---

## R3 — Timetable: compute sessions from the recurring pattern (no materialized session rows)

**Decision**: Store only recurring `class` definitions (weekday + time + date-range). A "session" is the
computed tuple `(class_id, session_date)`; the resolver enumerates sessions in a leave date-range on the
fly (respecting `is_active`, the recurrence window, and the holiday calendar). `cover_assignment` keys
off `(class_id, session_date)`.

**Rationale**: Keeps the timetable minimal (FR-016 "as small as possible") and avoids a materialization
job and drift between pattern edits and generated rows. A chain of ~10 centres over a leave window of
days-to-weeks yields a tiny session set — computing is cheap and always consistent. Explicitly avoids
becoming a scheduling system (Out-of-Scope).

**Alternatives considered**: Materialized `class_session` rows — rejected for v1 (adds a generation/
reconciliation burden and edit-drift; unnecessary at this scale). Revisit only if attendance or
capacity is ever added (which is out of scope).

⚠ **VERIFY-AT-IMPLEMENTATION**: half-day (`morning`/`afternoon`) overlap uses the class `start_time`/
`end_time` vs a centre AM/PM boundary — confirm the boundary is a config value, not hardcoded noon.

---

## R4 — Annual-leave ledger: consume-on-approval, no double-spend via row lock

**Decision**: `leave_balance` holds `entitlement/consumed/opening_adjustment`; `remaining` is computed,
not stored. Consumption happens **only** inside `approve_request(...)`, which does
`SELECT … FOR UPDATE` on the `(employee, leave_year)` balance row, recomputes working-days and remaining
against the **current** balance (FR-012 fresh-at-approval), then updates `consumed_days`. Cancellation/
withdrawal restores atomically. Double-approval is a no-op via the `status='pending'` precondition.

**Rationale**: The row lock is the concurrency guarantee (FR-013 no double-spend / SC-004). Consume-on-
approval + restore-on-cancel is FR-010. Fresh recompute defends against out-of-order approvals (Q5
clarification). Matches Principle V (atomic compound write via one Postgres function) and the slice-001
`change_task_status` precedent.

**Alternatives considered**: Optimistic version column + retry — workable but heavier than a row lock at
this volume. Consume-on-submission — rejected (contradicts FR-010; would need reversal on rejection).

---

## R5 — Restricted-read RLS for HR requests (precedent, not deviation)

**Decision**: `hr_request` / `leave_balance` use **restricted read** — submitter (own) ∪ centre_manager
(own centre) ∪ super_admin (all) — NOT the broad network-wide read used by `tasks`. Sensitive fields
(`amount`, medical-doc pointer) are further limited to approver-role + super_admin. Policy/reference
tables (config, holidays, classes) keep broad read.

**Rationale**: HR requests carry salary amounts, leave reasons, and medical pointers; broad read would
expose peers' personal data, violating FR-032/034. The codebase already has restricted-read precedents —
`audit_log` (Pattern C) and the constitution's `personal_kpis` own-row rule — so this is consistent with
Principle II's *intent* (writes centre-narrow; sensitive reads restricted), not a departure. Called out
explicitly in the Constitution Check.

**Alternatives considered**: Broad read like tasks + app-layer field hiding — rejected (constitution
requires DB-layer protection for sensitive data; UI hiding is not a security boundary).

---

## R6 — Transactional email: Resend + React Email, service-layer, non-fatal

**Decision**: Send via Resend (React Email templates) from inside the `*Core` service function, placed
**after** the mutation and `write_audit_log`, wrapped in its own `try/catch` that logs and never
rethrows — identical in shape to today's non-fatal audit call. Synchronous `await` (no queue) at this
volume. Email prop types are narrow (`{recipientName, formType, viewUrl, …}`) with **no** attachment/
content field, so no code path can leak a medical doc (FR-037). The email links back to the
authenticated in-app record.

**Rationale**: Drops into the existing service pattern as one more non-fatal side effect — no new
runtime, no forked logic. Supabase Auth SMTP only fires on `auth.*` events (can't model business
notifications). An event-reacting Edge Function forks the architecture into a second Deno runtime with
duplicated template/permission logic and a second local-parity target (YAGNI).

**Alternatives considered**: Supabase Auth SMTP (wrong trigger surface); Edge Function on DB events
(over-engineered for v1); a durable queue (premature — add only if volume/latency demands).

⚠ **VERIFY-AT-IMPLEMENTATION**: React Email peer-dep compatibility with this repo's React 19.2.x; Resend
SDK method signature + UTF-8/Vietnamese-diacritic rendering; Resend domain SPF/DKIM (a DNS step, not
code); whether Next.js 16's `after()` API is stable if the send is later moved off the response path.

---

## R7 — Scheduling: Vercel Cron → secured Next.js route handler (reminders + purge sweep)

**Decision**: Both the approver "pending requests" reminder digest (FR-036) and the medical-doc
auto-purge (FR-033a) run as Vercel Cron jobs (`vercel.json` / `vercel.ts` `crons`) hitting a Next.js
route handler guarded by a `CRON_SECRET` bearer check, calling the same TS service layer. Auto-purge is
a **scheduled sweep** (`WHERE purge_after < today AND not yet purged`), not a per-record TTL (Supabase
Storage has no native object TTL). Purge order: delete the storage object first, then mark/delete the
metadata row — never the reverse (avoids orphaned inaccessible objects); mismatches are logged for
reconciliation and retried next run (idempotent).

**Rationale**: The app already deploys on Vercel; Cron → route handler reuses the service layer with no
new runtime and the simplest local reproduction (a manual `curl` with the secret). `pg_cron`/`pg_net`
keeps scheduling in Postgres but adds an extension that must be present identically in the team's local
`supabase start` image — a real local-parity risk given the live-local test requirement, and the
deciding factor against it.

**Alternatives considered**: `pg_cron` + `pg_net` (local-parity risk; spot-check before ever
revisiting); Supabase Scheduled Edge Functions (forks the pattern, second runtime).

⚠ **VERIFY-AT-IMPLEMENTATION**: Vercel Cron frequency/count limits by plan tier; current Vercel-Cron→
route auth convention (signed header vs manual bearer); `@supabase/supabase-js` `.storage.remove()`
batch/idempotency semantics; where cadence/retention config lives (a settings table — `leave_policy_config`
— vs env var); none of the three options fire under local `next dev`, so document the manual trigger.

---

## R8 — Private storage + storage-RLS + service-role upload + short-TTL signed URLs

**Decision**: A **private** bucket `medical-documents` (`public=false`, `file_size_limit`,
`allowed_mime_types`). A metadata table `request_attachment` is the authoritative object→request link
(not path-parsing). **Upload** flows through the Server Action via the **service-role** client (enables
real byte-level MIME sniffing + size enforcement, and an atomic object+metadata write). **View** does an
app-layer permission check **first** (is the current user a centre_manager of the request's centre, the
uploader, or super_admin?), then mints a short-TTL (~120s) `createSignedUrl`. `storage.objects` also
carries RLS (join through `request_attachment` to the request's centre/role) as defense-in-depth for any
non-service-role path. **Delete** (purge job) removes the storage object then the metadata row.

**Rationale**: Enforces medical-doc confidentiality at the storage/DB layer (FR-032, not UI hiding).
Service-role mint bypasses storage RLS, so the **app-layer check is the real gate** for the view flow —
RLS is belt-and-suspenders. A metadata table (vs encoding everything in the path) gives a typed, indexed
join and a home for `purge_after`/audit. Because approval is centre-derived (no stored `approver_id`
until decided), the "is approver" check is **role+centre** (`centre_manager` of the request's centre),
not a person id — adapted from the research sketch. The uploader may view their own attachment; peers
never can (satisfies "never to peers").

**Alternatives considered**: Client-side `createSignedUploadUrl` (bandwidth win, but orphan-object risk
and no server-side content sniffing — rejected for sensitive small docs); path-only authorization
(brittle string parsing in RLS, nowhere for metadata — rejected); public bucket + app-only hiding
(rejected outright — not a DB-layer boundary).

⚠ **VERIFY-AT-IMPLEMENTATION**: whether the installed Storage version does true byte-level MIME
verification or only trusts the declared `Content-Type`; `createSignedUrl` RLS behavior per client
(anon enforces vs service-role bypasses); no native FK between `storage.objects` and `public` tables →
confirm partial-failure ordering; Next.js 16 Server-Actions body-size limit config key (must be raised
to the doc size cap); local storage has no `seed.sql` equivalent — the live-local test suite needs
explicit storage fixture setup/teardown (not just `supabase db reset`).

---

## R9 — UI / forms: schema-driven renderer over the existing plain-state + server-Zod convention

**Decision**: Do **not** introduce shadcn/ui or react-hook-form (neither is installed). Build a small
schema-driven form renderer that reads each `FormDefinition.fields` and renders with the existing
plain-`useState` + server-authoritative-Zod pattern, extracting the tasks `Field`/`SelectField`
components into a shared `src/components/` set. Reuse the same Zod schema on the client for light
pre-submit checks (Zod runs isomorphically); the server `schema.parse` remains authoritative.

**Rationale**: Matches the established convention (findings: no shadcn, no RHF; forms are plain state +
server Zod) and keeps the stack decision minimal (KISS/YAGNI, constitution governance). A dynamic
nine-form engine is well served by a definition-driven renderer without a new form library. Introducing
shadcn/RHF is a stack change that isn't required to meet any FR.

**Alternatives considered**: Add react-hook-form + zodResolver (nicer field-error UX, but a new
dependency and a second validation idiom — deferred, not needed for v1); adopt shadcn/ui now (a
separate design-system decision, out of scope for this slice).

---

## R10 — Vietnamese content organization

**Decision**: All labels (form types, statuses, statutory categories, day-parts, employment/contract
types) live in `vocabulary.ts` as `<ENUM>_LABEL` maps (existing pattern). Email templates are Vietnamese
content modules (React Email components) kept out of business logic. Zod messages remain inline in the
schema files (the existing, already-accepted exception in `schemas/tasks.ts`).

**Rationale**: Single-vocabulary-source (Principle I, FR-045). Follows the exact `<ENUM>_LABEL`
convention already in `vocabulary.ts`.

**Alternatives considered**: A general i18n library / JSON bundles — rejected (no precedent; the
`Record<enum,string>` map is the house pattern and dependency-free).

---

## R11 — Employee HR attributes & config store

**Decision**: `ALTER TABLE employees` to add `hire_date`, `employment_type`, `contract_type` (no
`manager_id` — routing is centre-derived, FR-023). Statutory/policy values live in `leave_policy_config`
+ `leave_event_allowance` + `public_holiday` + `doc_type_policy` (HR-editable; super_admin write).
Shipped figures are unverified starting points requiring HR/legal sign-off (FR-030).

**Rationale**: Entitlement needs `hire_date`/`employment_type`; config-in-DB satisfies FR-030's "never
hardcode statutory figures." Adding columns (not a new employee table) is the least-invasive extension.

**Alternatives considered**: A separate `employee_hr_profile` table — rejected (1:1 with employees; a
column add is simpler and matches the flat employee model).

---

## R12 — Consolidated VERIFY-AT-IMPLEMENTATION register

Carry these into the implement phase; confirm against live docs / the running stack, never from memory:

1. Auth API surface reused from slice 001 (`getClaims`, force-signout) — already flagged in slice-001 R5.
2. React Email ↔ React 19.2.x peer deps; Resend signature + Vietnamese diacritics; Resend DNS (SPF/DKIM).
3. Next.js 16 `after()` stability (if email moved off the response path).
4. Vercel Cron plan limits + current cron→route auth convention.
5. `pg_cron`/`pg_net` local-parity (only if R7 is ever revisited).
6. `supabase-js` `.storage.remove()` / `.createSignedUrl()` signatures; signed-URL RLS behavior per client.
7. Byte-level MIME verification vs declared Content-Type in the installed Storage version.
8. Next.js 16 Server-Actions body-size config key (raise to the doc size cap).
9. Storage↔Postgres partial-failure ordering (no native FK); reconciliation.
10. Live-local test suite needs explicit **storage** fixture setup/teardown (seed.sql only seeds Postgres rows).
11. Half-day AM/PM boundary and leave-year-boundary split attribution are config/design details to pin at build.
