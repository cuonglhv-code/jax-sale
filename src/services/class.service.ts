import type { SupabaseClient } from "@supabase/supabase-js";
import type { Claims, TeachingClass } from "@/lib/data/types";
import type { UpsertClassInput } from "@/schemas/hr/class";
import type { ConflictClass } from "@/lib/hr/conflict";
import { DomainError } from "@/lib/server-action";

interface RawClassRow {
  id: string;
  centre_id: string;
  course_label: string;
  teacher_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

function toTeachingClass(row: RawClassRow): TeachingClass {
  return {
    id: row.id,
    centreId: row.centre_id,
    courseLabel: row.course_label,
    teacherId: row.teacher_id,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

/** Maps the broad-read `class` shape into the pure resolver's minimal `ConflictClass` input. */
export function toConflictClass(row: TeachingClass): ConflictClass {
  return {
    id: row.id,
    centreId: row.centreId,
    teacherId: row.teacherId,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    startDate: row.startDate,
    endDate: row.endDate,
    isActive: row.isActive,
  };
}

const CLASS_COLUMNS =
  "id, centre_id, course_label, teacher_id, weekday, start_time, end_time, start_date, end_date, is_active";

/** T041: `useClasses(centreId?)` reads — broad read (schedules not sensitive), Pattern A. */
export async function listClassesCore(
  supabase: SupabaseClient,
  centreId?: string,
): Promise<TeachingClass[]> {
  let query = supabase.from("class").select(CLASS_COLUMNS).order("weekday", { ascending: true });
  if (centreId) query = query.eq("centre_id", centreId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawClassRow[]).map(toTeachingClass);
}

/** Every ACTIVE class taught by `teacherId`, regardless of caller's centre (the resolver needs the full picture). */
export async function listActiveClassesForTeacher(
  supabase: SupabaseClient,
  teacherId: string,
): Promise<TeachingClass[]> {
  const { data, error } = await supabase
    .from("class")
    .select(CLASS_COLUMNS)
    .eq("teacher_id", teacherId)
    .eq("is_active", true);
  if (error) throw error;
  return ((data ?? []) as unknown as RawClassRow[]).map(toTeachingClass);
}

/**
 * T041: create/update a class via the guarded `upsert_class` RPC (same-centre-teacher guard lives
 * in the Postgres function — mirrors `assign_task`'s shape). `centre_id` is never accepted from
 * `input`; the RPC derives it from the caller's claims (or, for an existing class, keeps that
 * class's own centre when the caller is `super_admin`).
 */
export async function upsertClassCore(
  supabase: SupabaseClient,
  _claims: Claims,
  input: UpsertClassInput,
): Promise<TeachingClass> {
  const { data, error } = await supabase.rpc("upsert_class", {
    p_id: input.id ?? null,
    p_course_label: input.courseLabel,
    p_teacher_id: input.teacherId,
    p_weekday: input.weekday,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_is_active: input.isActive,
  });
  if (error) throw new DomainError(error.message);
  const klass = toTeachingClass(data as RawClassRow);

  const { error: auditError } = await supabase.rpc("write_audit_log", {
    p_action: "timetable.upsert",
    p_entity_type: "class",
    p_entity_id: klass.id,
    p_metadata: { courseLabel: klass.courseLabel, teacherId: klass.teacherId },
  });
  if (auditError) console.error("[audit] timetable.upsert failed to log", auditError);

  return klass;
}
