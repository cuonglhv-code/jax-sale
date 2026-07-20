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
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hiệu suất & KPI</h1>
      {claims.role === "sale_consultant" && (
        <>
          <RecordActualForm period={currentPeriod} />
          <MyPerformance period={currentPeriod} />
        </>
      )}
      {(claims.role === "centre_manager" || claims.role === "centre_admin") && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Chờ duyệt</h2>
            <ApprovalQueue period={currentPeriod} />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Đặt mục tiêu</h2>
            <TargetEditor period={currentPeriod} />
          </section>
        </>
      )}
      {(claims.role === "centre_manager" || claims.role === "centre_admin" || claims.role === "super_admin") && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Bảng hiệu suất</h2>
            <Dashboard period={currentPeriod} />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Xếp hạng</h2>
            <Leaderboard period={currentPeriod} />
          </section>
          <ExportButton period={currentPeriod} />
        </>
      )}
    </div>
  );
}
