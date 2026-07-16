# Quickstart & Validation: HR Requests Module (slice 004)

A run/validation guide proving the feature works end-to-end. References
[data-model.md](./data-model.md) and [contracts/](./contracts/) rather than duplicating them. No
implementation code here — that lives in `tasks.md` + the implement phase.

## Prerequisites

- Slice-001 foundation in place (auth, five roles, centre tenancy, audit seam, vocabulary/nav).
- Local Supabase stack on the jax-sales ports (5442x) running: `supabase start` (then `supabase db
  reset` to apply new HR migrations + reseed). **After any `config.toml` change** (e.g. storage), do a
  full `supabase stop && supabase start` then `db reset` (known GoTrue/config reload gotcha).
- Env: `RESEND_API_KEY`, `CRON_SECRET` present (validated at startup). For local, Resend can run in a
  test/sandbox mode; cron jobs are triggered manually (below).
- Seed adds: ≥2 centres, employees per role **with** `hire_date`/`employment_type`, ≥1 `class` per
  centre, a `leave_policy_config` row for the current year, holidays, and a few sample requests.

## Setup commands

```bash
supabase start
supabase db reset          # applies HR migrations + seed
pnpm dev                   # or the repo's dev script
pnpm test:integration      # live-local security + flow proofs (sequential, no mocks)
pnpm test:unit             # working-days, conflict resolver, form-definition validation
```

## Primary validation scenarios (map to spec User Stories)

### V1 — Submit annual leave in < 60s on a phone (US1, SC-001)
Log in as a `teacher`; open `/nhan-su`; pick **Xin nghỉ phép năm**; enter a future date range; confirm.
Expect: a `pending` request in "My requests"; the inline balance ("Bạn còn X ngày phép") shown before
submit; the flow completes at phone width without horizontal scroll.

### V2 — Approve & reject from one queue (US2, SC-002)
Log in as the `centre_manager` of that centre; open `/nhan-su/duyet`. Expect: only own-centre pending
requests, soonest-start first, each row showing who/what/when + **freshly computed** balance impact +
affected sessions + cover status + `hasAttachment`. Approve one; reject one (a reason is **required**).
Expect both leave the queue; submitter sees new status; each decision is in `audit_log` +
`hr_request_status_history`.

### V3 — Balance ledger: consume-on-approval, restore-on-cancel (US3, SC-004)
Approve an annual-leave request for D working days → `leave_balance.consumed_days` increases by exactly
D (working days per the configured working-week, holidays excluded). Withdraw it → balance restored.
Submit an over-balance request → warning shown, submission still allowed; manager sees the negative
impact.

### V4 — Class conflict → cover nomination → accept → approve (US4, SC-003)
As a teacher, submit leave overlapping a class you teach. Expect: affected sessions surfaced; a
same-centre covering teacher required; nominating a **double-booked** teacher is **blocked**. Nominee
accepts → manager can now approve leave + cover together. Confirm no approved leave leaves a session
uncovered.

### V5 — All nine forms on one engine (US5)
Submit one of each type; confirm correct per-type fields/validation, routing to the manager, and correct
side effect: only `annual_leave` moves the balance; `salary_advance`/`purchase`/`business_travel` notify
accounting on approval.

### V6 — Documentation upload + protected view (US6)
Attach a medical doc to a sick-leave request; the approver and super_admin can open it (short-TTL signed
URL); a peer cannot; it never appears in any list/report/email. (See Security Proof S3.)

### V7 — Notifications & reports (US7/US8)
Trigger submit/decide/nominate/money-approve → correct Vietnamese emails to correct recipients, none
containing attachment content. Generate the coverage report ("who is off next week & who is covering")
and a leave-by-employee report; export.

## Security proofs (Constitution IV — live local DB, sequential, no mocks)

| Proof | Asserts | Spec |
|---|---|---|
| **S1 Permission-rejection** | Every mutating HR action rejects an unauthorized role with `ForbiddenError` (e.g. a `teacher` calling `decideRequest`). | FR-042 |
| **S2 Centre-isolation** | A `centre_manager`/`teacher` of centre A cannot read or decide a request, or read a `leave_balance`, in centre B; a peer cannot read another's request in the same centre (restricted read). | FR-043, R5 |
| **S3 Medical-doc confidentiality** | A same-centre peer is denied the attachment metadata row (RLS) and any object read; the centre's manager + super_admin can mint a signed URL; a centre-B manager cannot; no list/report/email projection contains the object. | FR-032/033, SC-006 |
| **S4 No double-spend** | Two concurrent `approve_request` calls against the same balance do not over-draw beyond the recorded discretionary over-draw; the `SELECT … FOR UPDATE` serializes them. | FR-013, SC-004 |

## Cron (manual local trigger)

```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/pending-reminders
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/purge-documents
```
Expect: reminder digests to managers with non-empty queues; expired medical docs removed from storage
**then** their metadata rows, with an audit entry — no orphaned objects.

## Definition of done (this slice)

Both proofs green (S1–S4) **and** the working vertical (each of the five roles exercises the module per
its rights: submit → cover → decide → record) **and** ≥80% coverage — plus every statutory figure marked
as requiring HR/legal sign-off before launch.
