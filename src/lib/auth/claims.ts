import type { SupabaseClient } from "@supabase/supabase-js";
import { UnauthenticatedError } from "@/lib/server-action";
import type { AppRole, Claims } from "@/lib/data/types";
import { APP_ROLES } from "@/lib/data/types";

/**
 * Resolve the caller's verified identity (constitution Principle II, research R5/T018).
 *
 * Uses `getClaims()` — confirmed via the installed @supabase/auth-js types and current Supabase
 * docs to be the "verify the JWT" call: it validates the access token (locally against the
 * project's cached JWKS, or via the Auth server for symmetric-key projects) and returns the
 * DECODED claims, never trusting a client-supplied value. This is NOT `getSession()` (reads local
 * storage/cookie without re-validating) — that call must never be used to resolve identity for a
 * security decision.
 *
 * The custom access-token hook (supabase/migrations/..._access_token_hook.sql) injects
 * `app_role` / `centre_id` / `employee_id` as top-level claims, so they land directly on
 * `data.claims` alongside standard JWT fields (confirmed against @supabase/auth-js's
 * `JwtPayload` type, which has `[key: string]: any` for exactly this reason).
 *
 * Deliberately does NOT trust the JWT's cached `is_active`/`app_role`/`centre_id` for the
 * "immediate on deactivation" guarantee (spec FR-007a/SC-003a) — Supabase's own docs note a
 * revoked/banned user's existing access token "remains valid until expiry." `assertAuthenticated`
 * (assert-permission.ts) re-checks `is_active` fresh against the `employees` table on every call,
 * which is what actually makes deactivation take effect within one request cycle, independent of
 * token staleness.
 *
 * Takes the Supabase client as a parameter (rather than constructing one internally via
 * `next/headers`) so this — and everything built on it — is callable both from a real request
 * (server actions, via `createServerSupabaseClient()`) AND from integration tests that build a
 * client from a seeded user's real access token. Constitution Principle IV requires these paths
 * exercise real auth, not a mock, so the client must be injectable.
 */
export async function getVerifiedClaims(supabase: SupabaseClient): Promise<Claims> {
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    throw new UnauthenticatedError();
  }

  const { claims } = data;
  const role = claims.app_role as string | undefined;
  const centreId = claims.centre_id as string | undefined;
  const employeeId = claims.employee_id as string | undefined;

  if (!role || !centreId || !employeeId || !APP_ROLES.includes(role as AppRole)) {
    // No employee row resolved for this auth user (e.g. hook found nothing) — treat as
    // unauthenticated rather than proceeding with a partial identity.
    throw new UnauthenticatedError();
  }

  return {
    authUserId: claims.sub as string,
    role: role as AppRole,
    centreId,
    employeeId,
  };
}
