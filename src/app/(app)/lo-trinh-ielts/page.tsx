import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { roleHasPermission } from "@/lib/auth/permissions";
import { Summit } from "./Summit";

// US1 (T030): gated to roles holding roadmap.generate (deny teacher). Loads the consultant's own
// details + centre name to prefill the form.
export default async function RoadmapPage() {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }

  if (!roleHasPermission(claims.role, "roadmap.generate")) {
    redirect("/tasks"); // e.g. teacher — no access to the roadmap builder
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("full_name, email")
    .eq("id", claims.employeeId)
    .single();
  const { data: centre } = await supabase
    .from("centres")
    .select("name")
    .eq("id", claims.centreId)
    .single();

  const consultant = {
    name: (emp?.full_name as string) ?? "",
    email: (emp?.email as string) ?? "",
    centreName: (centre?.name as string) ?? "",
  };

  return <Summit consultant={consultant} />;
}
