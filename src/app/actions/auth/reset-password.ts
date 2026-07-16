"use server";

import { resetPasswordSchema } from "@/schemas/auth";
import { resetPasswordCore } from "@/services/auth.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withError, type ActionResult } from "@/lib/server-action";

/** FR-004: set a new password (caller must already hold a recovery session from the reset link). */
export async function resetPassword(raw: unknown): Promise<ActionResult<null>> {
  return withError(async () => {
    const input = resetPasswordSchema.parse(raw);
    const supabase = await createServerSupabaseClient();
    await resetPasswordCore(supabase, input);
    return null;
  });
}
