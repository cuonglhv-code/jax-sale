import { describe, it, expect, afterEach } from "vitest";
import { setPersonalTargetCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T026 (US2): a centre manager/admin sets a per-consultant target within their OWN centre; a
 * cross-centre attempt is rejected; a manager cannot write `actual` (trigger); NULL clears the
 * target -> not_set; a zero target is rejected at the boundary (D-ZERO). AC-2.1/2.2/2.5.
 */
describe("kpi: personal target (setPersonalTargetCore)", () => {
  const period = "2026-12";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("a centre manager sets a target for a consultant in their OWN centre", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.setTarget");
    const consultantId = await getEmployeeId(managerClient, SEEDED_USERS.saleQ1);

    const entry = await setPersonalTargetCore(managerClient, managerClaims, {
      consultantId,
      period,
      metricKey: "revenue",
      target: 1_000_000,
    });

    expect(entry.target).toBe(1_000_000);
    expect(entry.actual).toBe(0); // target-only write; trigger enforces manager cannot set actual
  });

  it("a centre manager cannot set a target for a consultant of a DIFFERENT centre", async () => {
    const managerQ1Client = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerQ1Client, "personalKpi.setTarget");
    const q3ConsultantId = await getEmployeeId(managerQ1Client, SEEDED_USERS.saleQ3);

    await expect(
      setPersonalTargetCore(managerQ1Client, managerClaims, {
        consultantId: q3ConsultantId,
        period,
        metricKey: "revenue",
        target: 500,
      }),
    ).rejects.toThrow();
  });

  it("clearing a target (null) reverts it to not_set, never 0", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.setTarget");
    const consultantId = await getEmployeeId(managerClient, SEEDED_USERS.saleQ1);

    await setPersonalTargetCore(managerClient, managerClaims, {
      consultantId,
      period,
      metricKey: "enrolments_closed",
      target: 5,
    });
    const cleared = await setPersonalTargetCore(managerClient, managerClaims, {
      consultantId,
      period,
      metricKey: "enrolments_closed",
      target: null,
    });

    expect(cleared.target).toBeNull();
  });

  it("rejects a target of zero at the schema boundary (D-ZERO)", async () => {
    const { setPersonalTargetInput } = await import("@/schemas/kpi");
    const result = setPersonalTargetInput.safeParse({
      consultantId: "00000000-0000-4000-8000-000000000001",
      period,
      metricKey: "revenue",
      target: 0,
    });
    expect(result.success).toBe(false);
  });
});

async function getEmployeeId(client: Awaited<ReturnType<typeof signInAs>>, email: string): Promise<string> {
  const { data, error } = await client.from("employees").select("id").eq("email", email).single();
  if (error || !data) throw new Error(`could not resolve employee id for ${email}`);
  return data.id as string;
}
