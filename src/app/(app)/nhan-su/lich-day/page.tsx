import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { TimetableBoard } from "./TimetableBoard";

/**
 * US4 (T041): minimal class-timetable admin — gated to `centre_admin`/`centre_manager`/`super_admin`
 * (matches the `hrTimetable` NAV_ITEMS entry, vocabulary.ts). Exists ONLY to answer "which sessions
 * does this leave hit?" (FR-016) — deliberately not a scheduling system.
 */
export default async function HrTimetablePage() {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }
  if (!["centre_admin", "centre_manager", "super_admin"].includes(claims.role)) {
    redirect("/dashboard");
  }

  return <TimetableBoard />;
}
