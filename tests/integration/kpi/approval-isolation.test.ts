import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T022 (US7): a sale_consultant cannot approve (no key, no self-approve); a centre-A manager cannot
 * approve a centre-B row — RLS makes the row invisible to the guarded function (AC-7.3/7.4, SC-003/004).
 */
describe("kpi: approval isolation", () => {
  const period = "2026-11";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("a sale_consultant lacks personalKpi.approveActual (no self-approve path)", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    await expect(assertPermission(client, "personalKpi.approveActual")).rejects.toThrow(ForbiddenError);
  });

  it("a centre-A manager cannot approve a centre-B consultant's pending actual", async () => {
    // saleQ3 is in centre Q3; managerQ1 is in centre Q1.
    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    const entry = await recordActualCore(q3Client, q3Claims, { period, metricKey: "revenue", actual: 10 });

    const q1ManagerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { error } = await q1ManagerClient.rpc("approve_personal_kpi", { p_entry_id: entry.id });

    // RLS confines the guarded function's own SELECT/UPDATE to the caller's centre — the Q3 row is
    // invisible to a Q1 manager, so the function raises "not found" rather than succeeding.
    expect(error).not.toBeNull();

    // Confirm the row itself is unaffected (still pending) via a Q3-scoped read.
    const { data: unaffected } = await q3Client.from("personal_kpis").select("approval_status").eq("id", entry.id).single();
    expect(unaffected?.approval_status).toBe("pending");
  });

  it("a raw cross-centre UPDATE by a Q1 manager on a Q3 row is refused by RLS (zero rows affected)", async () => {
    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    const entry = await recordActualCore(q3Client, q3Claims, { period, metricKey: "enrolments_closed", actual: 1 });

    // RLS's USING clause silently filters non-matching rows on UPDATE (no error) — the proof is that
    // ZERO rows are affected and the target is unchanged, not an error (standard Postgres RLS behavior).
    const q1ManagerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { data: updated, error } = await q1ManagerClient
      .from("personal_kpis")
      .update({ target: 5 })
      .eq("id", entry.id)
      .select();
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);

    const { data: unaffected } = await q3Client.from("personal_kpis").select("target").eq("id", entry.id).single();
    expect(unaffected?.target).toBeNull();
  });
});
