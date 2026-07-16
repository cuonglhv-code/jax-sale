import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/lib/server-action";
import type { SignInInput, RequestPasswordResetInput, ResetPasswordInput } from "@/schemas/auth";
import type { AppRole } from "@/lib/data/types";

export interface SignInSuccess {
  role: AppRole;
  centreId: string;
  employeeId: string;
}

/**
 * Core sign-in logic (FR-001/002/005). Takes an injected client so it's callable both from the
 * request-scoped `signIn` server action and from integration tests (constitution Principle IV —
 * no auth mocking). Throws `DomainError` with a user-safe Vietnamese message on any failure;
 * never reveals whether an email exists (FR-002).
 */
export async function signInCore(supabase: SupabaseClient, input: SignInInput): Promise<SignInSuccess> {
  const { data, error } = await supabase.auth.signInWithPassword(input);

  if (error || !data.session || !data.user) {
    // Same generic message whether the email doesn't exist or the password is wrong.
    throw new DomainError("Email hoặc mật khẩu không đúng.");
  }

  // FR-005: a deactivated account must not obtain a usable session, even with the correct
  // password. Supabase's own auth has no concept of employees.is_active, so we check it here and
  // undo the session if the account is inactive.
  const { data: emp, error: empError } = await supabase
    .from("employees")
    .select("is_active")
    .eq("auth_user_id", data.user.id)
    .single();

  if (empError || !emp || !emp.is_active) {
    await supabase.auth.signOut();
    throw new DomainError("Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.app_role || !claims.centre_id || !claims.employee_id) {
    await supabase.auth.signOut();
    throw new DomainError("Không thể xác thực phiên đăng nhập. Vui lòng thử lại.");
  }

  return {
    role: claims.app_role as AppRole,
    centreId: claims.centre_id as string,
    employeeId: claims.employee_id as string,
  };
}

/** FR-003: end the caller's session. */
export async function signOutCore(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut();
}

/** FR-004: initiate password-reset delivery. Same response whether or not the email exists. */
export async function requestPasswordResetCore(
  supabase: SupabaseClient,
  input: RequestPasswordResetInput,
  redirectTo: string,
): Promise<void> {
  await supabase.auth.resetPasswordForEmail(input.email, { redirectTo });
  // Deliberately ignore any error here (e.g. unknown email) — do not leak account existence.
}

/** FR-004: set a new password for the (already-recovery-authenticated) caller. */
export async function resetPasswordCore(
  supabase: SupabaseClient,
  input: ResetPasswordInput,
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) {
    throw new DomainError("Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.");
  }
}
