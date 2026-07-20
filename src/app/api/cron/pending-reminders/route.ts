import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { assertCronSecret } from "@/lib/cron-auth";
import { notifyPendingReminder } from "@/services/notification.service";

/**
 * US7 (T059, contracts/notifications.md — R7): daily digest to each centre's approver(s) listing
 * how many requests are pending/awaiting_cover in their centre. Vercel Cron hits this route (see
 * `vercel.json`); guarded by `assertCronSecret` (src/lib/cron-auth.ts).
 *
 * Neither this nor the purge route fires under local `next dev` (R7) — trigger manually:
 *   curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/pending-reminders
 */
export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = assertCronSecret(request);
  if (unauthorized) return unauthorized;

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
