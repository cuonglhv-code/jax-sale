"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import { classifyAttainment } from "@/services/kpi/attainment";
import type { KpiDashboardRow, MetricKey } from "@/lib/data/types";

interface DashboardRpcRow {
  consultant_id: string;
  consultant_name: string;
  metric_key: string;
  approved_actual: number;
  target: number | null;
}

export interface ExportReportResult {
  rows: KpiDashboardRow[];
  period: string;
  scope: string;
}

/**
 * US5/FR-VIS-04: assemble the tier-confined rows for a period export (AC-5.1/5.2/5.4). Rendering
 * (CSV string, PDF blob) happens CLIENT-SIDE (this app's established pattern — #002's PDF also
 * renders client-side for offline capability); this action only returns the data, already scoped by
 * `kpi_dashboard`'s RLS-invoker aggregation exactly as the on-screen dashboard is.
 */
export async function exportReport(period: string): Promise<ActionResult<ExportReportResult>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.approveActual");

    const { data, error } = await supabase.rpc("kpi_dashboard", { p_period: period });
    if (error) throw error;

    const rows = groupByConsultant(data as DashboardRpcRow[]);
    const scope = claims.role === "super_admin" ? "Toàn hệ thống" : "Trung tâm";
    return { rows, period, scope };
  });
}

function groupByConsultant(rpcRows: DashboardRpcRow[]): KpiDashboardRow[] {
  const byConsultant = new Map<string, KpiDashboardRow>();
  for (const row of rpcRows) {
    const existing = byConsultant.get(row.consultant_id);
    const attainment = classifyAttainment(row.metric_key as MetricKey, row.approved_actual, row.target);
    if (existing) {
      existing.attainments.push(attainment);
    } else {
      byConsultant.set(row.consultant_id, {
        scopeId: row.consultant_id,
        scopeName: row.consultant_name,
        attainments: [attainment],
      });
    }
  }
  return Array.from(byConsultant.values());
}
