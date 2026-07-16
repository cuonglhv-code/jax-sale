import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims } from "@/lib/data/types";
import { DomainError } from "@/lib/server-action";

/**
 * FR-007a: force a global sign-out of the target employee via the admin/service-role client, so
 * an existing session cannot merely wait out its (bounded, ≤30-min) refresh window. Writes its OWN
 * distinct audit entry `employee.forceSignout` (never `employee.deactivate` — that belongs to the
 * caller, per the auth.actions.md disambiguation), via `supabase` (the request-scoped client, which
 * carries the caller's claims needed to resolve `actor_id`/`centre_id` — the service-role client's
 * token has no such custom claims).
 *
 * NOTE (research R5 finding): Supabase's own docs note a banned/revoked user's EXISTING access
 * token "remains valid until expiry." The real "immediate, within one request cycle" guarantee
 * (SC-003a) comes from `assertAuthenticated`'s fresh `is_active` re-check on every call — this ban
 * is a supplementary barrier against new sign-ins, not the sole enforcement mechanism.
 */
export async function forceSignOutEmployeeCore(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  employeeId: string,
): Promise<void> {
  const { data: emp, error } = await serviceClient
    .from("employees")
    .select("auth_user_id")
    .eq("id", employeeId)
    .single();
  if (error || !emp) throw new DomainError("Không tìm thấy nhân viên");

  const { error: banError } = await serviceClient.auth.admin.updateUserById(emp.auth_user_id as string, {
    ban_duration: "876000h", // ~100 years — effectively indefinite until explicitly reactivated
  });
  if (banError) throw new DomainError(banError.message);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "employee.forceSignout",
    p_entity_type: "employee",
    p_entity_id: employeeId,
    p_metadata: null,
  });
  if (auditError) console.error("[audit] employee.forceSignout failed to log", auditError);
}

/**
 * FR-005/007a/024g: deactivate an employee within the caller's own centre. Writes the
 * `employee.deactivate` audit entry, then triggers `forceSignOutEmployeeCore` (a distinct,
 * second audit entry) so the removal of access takes effect immediately.
 */
export async function deactivateEmployeeCore(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  claims: Claims,
  employeeId: string,
): Promise<void> {
  const { data: target, error: targetError } = await supabase
    .from("employees")
    .select("id, centre_id")
    .eq("id", employeeId)
    .single();
  if (targetError || !target) throw new DomainError("Không tìm thấy nhân viên");
  if (target.centre_id !== claims.centreId) {
    throw new DomainError("Nhân viên không thuộc trung tâm của bạn");
  }

  const { error: updateError } = await supabase
    .from("employees")
    .update({ is_active: false })
    .eq("id", employeeId);
  if (updateError) throw new DomainError(updateError.message);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "employee.deactivate",
    p_entity_type: "employee",
    p_entity_id: employeeId,
    p_metadata: null,
  });
  if (auditError) console.error("[audit] employee.deactivate failed to log", auditError);

  await forceSignOutEmployeeCore(supabase, serviceClient, employeeId);
}
