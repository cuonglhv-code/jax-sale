import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, CoverAssignment } from "@/lib/data/types";
import type { RespondCoverInput } from "@/schemas/hr/respond-cover";
import { DomainError } from "@/lib/server-action";

interface RawCoverRow {
  id: string;
  request_id: string;
  class_id: string;
  session_date: string;
  nominee_id: string;
  status: string;
  responded_at: string | null;
}

function toCoverAssignment(row: RawCoverRow): CoverAssignment {
  return {
    id: row.id,
    requestId: row.request_id,
    classId: row.class_id,
    sessionDate: row.session_date,
    nomineeId: row.nominee_id,
    status: row.status as CoverAssignment["status"],
    respondedAt: row.responded_at,
  };
}

/**
 * US4 (T043/T043a): nominee accept/decline via the guarded `respond_cover` RPC. Accepting flips the
 * owning request `awaiting_cover -> pending` once every cover on it is accepted (handled inside the
 * RPC, race-free via row locking — see the migration's concurrency note). Declining a PRE-approval
 * nomination leaves the request in `awaiting_cover` for the submitter to re-nominate (FR-019) —
 * never auto-cancels. Declining an ALREADY-ACCEPTED cover (post-approval — FR-022) instead resolves
 * to `released` inside the RPC (via `release_cover_and_flag`) and flags the owning request for
 * re-resolution — audited here as `cover.release` rather than `cover.respond` so the audit trail
 * distinguishes a normal response from a post-approval disruption.
 */
export async function respondCoverCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: RespondCoverInput,
): Promise<CoverAssignment> {
  const { data, error } = await supabase.rpc("respond_cover", {
    p_cover_id: input.coverId,
    p_accept: input.accept,
  });
  if (error) throw new DomainError(error.message);
  const cover = toCoverAssignment(data as RawCoverRow);

  const isPostApprovalRelease = !input.accept && cover.status === "released";
  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: isPostApprovalRelease ? "cover.release" : "cover.respond",
    p_entity_type: "cover_assignment",
    p_entity_id: cover.id,
    p_metadata: { accepted: input.accept },
  });
  if (auditError) console.error("[audit] cover.respond/release failed to log", auditError);

  return cover;
}

/** `useMyCoverNominations` — nominations awaiting THIS employee's accept/decline. */
export async function listMyCoverNominationsCore(
  supabase: SupabaseClient,
  claims: Claims,
): Promise<CoverAssignment[]> {
  const { data, error } = await supabase
    .from("cover_assignment")
    .select("id, request_id, class_id, session_date, nominee_id, status, responded_at")
    .eq("nominee_id", claims.employeeId)
    .eq("status", "nominated")
    .order("session_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawCoverRow[]).map(toCoverAssignment);
}
