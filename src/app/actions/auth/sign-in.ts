"use server";

import { signInSchema } from "@/schemas/auth";
import { signInCore, type SignInSuccess } from "@/services/auth.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withError, type ActionResult } from "@/lib/server-action";

/** Canonical pipeline entry point for FR-001/002/005. Thin wrapper: parse → core → withError. */
export async function signIn(raw: unknown): Promise<ActionResult<SignInSuccess>> {
  return withError(async () => {
    const input = signInSchema.parse(raw);
    const supabase = await createServerSupabaseClient();
    return signInCore(supabase, input);
  });
}
