import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { ReportsBoard } from "./ReportsBoard";

/**
 * US8 (T062): HR reporting surface — leave-by-employee/period, requests by type/status, outstanding
 * balances, and the coverage view (SC-007). Gated to `centre_manager`/`super_admin`, matching the
 * `hrReport.view` permission key and the `hrReports` NAV_ITEMS entry (vocabulary.ts).
 */
export default async function HrReportsPage() {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }
  if (claims.role !== "centre_manager" && claims.role !== "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Báo cáo nhân sự</h1>
      <ReportsBoard />
    </div>
  );
}
