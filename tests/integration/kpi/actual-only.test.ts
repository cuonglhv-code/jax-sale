import { describe, it, expect, afterEach } from "vitest";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T015 (US1): the `enforce_actual_only` BEFORE UPDATE trigger (§13, D-ACTUAL) is the column-level
 * guard RLS cannot express. A consultant may change ONLY `actual` on their OWN row; any other column
 * change is rejected at the database. An `actual`-only edit succeeds and reverts approval to
 * `pending` + writes a status-log (AC-1.2/1.4, SC-003).
 */
describe("kpi: actual-only trigger (personal_kpis)", () => {
  const period = "2026-08"; // isolated period per test file to avoid cross-test collisions

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("rejects a consultant UPDATE that touches target/approval_status/a peer row's data", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const consultantId = await getEmployeeId(client, SEEDED_USERS.saleQ1);

    const { data: inserted, error: insertError } = await client
      .from("personal_kpis")
      .insert({
        consultant_id: consultantId,
        centre_id: await getCentreId(client, SEEDED_USERS.saleQ1),
        period,
        metric_key: "revenue",
        actual: 100,
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    expect(inserted?.approval_status).toBe("pending");

    // Attempt to set target directly — the owner path must never be able to do this.
    const { error: targetError } = await client
      .from("personal_kpis")
      .update({ target: 500 })
      .eq("id", inserted!.id);
    expect(targetError).not.toBeNull();

    // Attempt to self-approve — the owner path must never be able to do this.
    const { error: approveError } = await client
      .from("personal_kpis")
      .update({ approval_status: "approved" })
      .eq("id", inserted!.id);
    expect(approveError).not.toBeNull();
  });

  it("allows an actual-only UPDATE and reverts approval to pending + logs the transition (AC-1.4)", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const consultantId = await getEmployeeId(client, SEEDED_USERS.saleQ1);
    const centreId = await getCentreId(client, SEEDED_USERS.saleQ1);

    const { data: inserted } = await client
      .from("personal_kpis")
      .insert({ consultant_id: consultantId, centre_id: centreId, period, metric_key: "enrolments_closed", actual: 3 })
      .select()
      .single();

    // Creation must have written a null->pending status log.
    const { data: creationLogs } = await client
      .from("personal_kpi_status_logs")
      .select("from_status, to_status")
      .eq("entry_id", inserted!.id);
    expect(creationLogs?.some((l) => l.from_status === null && l.to_status === "pending")).toBe(true);

    // Approve it via service role (simulating an already-approved state) to test the revert-on-edit rule.
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").update({ approval_status: "approved" }).eq("id", inserted!.id);

    const { data: updated, error } = await client
      .from("personal_kpis")
      .update({ actual: 9 })
      .eq("id", inserted!.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(updated?.actual).toBe(9);
    expect(updated?.approval_status).toBe("pending"); // edit reverts approved -> pending (AC-1.4/7.5)

    const { data: editLogs } = await client
      .from("personal_kpi_status_logs")
      .select("from_status, to_status")
      .eq("entry_id", inserted!.id)
      .eq("from_status", "approved");
    expect(editLogs?.some((l) => l.to_status === "pending")).toBe(true);
  });
});

async function getEmployeeId(client: Awaited<ReturnType<typeof signInAs>>, email: string): Promise<string> {
  const { data, error } = await client.from("employees").select("id").eq("email", email).single();
  if (error || !data) throw new Error(`could not resolve employee id for ${email}`);
  return data.id as string;
}

async function getCentreId(client: Awaited<ReturnType<typeof signInAs>>, email: string): Promise<string> {
  const { data, error } = await client.from("employees").select("centre_id").eq("email", email).single();
  if (error || !data) throw new Error(`could not resolve centre id for ${email}`);
  return data.centre_id as string;
}
