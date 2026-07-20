import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore, approveActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T038 (US4): leaderboard is tier-scoped (manager=own centre, super_admin=network), approved-only,
 * deterministic tie-break by name, and consultants get NO leaderboard surface (AC-4.1/4.2/4.3/4.4).
 */
describe("kpi: leaderboard (kpi_leaderboard)", () => {
  const period = "2027-06";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  async function recordAndApprove(email: string, actual: number) {
    const client = await signInAs(email);
    const claims = await assertPermission(client, "personalKpi.recordActual");
    const entry = await recordActualCore(client, claims, { period, metricKey: "revenue", actual });

    const managerEmail = email === SEEDED_USERS.saleQ1 ? SEEDED_USERS.managerQ1 : SEEDED_USERS.adminQ3;
    const managerClient = await signInAs(managerEmail);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await approveActualCore(managerClient, managerClaims, entry.id);
    return entry;
  }

  it("a centre manager ranks only their OWN centre's consultants, approved-only", async () => {
    await recordAndApprove(SEEDED_USERS.saleQ1, 500);
    await recordAndApprove(SEEDED_USERS.saleQ3, 900); // different centre — must not appear

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { data } = await managerClient.rpc("kpi_leaderboard", { p_period: period, p_metric: "revenue" });

    const q1ConsultantId = (
      await managerClient.from("employees").select("id").eq("email", SEEDED_USERS.saleQ1).single()
    ).data?.id;
    const q3ConsultantId = (
      await managerClient.from("employees").select("id").eq("email", SEEDED_USERS.saleQ3).single()
    ).data?.id;

    const ids = (data ?? []).map((r: { consultant_id: string }) => r.consultant_id);
    expect(ids).toContain(q1ConsultantId);
    expect(ids).not.toContain(q3ConsultantId);
  });

  it("super_admin ranks network-wide (sees both centres)", async () => {
    await recordAndApprove(SEEDED_USERS.saleQ1, 300);
    await recordAndApprove(SEEDED_USERS.saleQ3, 700);

    const admin = await signInAs(SEEDED_USERS.superAdmin);
    const { data } = await admin.rpc("kpi_leaderboard", { p_period: period, p_metric: "revenue" });

    const q1ConsultantId = (
      await admin.from("employees").select("id").eq("email", SEEDED_USERS.saleQ1).single()
    ).data?.id;
    const q3ConsultantId = (
      await admin.from("employees").select("id").eq("email", SEEDED_USERS.saleQ3).single()
    ).data?.id;

    const ids = (data ?? []).map((r: { consultant_id: string }) => r.consultant_id);
    expect(ids).toContain(q1ConsultantId);
    expect(ids).toContain(q3ConsultantId);

    // Ranked descending: the higher approved_actual (Q3, 700) ranks above Q1 (300).
    const q3Row = (data ?? []).find((r: { consultant_id: string }) => r.consultant_id === q3ConsultantId);
    const q1Row = (data ?? []).find((r: { consultant_id: string }) => r.consultant_id === q1ConsultantId);
    expect(q3Row.rank).toBeLessThan(q1Row.rank);
  });

  it("excludes pending (unapproved) actuals from the ranking", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");
    await recordActualCore(client, claims, { period, metricKey: "revenue", actual: 5000 }); // never approved

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { data } = await managerClient.rpc("kpi_leaderboard", { p_period: period, p_metric: "revenue" });
    const q1ConsultantId = (
      await managerClient.from("employees").select("id").eq("email", SEEDED_USERS.saleQ1).single()
    ).data?.id;
    const row = (data ?? []).find((r: { consultant_id: string }) => r.consultant_id === q1ConsultantId);
    expect(row?.approved_actual ?? 0).toBe(0); // pending excluded, not counted as 5000
  });

  it("a sale_consultant has no leaderboard-viewing grant (AC-4.3) — the action's permission gate", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const { assertPermission: assertPerm } = await import("@/lib/auth/assert-permission");
    const { ForbiddenError } = await import("@/lib/server-action");
    // The leaderboard action gates on personalKpi.approveActual (manager/admin/super_admin only) —
    // a consultant lacks it, so the action denies before ever calling kpi_leaderboard.
    await expect(assertPerm(client, "personalKpi.approveActual")).rejects.toThrow(ForbiddenError);
  });
});
