import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { notifyPendingReminder } from "@/services/notification.service";

/**
 * US7 (T059, contracts/notifications.md — R7): daily digest to each centre's approver(s) listing
 * how many requests are pending/awaiting_cover in their centre. Vercel Cron hits this route (see
 * `vercel.json`); guarded by a `CRON_SECRET` bearer check read directly from `process.env` (not
 * `getServerEnv()`) — this route is infrastructure auth, not a business-secret validation path, and
 * reading process.env directly avoids pulling in the full server-env schema (which also requires
 * SUPABASE_SERVICE_ROLE_KEY/RESEND_API_KEY to already be present) just to check one bearer token.
 *
 * Neither this nor the purge route fires under local `next dev` (R7) — trigger manually:
 *   curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/pending-reminders
 */
export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: rows, error } = await supabase
    .from("hr_request")
    .select("centre_id")
    .in("status", ["pending", "awaiting_cover"]);
  if (error) {
    console.error("[cron/pending-reminders] failed to read pending requests", error);
    return NextResponse.json({ error: "Failed to read pending requests" }, { status: 500 });
  }

  const countByCentre = new Map<string, number>();
  for (const row of rows ?? []) {
    const centreId = row.centre_id as string;
    countByCentre.set(centreId, (countByCentre.get(centreId) ?? 0) + 1);
  }

  await Promise.all(
    Array.from(countByCentre.entries()).map(([centreId, pendingCount]) =>
      notifyPendingReminder(supabase, { centreId, pendingCount, queueUrl: "/nhan-su/duyet" }),
    ),
  );

  return NextResponse.json({ centresNotified: countByCentre.size });
}
