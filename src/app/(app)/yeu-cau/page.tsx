import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { getIndicativeAnnualBalanceCore } from "@/services/hr-request.service";
import { HrRequestsBoard } from "./HrRequestsBoard";

/** US1 (T022): employee submit + "my requests" — reachable by every role (data-model §13). */
export default async function HrRequestsPage() {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }

  const leaveYear = new Date().getFullYear();
  const balance = await getIndicativeAnnualBalanceCore(supabase, claims.employeeId, leaveYear);

  return <HrRequestsBoard remainingDays={balance?.remainingDays ?? null} />;
}
