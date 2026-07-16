# Phase 1 Data Model: Foundation — Auth, Roles, Tenancy & Tasks Vertical

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

App types are `camelCase`; DB columns are `snake_case`; conversion happens only at the service
boundary via shared helpers. **Enum string values are the contract** (stable); only Vietnamese
display labels live in `vocabulary.ts`. Every tenant table below carries `centre_id` and gets the
RLS policy set from [contracts/rls-policies.md](./contracts/rls-policies.md).

---

## Enums (contract values — labels in vocabulary.ts)

| Enum | Values (stable contract) |
|---|---|
| `AppRole` | `super_admin`, `centre_manager`, `centre_admin`, `sale_consultant`, `teacher` |
| `TaskStatus` | `TODO`, `DOING`, `DONE`, `BLOCK`, `RESCHEDULED`, `CANCELLED` |
| `Priority` | `HIGH`, `MID`, `LOW` |
| `TaskGroup` | `GIANG_DAY`, `TUYEN_SINH`, `VAN_HANH_LOP`, `CHAM_SOC_HV`, `SU_KIEN`, `HOP`, `MARKETING_TRUYEN_THONG`, `KHAC` |
| `TaskSource` | `ASSIGNED`, `SELF_CREATED`, `AD_HOC` *(generation sources FROM_ACTIVITY/FROM_WORKFLOW/RECURRING deferred to later slices)* |

**Board columns** = `TODO, DOING, DONE, BLOCK` only. `RESCHEDULED`/`CANCELLED` are excluded from
columns and surface via the status filter.

---

## Entities

### Centre
The unit of tenancy.

| Field (app) | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `name` | `name` | text | unique |
| `code` | `code` | text | short code; unique |
| `isFunctional` | `is_functional` | boolean | b2b/b2s/online/head_office marked functional |

- Relationships: 1—N `Employee`, 1—N `Task`.
- Scale: ~10 rows. Seed provides ≥2 for isolation tests.

### Department
First-class, network-wide organizational unit (FR-024f). **Flat, no `centre_id`** — spans all
centres.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `name` | `name` | text | unique network-wide |

- Relationships: 1—N `Employee`, 1—N `Task`.
- Reused by future HR + sales-performance modules. No management UI in this slice beyond assignment.

### Employee (Staff member)
A person who signs in. Linked 1:1 to a Supabase Auth user.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `authUserId` | `auth_user_id` | uuid | FK → `auth.users.id`, unique |
| `fullName` | `full_name` | text | |
| `email` | `email` | text | unique |
| `role` | `app_role` | `AppRole` | exactly one |
| `centreId` | `centre_id` | uuid | FK → Centre; exactly one |
| `departmentId` | `department_id` | uuid | FK → Department; exactly one (FR-024f) |
| `isActive` | `is_active` | boolean | deactivated → cannot sign in / act (FR-005) |
| `avatarColor` | `avatar_color` | text | per-employee color |

- **This table feeds the access-token hook** (role/centre/employee_id → JWT claims). Hook reads it
  as `supabase_auth_admin` (see research R1).
- Validation: `role`, `centreId`, `departmentId` required; `email` unique + format-valid.
- State: `isActive` true→false is a security-critical change → immediate forced revocation (FR-007a).

### Task
A unit of work belonging to a centre.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `centreId` | `centre_id` | uuid | FK → Centre; tenancy key |
| `assigneeId` | `assignee_id` | uuid | FK → Employee; **same centre** (FR-019) |
| `departmentId` | `department_id` | uuid | FK → Department (FR-018/024f) |
| `description` | `description` | text | required, non-empty |
| `group` | `group` | `TaskGroup` | required |
| `priority` | `priority` | `Priority` | required |
| `deadline` | `deadline` | date/timestamptz | required (FR-018) |
| `status` | `status` | `TaskStatus` | current status; starts `TODO` |
| `source` | `source` | `TaskSource` | `SELF_CREATED`/`ASSIGNED`/`AD_HOC` this slice |
| `note` | `note` | text | optional |
| `createdBy` | `created_by` | uuid | FK → Employee |
| `createdAt` | `created_at` | timestamptz | |

- Validation (Zod, at boundary): description non-empty; assignee must be an **active** employee of
  the **caller's centre**; deadline present; group/priority valid enum members.
- Invariant: creating a Task also writes an initial `TaskStatusLog` (`null → TODO`) atomically
  (FR-022).

### TaskStatusLog
Immutable record of one status change. Append-only.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `taskId` | `task_id` | uuid | FK → Task (cascade) |
| `centreId` | `centre_id` | uuid | denormalized for RLS tenancy |
| `fromStatus` | `from_status` | `TaskStatus?` | null at creation |
| `toStatus` | `to_status` | `TaskStatus` | |
| `changedById` | `changed_by_id` | uuid | FK → Employee |
| `note` | `note` | text | optional |
| `changedAt` | `changed_at` | timestamptz | |

- Written on **every** transition — auto-cycle or explicit (FR-021) — inside the status-change DB
  function (atomic with the task update).

### AuditLogEntry
Immutable general audit trail (FR-024g) — the seam future modules reuse.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `actorId` | `actor_id` | uuid | FK → Employee (the caller) |
| `action` | `action` | text | `<entity>.<verb>` e.g. `task.create`, `task.assign`, `employee.deactivate` |
| `entityType` | `entity_type` | text | e.g. `task`, `employee` |
| `entityId` | `entity_id` | uuid | affected row |
| `centreId` | `centre_id` | uuid | actor's centre (tenancy) |
| `metadata` | `metadata` | jsonb | optional; for `*.update`, `{ fields: [...] }` (not values) |
| `createdAt` | `created_at` | timestamptz | |

---

## Status transition rules (pure logic — `task-status.ts` ⚙)

```
Automatic cycle (no explicit target given):  TODO → DOING → DONE → TODO
Explicit-only states (entered/left only by naming them):
  BLOCK       — manual side branch; auto-cycle never enters or leaves it
  RESCHEDULED — explicit; exits the active board
  CANCELLED   — explicit; exits the active board
```

- `nextAutoStatus(current)` → the next in TODO→DOING→DONE→TODO (throws/refuses if `current` is an
  explicit-only state — those require a named target).
- `resolveTargetStatus(current, target?)` → if `target` omitted, auto-cycle; else validate the named
  transition is permitted, then return `target`.
- Every resolution that changes status ⇒ one `TaskStatusLog` row.

## Tenancy & access summary (per entity)

| Entity | SELECT | INSERT/UPDATE/DELETE | Notes |
|---|---|---|---|
| Centre | network-wide read | admin-managed (out of slice scope for writes) | reference data |
| Department | network-wide read | admin-managed (network-wide entity) | no `centre_id` |
| Employee | network-wide read | centre-confined writes; deactivate is audited | feeds JWT hook |
| Task | network-wide read (teacher: own-assigned only, app-layer `mine`) | centre-confined writes (FR-012/019) | tenancy key `centre_id` |
| TaskStatusLog | network-wide read | written only via status-change fn | append-only |
| AuditLogEntry | elevated-read (not broadly readable) | written only via audit fn | see rls-policies |

See [contracts/rls-policies.md](./contracts/rls-policies.md) for the exact policy clauses.
