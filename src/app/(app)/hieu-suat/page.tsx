import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { formatPeriod } from "@/lib/domain/kpi/periods";
import { RecordActualForm } from "./RecordActualForm";
import { MyPerformance } from "./MyPerformance";
import { ApprovalQueue } from "./ApprovalQueue";

/**
 * FR-ACCESS-01: gated to super_admin/centre_manager/centre_admin/sale_consultant via the nav/access
 * matrix (hidden from teacher, D-TEACHER). US1: the consultant surface — record own actuals, view own
 * attainment. US7: the manager/admin approval queue. US2/US3 surfaces (target editor, dashboard) land
 * with their stories.
 */
export default async function KpiPage() {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }
  if (claims.role === "teacher") {
    redirect("/dashboard");
  }

  const now = new Date();
  const currentPeriod = formatPeriod(now.getFullYear(), now.getMonth() + 1);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hiệu suất & KPI</h1>
      {claims.role === "sale_consultant" && (
        <>
          <RecordActualForm period={currentPeriod} />
          <MyPerformance period={currentPeriod} />
        </>
      )}
      {(claims.role === "centre_manager" || claims.role === "centre_admin") && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Chờ duyệt</h2>
          <ApprovalQueue period={currentPeriod} />
        </section>
      )}
    </div>
  );
}
