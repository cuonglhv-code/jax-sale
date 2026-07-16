# Quickstart & Validation: Sales Performance & KPI Tracker

Runnable scenarios that prove the slice works end-to-end. Assumes the slice-#001 local Supabase stack
(ports `5442x`) and the seeded roles. Details live in the contracts/data-model; this is the run guide.

## Prerequisites

- Local Supabase running for jax-sales (do **not** stop the sibling jax-crm stack on `5432x`).
- After adding the KPI migrations, apply them and reseed:
  ```bash
  # If config.toml is unchanged, a reset is enough; otherwise `supabase stop && supabase start` first.
  supabase db reset
  ```
- Seed adds, per centre: a `sale_consultant`, a `centre_manager`/`centre_admin`, plus a `super_admin`
  and ≥2 centres in ≥2 departments (needed for the isolation + department-rollup proofs).
- `npm run dev`; sign in as each seeded role to exercise tiers.

## Happy path (US1 → US7 → US3/US4/US5)

1. **Record (consultant)** — as `sale_consultant`, open `/hieu-suat`, select the current period, enter
   `enrolments_closed = 8`, `revenue = 120000000`, save.
   → rows persist as **`Chờ duyệt`**; a `null → pending` status-log exists; the values show with a
   provisional attainment. Excluded from any rollup.
2. **Set target (manager)** — as that centre's `centre_manager`, open the target editor, set the
   consultant's `enrolments_closed` target = 10.
   → the consultant's attainment for that metric now shows `8/10` (`behind`).
3. **Approve (manager)** — open the approval queue, approve both pending rows.
   → status → **`Đã duyệt`**; a `pending → approved` log exists; the rows now count in the centre
   dashboard + leaderboard.
4. **Reject loop** — record a third value, have the manager **reject** it → `Bị từ chối`; edit it as
   the consultant → back to `Chờ duyệt` (new log), excluded again until re-approved.
5. **Department target (admin)** — as `super_admin`, set a department target; the network dashboard
   shows department attainment (summed approved actuals across centres for that department).
6. **Dashboard/leaderboard tiers** — sign in as each role: consultant sees only own (no leaderboard);
   manager sees own centre ranked; `super_admin` sees all centres + departments.
7. **Export** — as a manager, export → a CSV (Vietnamese headers) and a branded PDF, both containing
   only the manager's centre rows for the period.

## Validation scenarios → acceptance criteria

| Scenario | Expect | Proves |
|---|---|---|
| Consultant UPDATE touching `target`/`approval_status`/peer row | DB exception / 0 rows | AC-1.2, SC-003 |
| Consultant edits an approved actual | reverts to `pending` + new log | AC-1.4/7.5 |
| Consultant calls approve | denied (no key) | AC-7.4, SC-003 |
| Centre-A manager approves centre-B row | `Không tìm thấy` (RLS-invisible) | AC-6.3/7.3, SC-004 |
| Non-admin sets a department target | denied | AC-2.4, SC-005 |
| Consultant reads dashboard | own rows only; no leaderboard surface | AC-3.1/4.3, SC-006 |
| Teacher opens `/hieu-suat` | not in nav; 0 KPI rows | D-TEACHER |
| Metric with NULL target | shows `Chưa đặt mục tiêu`, never 0% | AC-1.5/2.5, SC-002 |
| Pending/rejected value in a rollup | absent from aggregates + ranking | AC-3.7, SC-009 |
| Target set to 0 | rejected (Vietnamese message) | D-ZERO |
| Every transition (create/approve/reject/edit) | a status-log row exists | AC-6.4, SC-007 |

## Test commands

```bash
npm run test              # Vitest: attainment/rollup unit + security integration (live DB, no mocks)
npm run test -- kpi       # this slice's suites
npm run test:coverage     # ≥ 80% for attainment engine + tenancy/permission/approval boundaries (SC-010)
```

Integration tests build a Supabase client from each seeded user's real access token (no auth/DB
mocking — constitution IV) and run **sequentially** against the live local DB.
