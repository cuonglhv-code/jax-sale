"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { withError, type ActionResult } from "@/lib/server-action";
import { resolvePageSize, toRange, type Paginated } from "@/lib/pagination";
import { isNetworkWideRole } from "@/lib/domain/vocabulary";
import type { MetricKey } from "@/lib/data/types";

export interface RankedEntry {
  consultantId: string;
  consultantName: string;
  centreId: string;
  approvedActual: number;
  rank: number;
}

interface LeaderboardRpcRow {
  consultant_id: string;
  consultant_name: string;
  centre_id: string;
  approved_actual: number;
  rank: number;
}

/**
 * US4/FR-VIS-03: tier-scoped, approved-only, ranked leaderboard (deterministic tie-break by name).
 * Gated on `personalKpi.approveActual` (centre_manager/centre_admin/super_admin via catch-all) — the
 * same tier permitted to see peer figures; a `sale_consultant` is denied (no leaderboard surface,
 * AC-4.3). RLS inside `kpi_leaderboard` (SECURITY INVOKER) auto-scopes rows to the caller's tier.
 */
export async function getLeaderboard(
  period: string,
  metricKey: MetricKey,
  page = 1,
  pageSize?: number,
  centreId?: string,
): Promise<ActionResult<Paginated<RankedEntry>>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "personalKpi.approveActual");

    const resolvedPageSize = resolvePageSize(pageSize);
    const { from, to } = toRange(page, resolvedPageSize);
    const limit = to - from + 1;

    const effectiveCentreId = isNetworkWideRole(claims.role) ? centreId : undefined;

    const { data, error } = await supabase.rpc("kpi_leaderboard", {
      p_period: period,
      p_metric: metricKey,
      p_limit: limit,
      p_offset: from,
      p_centre_id: effectiveCentreId ?? null,
    });
    if (error) throw error;

    const rows = (data as LeaderboardRpcRow[]).map((r) => ({
      consultantId: r.consultant_id,
      consultantName: r.consultant_name,
      centreId: r.centre_id,
      approvedActual: r.approved_actual,
      rank: r.rank,
    }));
    return { rows, total: rows.length, page, pageSize: resolvedPageSize };
  });
}
