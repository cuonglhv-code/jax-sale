import { NextResponse } from "next/server";

/**
 * Bearer-token check shared by every `src/app/api/cron/*` route (Vercel Cron auth, not a
 * business-secret validation path). Returns a 401 response to return immediately, or `null` when
 * the request is authorized.
 *
 * Reads `process.env.CRON_SECRET` directly rather than `getServerEnv()` — the latter validates the
 * ENTIRE server env schema (also requiring `SUPABASE_SERVICE_ROLE_KEY`/`RESEND_API_KEY`) and THROWS
 * on a missing value, which would surface a misconfigured/absent `CRON_SECRET` as an uncaught 500
 * crash instead of a clean 401. A cron route checking one bearer token shouldn't be coupled to
 * unrelated secrets or fail loudly for what is simply "not authorized."
 */
export function assertCronSecret(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
