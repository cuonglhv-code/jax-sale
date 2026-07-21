"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import { resolvePageSize, toRange, type Paginated } from "@/lib/pagination";
import { classifyAttainment } from "@/services/kpi/attainment";
import { isNetworkWideRole } from "@/lib/domain/vocabulary";
import type { KpiDashboardRow, MetricKey } from "@/lib/data/types";

interface DashboardRpcRow {
  consultant_id: string;
  consultant_name: string;
  centre_id: string;
  department_id: string;
  metric_key: string;
  approved_actual: number;
  target: number | null;
}

/**
 * US3/FR-VIS-02/FR-CALC-03: tiered, approved-only, paginated attainment dashboard. RLS on
 * `personal_kpis` (invoked inside `kpi_dashboard`, SECURITY INVOKER) auto-scopes rows to the caller's
 * tier — consultant sees only own, centre mgr/admin see own centre, super_admin sees all.
 */
export async function getDashboard(
  period: string,
  page = 1,
  pageSize?: number,
  centreId?: string,
): Promise<ActionResult<Paginated<KpiDashboardRow>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertAuthenticated(supabase);

    const resolvedPageSize = resolvePageSize(pageSize);
    const { from, to } = toRange(page, resolvedPageSize);
    const limit = to - from + 1;

    // Only a network-wide caller's centre choice is meaningful — RLS already pins everyone else to
    // their own centre regardless of this param, so passing it for them would be a no-op at best.
    const effectiveCentreId = isNetworkWideRole(claims.role) ? centreId : undefined;

    const { data, error } = await supabase.rpc("kpi_dashboard", {
      p_period: period,
      p_limit: limit,
      p_offset: from,
      p_centre_id: effectiveCentreId ?? null,
    });
    if (error) throw error;

    const rows = groupByConsultant(data as DashboardRpcRow[]);
    return { rows, total: rows.length, page, pageSize: resolvedPageSize };
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
