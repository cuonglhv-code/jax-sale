# Contract: Auth Actions

Server-side entry points for authentication. All follow the canonical pipeline; identity is resolved
from the verified JWT (`getClaims()`), never trusted from the client. ⚠ The exact Supabase Auth API
names/signatures are **verify-at-implementation** (research R5) — the *contract* below is the
behavior each must satisfy.

Result shape for every action: discriminated `{ data } | { error }` (`withError`), friendly
Vietnamese message in prod, raw detail in dev.

---

## `signIn(input)`
- **Input** (Zod): `{ email: string(email), password: string(min 1) }`.
- **Behavior**: authenticate email+password; on success establish a session whose JWT carries
  `app_role`, `centre_id`, `employee_id` (via the access-token hook). On failure, return a generic
  Vietnamese error that does **not** reveal whether the email exists (FR-002).
- **Rejects**: deactivated account (`is_active = false`) MUST NOT get a usable session (FR-005).
- **Success criteria**: FR-001, FR-002, FR-005, SC-005, SC-008.

## `signOut()`
- **Input**: none (identity from session).
- **Behavior**: end the caller's session (FR-003).

## `requestPasswordReset(input)`
- **Input**: `{ email: string(email) }`.
- **Behavior**: initiate reset delivery for the email (FR-004). Response MUST be the same whether or
  not the email exists (no account enumeration).

## `resetPassword(input)`
- **Input**: `{ token: string, newPassword: string(min policy) }`.
- **Behavior**: set a new password from a valid reset token; afterward the user can sign in with it
  (FR-004).

## `forceSignOutEmployee(input)` — admin, mutating
- **Gate**: `assertPermission("employee.deactivate")` (or an equivalent admin key).
- **Input**: `{ employeeId: uuid }`.
- **Behavior**: revoke the target employee's active session(s) globally so a deactivation/demotion
  takes effect immediately (FR-007a, SC-003a). Writes exactly one audit entry of its **own** distinct
  action `employee.forceSignout` — never `employee.deactivate` (that entry belongs to the calling
  `deactivateEmployee`). So a standalone force-sign-out is still audited, and a full deactivation
  produces two entries: `employee.deactivate` (state change) + `employee.forceSignout` (revocation).
  Uses the server-only service/secret key.
- **Success criteria**: FR-007a, SC-003a.

---

### Cross-cutting requirements (all auth actions)
- Server client is created **fresh per request** (`@supabase/ssr`); never reused.
- Identity/claims come from **verifying the JWT** (`getClaims()`), not from a trust-the-cookie
  session read (constitution Principle II).
- Service/secret key is server-only; never `NEXT_PUBLIC_`; used only by `forceSignOutEmployee` and
  admin/seed paths.
- Required env vars validated at startup (fail fast).
