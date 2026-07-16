import type { SupabaseClient } from "@supabase/supabase-js";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { roleHasPermission, type PermissionKey } from "@/lib/auth/permissions";
import { UnauthenticatedError, ForbiddenError } from "@/lib/server-action";
import type { Claims } from "@/lib/data/types";

/**
 * Layer 2 — the app permission gate (constitution Principle II/III, spec FR-010).
 *
 * `assertAuthenticated(supabase)` resolves claims AND re-checks `is_active` fresh against the
 * `employees` table on every call — NOT from the (potentially stale) JWT claim. This is the
 * mechanism that satisfies FR-007a/SC-003a's "immediate, within one request cycle" guarantee for
 * deactivation, given Supabase's documented access-token-remains-valid-until-expiry caveat on
 * session revocation (research verification, T018). The lookup is a single indexed primary-key
 * read (employees.id), so the cost is negligible.
 *
 * Takes the client as a parameter (see claims.ts) so callers — real request handlers and
 * integration tests alike — supply their own client; nothing here is Next.js-request-bound.
 */
export async function assertAuthenticated(supabase: SupabaseClient): Promise<Claims> {
  const claims = await getVerifiedClaims(supabase);

  const { data, error } = await supabase
    .from("employees")
    .select("is_active")
    .eq("id", claims.employeeId)
    .single();

  if (error || !data || !data.is_active) {
    throw new UnauthenticatedError();
  }

  return claims;
}

/** `assertPermission(supabase, key)` — Layer 2 for mutating actions. Throws Unauthenticated/Forbidden. */
export async function assertPermission(
  supabase: SupabaseClient,
  key: PermissionKey,
): Promise<Claims> {
  const claims = await assertAuthenticated(supabase);
  if (!roleHasPermission(claims.role, key)) {
    throw new ForbiddenError();
  }
  return claims;
}
