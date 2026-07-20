"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";

export interface AssignableTeacher {
  id: string;
  fullName: string;
}

/** US4 (T041): active teachers in the caller's OWN centre — for the class-form teacher picker. */
export async function listTeachers(): Promise<ActionResult<AssignableTeacher[]>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);
    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name")
      .eq("centre_id", claims.centreId)
      .eq("is_active", true)
      .eq("app_role", "teacher")
      .order("full_name");
    if (error) throw error;
    return (data ?? []).map((e) => ({ id: e.id as string, fullName: e.full_name as string }));
  });
}
