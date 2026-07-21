import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { formatPeriod } from "@/lib/domain/kpi/periods";
import { RecordActualForm } from "./RecordActualForm";
import { MyPerformance } from "./MyPerformance";
import { ApprovalQueue } from "./ApprovalQueue";
import { TargetEditor } from "./TargetEditor";
import { Dashboard } from "./Dashboard";
import { Leaderboard } from "./Leaderboard";
import { ExportButton } from "./ExportButton";

/**
 * FR-ACCESS-01: gated to super_admin/centre_manager/centre_admin/sale_consultant via the nav/access
 * matrix (hidden from teacher, D-TEACHER). US1: the consultant surface — record own actuals, view own
 * attainment. US7: the manager/admin approval queue. US2: per-consultant target editor. US3: the
 * tiered dashboard. US4: the ranked leaderboard (no surface for sale_consultant, AC-4.3). US5: CSV+PDF
 * export of the caller's tier.
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
    <div className="mx-auto flex max-w-[1120px] flex-col gap-5 px-6 py-5 pb-8">
      {claims.role === "sale_consultant" && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <MyPerformance period={currentPeriod} />
          <RecordActualForm period={currentPeriod} />
        </div>
      )}
      {(claims.role === "centre_manager" || claims.role === "centre_admin") && (
        <>
          <ApprovalQueue period={currentPeriod} />
          <TargetEditor period={currentPeriod} />
        </>
      )}
      {(claims.role === "centre_manager" || claims.role === "centre_admin" || claims.role === "super_admin") && (
        <>
          <Dashboard period={currentPeriod} />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <Leaderboard period={currentPeriod} />
            <div className="flex flex-col gap-2">
              <ExportButton period={currentPeriod} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
