"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

export interface AssignableEmployee {
  id: string;
  fullName: string;
}

/** Active employees in the caller's OWN centre — for the create/assign form's assignee picker. */
export async function listAssignableEmployees(): Promise<ActionResult<AssignableEmployee[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name")
      .eq("centre_id", claims.centreId)
      .eq("is_active", true)
      .order("full_name");
    if (error) throw error;
    return (data ?? []).map((e) => ({ id: e.id as string, fullName: e.full_name as string }));
  });
}
