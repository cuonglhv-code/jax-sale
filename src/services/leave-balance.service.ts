import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaveBalance } from "@/lib/data/types";
import type { AdjustBalanceInput } from "@/schemas/hr/balance";
import { DomainError } from "@/lib/server-action";

/**
 * US3 (T027): thin wrappers over the guarded ledger RPCs (`recompute_entitlement`,
 * `adjust_opening_balance` — supabase/migrations/20260717130005_hr_fn_balance.sql). All the
 * arithmetic/authorization guards live in the SQL functions themselves (SECURITY DEFINER — see the
 * migration header comment for why); these wrappers only do the snake_case→camelCase boundary
 * conversion, matching hr-request.service.ts's shape.
 */

interface RawLeaveBalanceRow {
  id: string;
  employee_id: string;
  leave_year: number;
  entitlement_days: number | string;
  consumed_days: number | string;
  opening_adjustment_days: number | string;
  updated_at: string;
}

function toLeaveBalance(row: RawLeaveBalanceRow): LeaveBalance {
  return {
    id: row.id,
    employeeId: row.employee_id,
    leaveYear: row.leave_year,
    entitlementDays: Number(row.entitlement_days),
    consumedDays: Number(row.consumed_days),
    openingAdjustmentDays: Number(row.opening_adjustment_days),
    updatedAt: row.updated_at,
  };
}

/** Recompute and upsert `entitlement_days` for one (employee, leave year) — idempotent. */
export async function recomputeEntitlementCore(
  supabase: SupabaseClient,
  employeeId: string,
  leaveYear: number,
): Promise<LeaveBalance> {
  const { data, error } = await supabase.rpc("recompute_entitlement", {
    p_employee_id: employeeId,
    p_leave_year: leaveYear,
  });
  if (error) throw new DomainError(error.message);
  return toLeaveBalance(data as RawLeaveBalanceRow);
}

/** Manual opening-balance adjustment (FR-047) — permission-gated at the action layer; audited inside the RPC. */
export async function adjustOpeningBalanceCore(
  supabase: SupabaseClient,
  input: AdjustBalanceInput,
): Promise<LeaveBalance> {
  const { data, error } = await supabase.rpc("adjust_opening_balance", {
    p_employee_id: input.employeeId,
    p_leave_year: input.leaveYear,
    p_delta_days: input.deltaDays,
    p_reason: input.reason,
  });
  if (error) throw new DomainError(error.message);
  return toLeaveBalance(data as RawLeaveBalanceRow);
}
