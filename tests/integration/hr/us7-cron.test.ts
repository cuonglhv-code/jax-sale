import { describe, it, expect } from "vitest";
import { GET as pendingRemindersGet } from "@/app/api/cron/pending-reminders/route";
import { GET as purgeDocumentsGet } from "@/app/api/cron/purge-documents/route";

/**
 * US7 (T059): the two Vercel Cron route handlers are gated by a `CRON_SECRET` bearer check before
 * doing any work. No dedicated route-handler test infrastructure exists in this codebase yet (only
 * one precedent — `tests/integration/auth.guard.test.ts` — calls a handler function directly with a
 * real `Request`/`NextRequest`, no HTTP server spin-up); this file follows that same precedent
 * rather than introducing a new testing layer. `CRON_SECRET` is read from `.env.local`
 * ("local_dev_cron_secret" per `.env.local.example`) so the "accepted" case exercises the real
 * route against the live local Supabase stack (service-role reads only — no state mutated when
 * there is nothing due).
 */
describe("hr US7: cron route bearer-secret gate", () => {
  it("pending-reminders: rejects a missing/incorrect bearer token with 401", async () => {
    const noAuth = await pendingRemindersGet(new Request("http://localhost:3000/api/cron/pending-reminders"));
    expect(noAuth.status).toBe(401);

    const wrongAuth = await pendingRemindersGet(
      new Request("http://localhost:3000/api/cron/pending-reminders", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(wrongAuth.status).toBe(401);
  });

  it("pending-reminders: accepts the correct bearer token and runs", async () => {
    const secret = process.env.CRON_SECRET;
    expect(secret).toBeTruthy();

    const response = await pendingRemindersGet(
      new Request("http://localhost:3000/api/cron/pending-reminders", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.centresNotified).toBe("number");
  });

  it("purge-documents: rejects a missing/incorrect bearer token with 401", async () => {
    const noAuth = await purgeDocumentsGet(new Request("http://localhost:3000/api/cron/purge-documents"));
    expect(noAuth.status).toBe(401);

    const wrongAuth = await purgeDocumentsGet(
      new Request("http://localhost:3000/api/cron/purge-documents", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(wrongAuth.status).toBe(401);
  });

  it("purge-documents: accepts the correct bearer token and is a no-op today (nothing sets purge_after yet)", async () => {
    const secret = process.env.CRON_SECRET;
    const response = await purgeDocumentsGet(
      new Request("http://localhost:3000/api/cron/purge-documents", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    // Nothing in the codebase populates `purge_after` yet (documented in the route's own comment),
    // so the sweep must find zero due rows — proving the no-op is a REAL empty-set result, not a
    // a swallowed error.
    expect(body.purged).toBe(0);
  });
});
