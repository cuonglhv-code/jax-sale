"use server";

import { requestPasswordResetSchema } from "@/schemas/auth";
import { requestPasswordResetCore } from "@/services/auth.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withError, type ActionResult } from "@/lib/server-action";

/** FR-004: initiate password-reset delivery. Same response whether or not the email exists. */
export async function requestPasswordReset(raw: unknown): Promise<ActionResult<null>> {
  return withError(async () => {
    const input = requestPasswordResetSchema.parse(raw);
    const supabase = await createServerSupabaseClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`;
    await requestPasswordResetCore(supabase, input, redirectTo);
    return null;
  });
}
