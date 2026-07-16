import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { isNetworkWideRole } from "@/lib/domain/vocabulary";
import { TasksBoard } from "./TasksBoard";

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const claims = await getVerifiedClaims(supabase);

  // Only the network-wide role needs the centre list (for the switcher).
  const centres = isNetworkWideRole(claims.role)
    ? ((await supabase.from("centres").select("id, name").order("name")).data ?? [])
    : [];
  const departments = (await supabase.from("departments").select("id, name").order("name")).data ?? [];

  return <TasksBoard role={claims.role} centres={centres} departments={departments} />;
}
