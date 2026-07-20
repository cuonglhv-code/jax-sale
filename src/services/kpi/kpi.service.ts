import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, PersonalKpiEntry } from "@/lib/data/types";
import type { RecordActualInput, SetPersonalTargetInput, SetDepartmentTargetInput } from "@/schemas/kpi";
import { DomainError } from "@/lib/server-action";

interface PersonalKpiRow {
  id: string;
  consultant_id: string;
  centre_id: string;
  period: string;
  metric_key: string;
  target: number | null;
  actual: number;
  approval_status: string;
  created_at: string;
  updated_at: string;
}

function toPersonalKpiEntry(row: PersonalKpiRow): PersonalKpiEntry {
  return {
    id: row.id,
    consultantId: row.consultant_id,
    centreId: row.centre_id,
    period: row.period,
    metricKey: row.metric_key as PersonalKpiEntry["metricKey"],
    target: row.target,
    actual: row.actual,
    approvalStatus: row.approval_status as PersonalKpiEntry["approvalStatus"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * FR-ACTUAL-01..04: a consultant records/edits their OWN actual for (period, metricKey). Upserts on
 * the (consultant_id, period, metric_key) unique key; `consultantId`/`centreId` are resolved from
 * `claims`, never client-supplied (constitution II). The DB's `enforce_actual_only` trigger (§13)
 * forces `approval_status -> pending` on any actual change and writes the status-log (§V) — this
 * service does not need to duplicate that logic, only the write itself.
 */
export async function recordActualCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: RecordActualInput,
): Promise<PersonalKpiEntry> {
  const { data, error } = await supabase
    .from("personal_kpis")
    .upsert(
      {
        consultant_id: claims.employeeId,
        centre_id: claims.centreId,
        period: input.period,
        metric_key: input.metricKey,
        actual: input.actual,
      },
      { onConflict: "consultant_id,period,metric_key" },
    )
    .select()
    .single();

  if (error) throw new DomainError(error.message);

  const entry = toPersonalKpiEntry(data as PersonalKpiRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: entry.createdAt === entry.updatedAt ? "personalKpi.recordActual" : "personalKpi.editActual",
    p_entity_type: "personal_kpi",
    p_entity_id: entry.id,
    p_metadata: null,
  });
  if (auditError) {
    // Accepted trade-off (constitution §6): a missing audit-log row is the only failure risk here.
    console.error("[audit] personalKpi.recordActual failed to log", auditError);
  }

  return entry;
}

/**
 * FR-TARGET-01/04: a centre manager/admin sets or clears a per-consultant target within their OWN
 * centre. RLS confines the write to the caller's centre; a cross-centre attempt is rejected at the
 * database. `target: null` clears it (renders "not set", never 0% — constitution §13).
 */
export async function setPersonalTargetCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: SetPersonalTargetInput,
): Promise<PersonalKpiEntry> {
  const { data: existing } = await supabase
    .from("personal_kpis")
    .select("id")
    .eq("consultant_id", input.consultantId)
    .eq("period", input.period)
    .eq("metric_key", input.metricKey)
    .maybeSingle();

  const { data, error } = existing
    ? await supabase
        .from("personal_kpis")
        .update({ target: input.target })
        .eq("id", (existing as { id: string }).id)
        .select()
        .single()
    : await supabase
        .from("personal_kpis")
        .insert({
          consultant_id: input.consultantId,
          centre_id: claims.centreId,
          period: input.period,
          metric_key: input.metricKey,
          target: input.target,
        })
        .select()
        .single();

  if (error) throw new DomainError(error.message);
  const entry = toPersonalKpiEntry(data as PersonalKpiRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: input.target === null ? "personalKpi.clearTarget" : "personalKpi.setTarget",
    p_entity_type: "personal_kpi",
    p_entity_id: entry.id,
    p_metadata: null,
  });
  if (auditError) {
    console.error("[audit] personalKpi.setTarget failed to log", auditError);
  }

  return entry;
}

/** FR-TARGET-02/04: super_admin sets/clears a network-wide department target (§13 two-table split). */
export async function setDepartmentTargetCore(
  supabase: SupabaseClient,
  _claims: Claims,
  input: SetDepartmentTargetInput,
): Promise<{ id: string; departmentId: string; period: string; metricKey: string; target: number | null }> {
  if (input.target === null) {
    const { error } = await supabase
      .from("department_kpi_targets")
      .delete()
      .eq("department_id", input.departmentId)
      .eq("period", input.period)
      .eq("metric_key", input.metricKey);
    if (error) throw new DomainError(error.message);

    const { error: auditError } = await supabase.rpc("write_audit_log", {
      p_action: "departmentKpi.clearTarget",
      p_entity_type: "department_kpi_target",
      p_entity_id: input.departmentId,
      p_metadata: null,
    });
    if (auditError) console.error("[audit] departmentKpi.clearTarget failed to log", auditError);

    return { id: input.departmentId, departmentId: input.departmentId, period: input.period, metricKey: input.metricKey, target: null };
  }

  const { data, error } = await supabase
    .from("department_kpi_targets")
    .upsert(
      { department_id: input.departmentId, period: input.period, metric_key: input.metricKey, target: input.target },
      { onConflict: "department_id,period,metric_key" },
    )
    .select()
    .single();
  if (error) throw new DomainError(error.message);

  const row = data as { id: string; department_id: string; period: string; metric_key: string; target: number };

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "departmentKpi.setTarget",
    p_entity_type: "department_kpi_target",
    p_entity_id: row.id,
    p_metadata: null,
  });
  if (auditError) console.error("[audit] departmentKpi.setTarget failed to log", auditError);

  return { id: row.id, departmentId: row.department_id, period: row.period, metricKey: row.metric_key, target: row.target };
}

/** FR-APPROVAL-02: approve a pending actual (own centre only, enforced by RLS inside the guarded fn). */
export async function approveActualCore(
  supabase: SupabaseClient,
  _claims: Claims,
  entryId: string,
): Promise<PersonalKpiEntry> {
  const { data, error } = await supabase.rpc("approve_personal_kpi", { p_entry_id: entryId });
  if (error) throw new DomainError(error.message);
  const entry = toPersonalKpiEntry(data as PersonalKpiRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "personalKpi.approveActual",
    p_entity_type: "personal_kpi",
    p_entity_id: entry.id,
    p_metadata: null,
  });
  if (auditError) console.error("[audit] personalKpi.approveActual failed to log", auditError);

  return entry;
}

/** FR-APPROVAL-02: reject a pending actual (own centre only, enforced by RLS inside the guarded fn). */
export async function rejectActualCore(
  supabase: SupabaseClient,
  _claims: Claims,
  entryId: string,
  note?: string,
): Promise<PersonalKpiEntry> {
  const { data, error } = await supabase.rpc("reject_personal_kpi", {
    p_entry_id: entryId,
    p_note: note ?? null,
  });
  if (error) throw new DomainError(error.message);
  const entry = toPersonalKpiEntry(data as PersonalKpiRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "personalKpi.rejectActual",
    p_entity_type: "personal_kpi",
    p_entity_id: entry.id,
    p_metadata: null,
  });
  if (auditError) console.error("[audit] personalKpi.rejectActual failed to log", auditError);

  return entry;
}

/** US1: a consultant's own entries for a period (all approval states, for their own dashboard). */
export async function getMyPerformanceCore(
  supabase: SupabaseClient,
  claims: Claims,
  period: string,
): Promise<PersonalKpiEntry[]> {
  const { data, error } = await supabase
    .from("personal_kpis")
    .select()
    .eq("consultant_id", claims.employeeId)
    .eq("period", period);
  if (error) throw error;
  return ((data ?? []) as PersonalKpiRow[]).map(toPersonalKpiEntry);
}

/** US7: own-centre pending actuals for the approval queue (paginated). */
export async function listPendingApprovalsCore(
  supabase: SupabaseClient,
  claims: Claims,
  period?: string,
): Promise<PersonalKpiEntry[]> {
  let query = supabase
    .from("personal_kpis")
    .select()
    .eq("centre_id", claims.centreId)
    .eq("approval_status", "pending");
  if (period) query = query.eq("period", period);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PersonalKpiRow[]).map(toPersonalKpiEntry);
}
