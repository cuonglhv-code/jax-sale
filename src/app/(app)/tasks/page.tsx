import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { TasksBoard } from "./TasksBoard";

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const claims = await getVerifiedClaims(supabase);

  // Centre switcher lives in the app shell now (Sidebar/CentreSwitcher, layout.tsx) — this page
  // only needs the department list for CreateTaskDrawer.
  const departments = (await supabase.from("departments").select("id, name").order("name")).data ?? [];

  return <TasksBoard role={claims.role} departments={departments} />;
}
