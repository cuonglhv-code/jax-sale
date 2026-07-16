# Data Model: HR Requests Module (slice 004)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

This model **extends** the slice-001 schema (`centres`, `departments`, `employees`, `tasks`,
`task_status_logs`, `audit_log`). It reuses the established conventions verbatim:

- **Enums are the contract** — string values are stable (defined in `src/lib/data/types.ts` as `as
  const` tuples); Vietnamese display labels live only in `src/lib/domain/vocabulary.ts`. DB stores
  enums as `text` + `CHECK` (no native Postgres enum type), matching `employees.app_role`.
- **Naming boundary** — DB columns `snake_case`; app types `camelCase`; converted only at the service
  boundary via the shared `case.ts` helper.
- **RLS patterns** — reuse the three documented patterns from
  `specs/001-foundation-auth-tenancy/contracts/rls-policies.md`: **A** centre-partitioned (broad read /
  own-centre write), **B** network-wide reference (broad read / super_admin write), **C** elevated /
  restricted read. HR request tables use a **restricted-read** variant (own-row + centre-manager +
  super_admin) — see §12 and the RLS contract.
- **Claims** — RLS reads `auth.jwt()->>'centre_id' | 'employee_id' | 'app_role'` (injected by the
  existing access-token hook). No new claim is required.

---

## 1. New enums (contract values → Vietnamese labels in `vocabulary.ts`)

| Enum | Values (stable contract) | Notes |
|---|---|---|
| `RequestType` | `annual_leave`, `sick_leave`, `personal_leave`, `unpaid_leave`, `shift_swap`, `overtime`, `salary_advance`, `purchase`, `business_travel` | The nine form types. Drives the form-definition registry (§10). |
| `RequestStatus` | `pending`, `awaiting_cover`, `approved`, `rejected`, `cancelled`, `withdrawn` | Lifecycle (§9). `awaiting_cover` = submitted but a nominated cover has not yet accepted. |
| `LeaveDayPart` | `full`, `morning`, `afternoon` | Half-day granularity (FR-015). `morning`/`afternoon` ⇒ 0.5 day and half-day conflict scope. |
| `CoverStatus` | `nominated`, `accepted`, `declined`, `released` | Cover-nomination lifecycle (§9). |
| `EmploymentType` | `full_time`, `part_time` | Drives pro-rated accrual (FR-009/046). |
| `ContractType` | `indefinite`, `fixed_term`, `probation`, `seasonal` | Vietnamese labour contract classes; labels in vocabulary. Accrual eligibility is config-driven, not hardcoded per value. |
| `PersonalLeaveEvent` | `marriage_self`, `marriage_child`, `bereavement`, `other` | Statutory paid-personal-leave categories (FR-007); day-allowance per event is **config**, not code. `other` = unpaid-by-agreement path. |
| `MoneyRequestKind` *(derived, not stored)* | `salary_advance` \| `purchase` \| `business_travel` | The three forms that notify accounting on approval (FR-025). Derived from `RequestType`; listed for the router. |

Permission keys added to the single registry `src/lib/auth/permissions.ts` (§13).

---

## 2. Employee extensions (`ALTER TABLE public.employees`)

New nullable-then-backfilled columns (net-new; none exist today — confirmed by inspection):

| Column | Type | Notes |
|---|---|---|
| `hire_date` | `date` | Seniority accrual + mid-year pro-rating (FR-009). |
| `employment_type` | `text` CHECK ∈ `EmploymentType` | Pro-rated accrual (FR-046). Default `full_time` on backfill. |
| `contract_type` | `text` CHECK ∈ `ContractType` | Accrual eligibility (config-driven). |

**No `manager_id`** is added — approval routing is centre-derived (FR-023). No RLS change to
`employees` beyond exposing these columns (already broad-read).

---

## 3. Configuration (network-wide, HR-editable) — Pattern B

Statutory/policy values live in the DB, HR-editable, never in code (FR-030). The single source of
statutory truth; **requires HR/legal sign-off before launch**.

### `leave_policy_config` (single active row per leave-year, versioned)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `leave_year` | `int` unique | e.g. 2026. |
| `annual_baseline_days` | `numeric(4,1)` | Default 12.0 (unverified). |
| `seniority_extra_days_per_years` | `numeric(4,1)` | +1 day per N years. |
| `seniority_years_step` | `int` | N (default 5). |
| `leave_year_start` | `text` CHECK ∈ (`calendar`) | v1 = calendar year (config-extensible to anniversary). |
| `working_week` | `int[]` | ISO weekday numbers counted as working (e.g. `{1,2,3,4,5}`); drives day-counting (FR-015). |
| `notice_days` | `int` | Advisory (FR-007/notice). |
| `carryover_enabled` | `bool` | Default false (use-it-or-lose-it). |
| `carryover_cap_days` | `numeric(4,1)` null | Cap if enabled. |
| `medical_doc_retention_days` | `int` | Auto-purge window (FR-033a). |
| `part_time_prorate` | `bool` | Whether part-time accrues pro-rated. |
| `updated_by` / `updated_at` | uuid / timestamptz | Audited. |

### `leave_event_allowance` — statutory paid-personal-leave day allowances (FR-007)

`(id, event ∈ PersonalLeaveEvent, allowance_days numeric, paid bool)`. Config rows, e.g.
`marriage_self → 3 paid`. Unverified starting values; HR sign-off.

### `public_holiday` — holiday calendar (FR-015)

`(id, holiday_date date unique, name text)`. Network-wide (Pattern B). Excluded from working-day
counts. (Per-centre holidays out of scope v1.)

### `doc_type_policy` — accepted attachment types/size (FR-031)

`(id, request_type, max_size_bytes int, allowed_mime text[], required bool)`. Config, so limits change
without redeploy.

---

## 4. Class timetable (minimal) — Pattern A (centre-partitioned)

Deliberately minimal — exists **only** to answer "which class sessions does this leave hit?" (FR-016).
**No materialized per-session rows**: sessions are *computed* from the recurring pattern over a date
range by the resolver (§11) — see research R3 for the compute-vs-materialize decision.

### `class` (recurring class definition)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `centre_id` | uuid → centres | Tenancy (Pattern A). |
| `course_label` | `text` | Free text v1 (no course entity yet). |
| `teacher_id` | uuid → employees | Assigned teacher (must be same centre — guarded). |
| `weekday` | `int` CHECK 1–7 | ISO weekday of the recurring slot. |
| `start_time` / `end_time` | `time` | Slot time (drives AM/PM half-day overlap). |
| `start_date` / `end_date` | `date` | Recurrence window. |
| `is_active` | `bool` default true | |

A **session** is the tuple `(class_id, session_date)` where `session_date` falls on `weekday`, within
`[start_date, end_date]`, `is_active`, and not a `public_holiday`. Cover and conflict logic key off this
tuple; no session table is stored.

---

## 5. Core request table — `hr_request` (Pattern A write / restricted read)

One table, all nine types (the engine). Cross-cutting concerns are real columns (for RLS, indexing,
ledger, conflict detection); type-specific fields live in `payload` (Zod-validated per type, §10).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `request_type` | `text` CHECK ∈ `RequestType` | |
| `submitter_id` | uuid → employees | The requester. |
| `centre_id` | uuid → centres | Submitter's centre; tenancy + queue scoping. |
| `status` | `text` CHECK ∈ `RequestStatus` default `pending` | §9. |
| `start_date` / `end_date` | `date` null | Leave family + business travel; null for overtime/money. |
| `day_part` | `text` CHECK ∈ `LeaveDayPart` null | Half-day (leave). |
| `working_days` | `numeric(4,1)` null | Computed working-day count (annual leave); indicative at submit, authoritative recompute at approval (FR-012). |
| `amount` | `numeric(12,2)` null | Money forms (salary advance / purchase / travel cost). Sensitive (§12). |
| `payload` | `jsonb` | Type-specific fields (reason, hours, vendor, medical-doc flag, event category, etc.). |
| `decided_by` | uuid → employees null | Approver/rejecter. |
| `decided_at` | timestamptz null | |
| `decision_reason` | `text` null | Required on reject (FR-027). |
| `supersedes_id` | uuid → hr_request null | Correction link — approved requests corrected by NEW record (FR-041), never edited. |
| `created_at` | timestamptz default now() | |

Indexes: `(centre_id, status)` (queue), `(submitter_id, created_at)` (my requests),
`(request_type, status)` (reports), `(start_date, end_date)` (conflict/coverage). Sensitive fields
(`amount`, medical pointer) are protected at the **database layer** by the restricted-read row policy —
a peer cannot read the row at all (§12).

### `hr_request_status_history` (append-only — Principle V)

Mirrors `task_status_logs`: `(id, request_id → hr_request, from_status text null, to_status text,
changed_by uuid → employees, reason text null, created_at)`. Every transition writes a row; creation
writes a `from_status = null` row. Append-only; never updated/deleted.

---

## 6. Cover assignments — `cover_assignment` (Pattern A, same-centre)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `request_id` | uuid → hr_request | Owning leave/shift-swap request. |
| `class_id` | uuid → class | Affected class. |
| `session_date` | `date` | The specific affected session (computed tuple). |
| `nominee_id` | uuid → employees | Covering teacher — MUST be active teacher of the class's centre (FR-018); a hard-conflicted nominee is blocked at nomination (FR-020). |
| `status` | `text` CHECK ∈ `CoverStatus` default `nominated` | §9. |
| `responded_at` | timestamptz null | |

A request with any `nominated` (unaccepted) cover sits in `awaiting_cover` and cannot be approved
(FR-019). All covers `accepted` ⇒ eligible for approval.

---

## 7. Attachments — `request_attachment` (restricted; storage-backed)

Metadata row mapping a storage object to a request, enabling storage-layer access control (see
research R2 + `contracts/storage-policies.md`). Medical docs are the sensitive case.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `request_id` | uuid → hr_request | |
| `storage_path` | `text` unique | Path in the private bucket; encodes `request_id`. |
| `mime_type` | `text` | Validated against `doc_type_policy`. |
| `size_bytes` | `int` | Validated against `doc_type_policy`. |
| `is_medical` | `bool` | Medical docs get the strict approver+super_admin rule (FR-032). |
| `uploaded_by` | uuid → employees | |
| `purge_after` | `date` null | Retention deadline (FR-033a); set from config on the request becoming non-live. |
| `created_at` | timestamptz | |

Never surfaced in list views/exports/emails (FR-033) — only an `hasAttachment` boolean is exposed in
those contexts.

---

## 8. Annual-leave ledger — `leave_balance` (restricted read; guarded write)

The authoritative balance (FR-008). One row per `(employee_id, leave_year)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid → employees | |
| `leave_year` | `int` | |
| `entitlement_days` | `numeric(4,1)` | Computed from config (baseline + seniority, pro-rated). |
| `consumed_days` | `numeric(4,1)` default 0 | Drawn down on approval, restored on cancel/withdraw. |
| `opening_adjustment_days` | `numeric(4,1)` default 0 | Audited manual opening balance (FR-047). |
| `updated_at` | timestamptz | |
| unique | `(employee_id, leave_year)` | |

`remaining = entitlement_days + opening_adjustment_days − consumed_days` (computed, not stored —
Engineering Standard "derived values computed, not stored"). Only `annual_leave` mutates
`consumed_days`; the other three leave types never touch it (FR-014).

---

## 9. State machines

### RequestStatus

```
                 ┌──────────── cancel ───────────┐
                 ▼                                │
   (create) → pending ──approve──────────────► approved ──withdraw──► withdrawn
                 │  │                              (consume balance)   (restore balance)
                 │  └──reject(reason)──► rejected
                 │
   (create w/ unaccepted cover) → awaiting_cover ──all covers accepted──► pending → …
                                        │
                                        └── cover declined & no alt / cancelled ──► cancelled
```

- Balance consumed **only** on `pending → approved` for `annual_leave`; restored on
  `approved → withdrawn` and on cancelling a request that had consumed (guarded, §11).
- `approved` is terminal except `withdraw`. Approved rows are never edited (corrections = new row via
  `supersedes_id`, FR-041).
- Every arc writes an `hr_request_status_history` row and an `audit_log` row.

### CoverStatus

```
nominated ──accept──► accepted
    │                    │
    ├──decline──► declined (request → back to submitter for re-nomination)
    └── request cancelled / session cancelled ──► released
```

Post-approval decline or session-cancellation ⇒ owning request flagged for re-resolution (FR-022;
surfaced, parties notified).

---

## 10. Form-definition abstraction (the engine)

A single registry `src/lib/domain/hr-forms.ts` maps each `RequestType` → a **form definition**:

```
FormDefinition = {
  type: RequestType,
  fields: FieldDef[],           // rendered dynamically; labels via vocabulary.ts
  schema: ZodSchema,            // boundary validation (payload + promoted columns)
  requiresDocument: boolean | (payload) => boolean,   // sick=true; personal=by event
  isMoneyForm: boolean,         // salary_advance | purchase | business_travel → notify accounting
  sideEffect: 'draw_annual_balance' | 'none',         // only annual_leave draws
  conflictScoped: boolean,      // leave-family + shift_swap → run class-conflict resolver
}
```

The submission action is **one** code path: pick definition by `type` → `schema.parse(raw)` →
type-specific validation (dates, balance warn, conflict, doc-required) → atomic create RPC. Adding a
tenth form = adding one `FormDefinition`, no new pipeline (FR-002). Per-type field/validation summary:

| Type | Promoted cols | Payload | Doc | Conflict | Side effect |
|---|---|---|---|---|---|
| annual_leave | start/end/day_part/working_days | — | no | yes | draw balance (warn if over, FR-012) |
| sick_leave | start/end/day_part | — | **required** (medical) | yes | none |
| personal_leave | start/end/day_part | `event`, `reason` | by event | yes | none |
| unpaid_leave | start/end/day_part | `reason` | no | yes | none |
| shift_swap | — | `note` | no | yes (standalone) | none |
| overtime | — | `date`, `hours`, `justification` | no | no | none |
| salary_advance | amount | `repayment_intent` | no | no | none (notify accounting) |
| purchase | amount | `item`, `vendor`, `justification` | no | no | none (notify accounting) |
| business_travel | start/end/amount | `destination`, `justification` | no | no | none (notify accounting) |

---

## 11. Guarded / atomic writes (Principle V) — Postgres functions

All compound writes go through `plpgsql` functions (SECURITY INVOKER so RLS still confines centre —
matching the slice-001 convention; a SECURITY DEFINER function is used only where a cross-scope check
is unavoidable):

| Function | Guards / atomicity |
|---|---|
| `create_hr_request_with_log(...)` | Insert `hr_request` + initial `from_status=null` history row + any `cover_assignment` rows in one txn. Sets status `pending` or `awaiting_cover`. |
| `respond_cover(cover_id, accept bool)` | Nominee-only; flips `CoverStatus`; if all covers accepted, moves request `awaiting_cover → pending`; blocks accept if nominee now hard-conflicts. |
| `approve_request(request_id, ...)` | **`SELECT … FOR UPDATE` on the `leave_balance` row** (annual leave) → recompute working-days & remaining against current balance (FR-012) → set `consumed_days += days` → flip status → history + audit. The row lock is the no-double-spend guarantee (FR-013). Forbids self-approval; requires all covers accepted. |
| `reject_request(request_id, reason)` | Requires non-empty reason; flips status; history + audit. No balance change. |
| `cancel_or_withdraw_request(request_id)` | Restores `consumed_days` if the request had drawn balance; flips status; history + audit. |
| `adjust_opening_balance(employee_id, year, delta, reason)` | super_admin only; audited (FR-047). |
| `recompute_entitlement(employee_id, year)` | Derives `entitlement_days` from `leave_policy_config` + `hire_date`/`employment_type`. |

Idempotency: double-approval is prevented by the `status = 'pending'` precondition inside
`approve_request` (a retried call finds `approved` and no-ops) — the status guard is the idempotency
key, consistent with Principle V.

---

## 12. Read/write scope per entity (RLS summary — full policies in `contracts/rls-policies.md`)

**Deliberate restricted-read decision:** HR requests carry sensitive personal data (salary amounts,
leave reasons, medical pointers), so — unlike `tasks` (broad read) — they follow the **restricted-read**
precedent already in the codebase (`audit_log` Pattern C, and the constitution's `personal_kpis`
own-row rule). This is consistent with Principle II's intent (writes centre-narrow; sensitive reads
restricted), not a deviation from it. See Constitution Check in plan.md.

**Sensitive fields** (`amount`, medical pointer) are protected at the **database layer** by the
restricted-read row policy — a peer cannot read the row at all, so cannot read `amount`; omitting
`amount` from broad/queue projections at the service layer is secondary defense-in-depth, not the
primary control (FR-034).

| Entity | Read | Write |
|---|---|---|
| `hr_request` | submitter (own) ∪ centre_manager (own centre) ∪ super_admin (all) | insert own-centre (submitter); decision writes via guarded fn (centre_manager/super_admin) |
| `hr_request` `.amount` / medical pointer | approver + super_admin only (row-guarded — peers cannot read the row, FR-034) | — |
| `hr_request_status_history` | same scope as parent request | insert-only via guarded fn |
| `cover_assignment` | request scope ∪ nominee (own nominations) | guarded fn |
| `request_attachment` (metadata) | approver + super_admin (medical); submitter sees own non-medical | insert via upload flow |
| storage object (medical) | approver + super_admin only (storage RLS, research R2) | signed-URL upload |
| `leave_balance` | employee (own) ∪ centre_manager (own centre) ∪ super_admin | guarded fn only |
| `leave_policy_config`, `leave_event_allowance`, `public_holiday`, `doc_type_policy` | broad read (policy is not secret) | super_admin write (Pattern B) |
| `class` | broad read (schedules not sensitive) | centre_admin/super_admin own-centre write (Pattern A) |
| `employees` (new cols) | as today (broad read) | super_admin (HR attrs) |

---

## 13. Permission keys added (single registry `permissions.ts`)

| Key | Granted to |
|---|---|
| `hrRequest.submit` | all roles (validation gates form eligibility) |
| `hrRequest.decide` | centre_manager (+ super_admin catch-all) |
| `hrRequest.cancel` | all (own requests only — app-checked) |
| `cover.respond` | all (own nominations only — app-checked) |
| `timetable.manage` | centre_admin, centre_manager (+ super_admin) |
| `hrConfig.manage` | super_admin |
| `leaveBalance.adjust` | super_admin |
| `hrReport.view` | centre_manager, super_admin |

No parallel authorization system — these extend `PERMISSION_KEYS` / `ROLE_GRANTS` only (FR-044).

---

## 14. Audit & immutability mapping

- Every guarded fn emits `write_audit_log(action, entity_type, entity_id, metadata)` with
  `action ∈ {hrRequest.submit, hrRequest.approve, hrRequest.reject, hrRequest.cancel,
  hrRequest.withdraw, cover.nominate, cover.respond, leaveBalance.adjust, timetable.upsert,
  hrConfig.update}` (FR-040). Metadata records changed fields, not sensitive values.
- `hr_request_status_history` is the per-request immutable timeline; `audit_log` is the cross-cutting
  actor trail. Approved requests are never mutated — corrections create a new `hr_request` linked by
  `supersedes_id` (FR-041).
