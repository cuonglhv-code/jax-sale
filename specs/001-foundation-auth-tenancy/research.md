# Phase 0 Research: Foundation — Auth, Roles, Tenancy & Tasks Vertical

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md)

Stack was decided at plan time: **Next.js 16 + Supabase (Postgres + RLS + Auth), Zod, TanStack
Query, Vitest against a live local Supabase stack (sequential).** This document resolves the
non-obvious *how* for each load-bearing mechanism, grounded in current Supabase documentation
(mined 2026-07-16) with verify-at-implementation flags where the local docs were silent.

---

## R1 — Injecting role/centre/employee into the JWT (Custom Access Token Auth Hook)

**Decision**: Use Supabase's **Custom Access Token Auth Hook** — a `public.custom_access_token_hook(event jsonb) returns jsonb`
PL/pgSQL function that reads `event->'claims'`, adds `app_role`, `centre_id`, `employee_id` via
`jsonb_set`, and returns the mutated `event`. RLS policies then read them directly as
`auth.jwt() ->> 'centre_id'`, with no per-row join.

**Rationale**: Top-level claims read straight from the JWT are the documented highest-performance
path for tenant RLS (no join, cacheable). Confirmed by docs.

**Key details (confirmed in docs)**:
- Hook runs as `supabase_auth_admin`; grant `usage on schema public` + `execute on function` to it,
  and `revoke execute from authenticated, anon, public`. Any table the hook reads (the employee
  table holding role/centre/department) needs `grant all ... to supabase_auth_admin` + a
  `for select to supabase_auth_admin using (true)` policy.
- **Do NOT** tag the token hook `security definer` (docs recommend against it — it would run with
  the broad `postgres` role); instead grant to `supabase_auth_admin` explicitly.
- Enable locally via `config.toml`:
  `[auth.hook.custom_access_token] enabled=true, uri="pg-functions://postgres/public/custom_access_token_hook"`.

**Staleness caveat (verbatim)**: *"even if you remove a user from a team and update the
`app_metadata` field, that will not be reflected using `auth.jwt()` until the user's JWT is
refreshed."* → This is exactly why FR-007a splits ordinary changes (≤30 min, bounded by access-token
TTL) from security-critical ones (immediate forced revocation, see R5).

**Alternatives considered**: per-row join from `auth.uid()` to an employee table on every policy
(rejected — docs benchmark security-definer/ join lookups at ~178,000ms vs ~12ms for cached claim
reads); storing role/centre in `app_metadata` only (rejected — still needs a claim surface for RLS,
and same staleness profile).

---

## R2 — RLS policy shape: broad read, centre-narrow write

**Decision**: One policy **per command** on every tenant table:
- `FOR SELECT TO authenticated USING (true)` — permissive network-wide read (broad read).
- `FOR INSERT TO authenticated WITH CHECK ((select auth.jwt() ->> 'centre_id') = centre_id::text)`.
- `FOR UPDATE TO authenticated USING (<own centre>) WITH CHECK (<own centre>)` — both clauses.
- `FOR DELETE TO authenticated USING (<own centre>)`.

**Rationale**: Directly encodes the constitution's Layer-3 rule (permissive network-wide SELECT,
centre-confined INSERT/UPDATE/DELETE) and FR-012/013/016. Confirmed clause mapping from docs:
`INSERT`→`with check` only; `UPDATE`→both `using`+`with check`; `DELETE`/`SELECT`→`using`.

**Performance details (confirmed)**:
- Wrap claim/function calls in a subquery — `(select auth.jwt() ->> 'centre_id')` — so Postgres runs
  an `initPlan` and caches per-statement (docs: ~95% faster; 179ms→9ms class of improvement).
- Always specify `TO authenticated` so policies never execute for `anon`.
- Index every column used in a policy (e.g. `centre_id`, `assignee_id`).
- Client queries also add `.eq('centre_id', …)` filters even though RLS enforces it — helps the
  planner (docs recommend "add filters to every query").
- **UPDATE requires a matching SELECT policy** to exist (docs caveat) — satisfied by the permissive
  SELECT above.

**Alternatives considered**: a single `FOR ALL` policy (rejected — cannot express "read broad but
write narrow" in one clause); app-only tenancy without RLS (rejected — violates FR-013/SC-003 and
constitution Principle II; the whole point is DB-authoritative isolation).

---

## R3 — Guarded/compound writes: status transitions & the audit seam

**Decision**: Route the guarded writes through **Postgres functions** so guard-and-write cannot race
and partial writes are impossible:
- `change_task_status(task_id, target?, note?)` — resolves the next status (auto-cycle or explicit),
  updates the task, and inserts the `task_status_log` row in one function, returning the new state.
- Task **creation** likewise writes the task + its initial `null → TODO` status-log row atomically.
- `audit.write_audit_log(...)` for sensitive writes — the general audit seam (FR-024g).

**Rationale**: The REST/JS client has no multi-statement transaction primitive; a single function is
the constitution's prescribed atomicity mechanism (Principle V) and guarantees
status-log-on-every-transition (FR-021/022). Cross-centre fan-out is **not** in this slice (no task
generation), so no `SECURITY DEFINER` cross-centre write function is needed yet — deferred to the
activities/workflow slices.

**Pure-logic split (unit-testable, ⚙)**: the status-cycle decision (`TODO→DOING→DONE→TODO`; BLOCK/
RESCHEDULED/CANCELLED explicit-only) lives in a pure `task-status.ts` module; the function calls into
the same rule conceptually, but the pure module is what unit tests target for the transition matrix.

**Alternatives considered**: two sequential JS calls (update, then log) — rejected for status
changes because a failure between them breaks the "every transition logged" invariant; acceptable
only for simple CRUD + audit where the sole risk is a missing log, never corrupt business data
(per constitution §6). Audit-log write stays a post-write call under that accepted trade-off.

---

## R4 — SECURITY DEFINER conventions (for later slices; documented now)

**Decision**: When later slices need privileged cross-centre writes (activity/workflow task
fan-out), use `SECURITY DEFINER` functions in a **private (non-exposed) schema** with a **pinned
`search_path = ''`** (or `pg_catalog`), re-checking the caller's centre via `auth.jwt()` inside the
function before writing.

**Rationale**: Confirmed docs guidance — security-definer runs as creator (gains `bypassrls`), so it
must never live in an exposed schema and must pin search_path to prevent hijacking. Recorded here so
the pattern is established even though this slice doesn't yet use it.

**This slice**: no cross-centre writes → no SECURITY DEFINER data functions. (The token hook is
explicitly *not* security-definer per R1.)

---

## R5 — Server-side auth & forced revocation  ⚠ VERIFY AT IMPLEMENTATION

**Decision**:
- Server code creates a **fresh `@supabase/ssr` server client per request** (docs confirm: never
  reuse across requests — risk of serving another user's content) and verifies identity server-side.
- **Verify the JWT, do not trust the cookie**: use the claims-verifying call (`getClaims()`) as the
  source of role/centre/employee for `assertPermission`, rather than a trust-the-cookie session read
  (`getSession()`). Constitution Principle II mandates this.
- **Immediate revocation** (FR-007a, SC-003a): on deactivation/demotion, an admin action forces a
  **global sign-out** of the target user (invalidating their refresh tokens), so the change takes
  effect on the next request rather than waiting for TTL.
- **Service-role/secret key is server-only**, never `NEXT_PUBLIC_`, used only for admin actions
  (create-login, force-signout) and seeding. Confirmed by docs.
- **Password reset** (FR-004): standard "send reset link → set new password → sign in" flow.

**⚠ Verification flag**: The exact API surface for **`getClaims()` vs `getSession()`**, the
**admin force-global-sign-out** call, and **`resetPasswordForEmail`** were *not present in the mined
local docs* (those searches returned zero matches). They are known Supabase Auth capabilities, but
the implementer MUST confirm the current method names/signatures against live Supabase docs (or via
the Context7/Supabase MCP) before coding auth — do not hard-code from memory. This is the single
highest verify-first item in the slice.

**Rationale for flagging rather than asserting**: auth is security-critical and the constitution
forbids trusting unverified sources; asserting an unconfirmed API here would be exactly the kind of
memory-from-training risk the project rules warn against.

**Alternatives considered**: relying solely on short TTL for revocation (rejected — a demoted user
keeps access up to the TTL; FR-007a demands *immediate* for security-critical changes); trusting the
cookie/session (rejected — Principle II, and the CVE-class middleware-bypass concern).

---

## R6 — Vocabulary, permission registry & nav-as-access-matrix (extension seams)

**Decision**: Three single-source-of-truth modules, plain TypeScript, dependency-free:
- `vocabulary.ts` — all Vietnamese labels + badge-color triples (referencing CSS custom
  properties/design tokens) + `NAV_ITEMS` + `navItemsForRole(role)` + `resolveEffectiveCentre` +
  `isNetworkWideRole` + `ALL_CENTRES`.
- `permissions.ts` — the single registry mapping each role → its permission-key set; `assertPermission`
  reads from it. Adding a module = add keys here.
- `NAV_ITEMS` is simultaneously the sidebar definition **and** the route-access list (FR-024b) — one
  list, consumed by both the shell and the route guard.

**Rationale**: Directly realizes clarify-session decisions (FR-024a–c) and the constitution's
"navigation IS the access matrix" and "one vocabulary module" principles. Enum **values** are the
stable contract; only labels live in vocabulary (per the "define fresh" spec decision).

**Framework note (nav divergence bug)**: In Next.js the route guard is `proxy.ts` (renamed
middleware). Next.js cannot derive the middleware matcher from `NAV_ITEMS` automatically, so the
guard must **import and iterate `NAV_ITEMS`** to build its protected-route set — never a
hand-maintained parallel array (the documented 500-vs-redirect bug in jax-crm). This is the one spot
where the "single list" invariant needs deliberate wiring.

**Alternatives considered**: co-locating labels with components (rejected — drift, untranslated
leaks); two lists for nav vs route-access (rejected — the exact divergence bug the spec calls out).

---

## R7 — Reads, pagination & data seam

**Decision**: A single data seam (`src/lib/data/index.ts`) is the only client↔DB path; client reads
go through TanStack Query hooks with query-key factories that mutations invalidate; every list
returns `Paginated<T> = { rows, total, page, pageSize }` with a 1-based-page→DB-range converter
(`toRange`). No unbounded queries.

**Rationale**: Constitution §8 + FR-026 + SC-008a (mid-size-chain scale). Keeps server state out of
any client store (derived values computed, not stored).

**Scale target**: ~10 centres, low-hundreds of staff, tens of thousands of tasks/year. Default page
size and indexes (on `centre_id`, `assignee_id`, `status`, `deadline`) sized to this; first-page
reads stay perceived-instant.

---

## Open items carried into Phase 1 / implementation

| Item | Status | Where resolved |
|---|---|---|
| `getClaims()` vs `getSession()` exact API | ⚠ verify at implementation | R5; confirm vs live docs before coding auth |
| Admin force-global-sign-out call signature | ⚠ verify at implementation | R5 |
| `resetPasswordForEmail` flow specifics | ⚠ verify at implementation | R5 |
| Cross-centre SECURITY DEFINER fan-out | Deferred (not in this slice) | R4; needed from the activities slice on |

All other NEEDS CLARIFICATION from Technical Context are resolved above. No blocking unknowns remain
for this slice's core (auth wiring specifics are flagged verify-first, not blocking design).
