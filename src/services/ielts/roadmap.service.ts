import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims } from "@/lib/data/types";
import type { SubmitRoadmapInput } from "@/schemas/roadmap";
import type { RoadmapRecord } from "./types";
import { DomainError } from "@/lib/server-action";
import { resolveEffectiveCentre } from "@/lib/domain/vocabulary";
import { resolvePageSize, toRange, type Paginated } from "@/lib/pagination";
import { toCamelCase } from "@/lib/case";

/**
 * FR-LOG-01/02: log a generated roadmap to `roadmap_records` (centre from claims — never client),
 * idempotent on `generationKey`, plus a general audit-log entry (FR-024g). Injected client so it is
 * callable from the server action and from integration tests (Principle IV — no mocking).
 */
export async function logRoadmapRecordCore(
  supabase: SupabaseClient,
  claims: Claims,
  input: SubmitRoadmapInput,
): Promise<{ recordId: string | null }> {
  const r = input.request;
  const { data, error } = await supabase
    .from("roadmap_records")
    .upsert(
      {
        centre_id: claims.centreId,
        consultant_id: claims.employeeId,
        student_name: r.studentName,
        student_email: r.studentEmail,
        student_phone: r.studentPhone ?? null,
        audience: r.audience,
        current_band: r.currentBand,
        target_band: r.targetBand,
        course_sequence: input.courseSequence,
        manual_edited: input.manualEdited,
        sent: input.deliveryStatus === "delivered",
        generation_key: input.generationKey,
      },
      { onConflict: "generation_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) throw new DomainError(error.message);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "roadmap.generate",
    p_entity_type: "roadmap",
    p_entity_id: data?.id ?? "00000000-0000-4000-8000-000000000000",
    p_metadata: { manualEdited: input.manualEdited, sent: input.deliveryStatus === "delivered" },
  });
  if (auditError) console.error("[audit] roadmap.generate failed to log", auditError);

  return { recordId: data?.id ?? null };
}

export interface ListRoadmapFilter {
  centreId?: string;
  consultantId?: string;
  page?: number;
  pageSize?: number;
}

/** FR-LOG-02: broad-read, effective-centre-scoped list for the academic-team audit view. */
export async function listRoadmapRecordsCore(
  supabase: SupabaseClient,
  claims: Claims,
  filter: ListRoadmapFilter,
): Promise<Paginated<RoadmapRecord>> {
  const effectiveCentre = resolveEffectiveCentre(claims.role, claims.centreId, filter.centreId);
  const pageSize = resolvePageSize(filter.pageSize);
  const page = filter.page ?? 1;
  const { from, to } = toRange(page, pageSize);

  let query = supabase.from("roadmap_records").select("*", { count: "exact" });
  if (effectiveCentre !== undefined) query = query.eq("centre_id", effectiveCentre);
  if (filter.consultantId) query = query.eq("consultant_id", filter.consultantId);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new DomainError(error.message);

  return {
    rows: (data ?? []).map((row) => toCamelCase<RoadmapRecord>(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
  };
}
