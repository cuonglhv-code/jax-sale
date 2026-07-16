"use server";

import { signOutCore } from "@/services/auth.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withError, type ActionResult } from "@/lib/server-action";

/** FR-003: end the caller's session. */
export async function signOut(): Promise<ActionResult<null>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    await signOutCore(supabase);
    return null;
  });
}
