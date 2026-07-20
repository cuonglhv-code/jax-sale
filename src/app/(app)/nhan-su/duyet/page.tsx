import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { ApprovalQueueBoard } from "./ApprovalQueueBoard";

/**
 * US2 (T036): the manager's one-screen approval queue. Gated to `centre_manager`/`super_admin`
 * (matches the `hrApprovals` NAV_ITEMS entry, vocabulary.ts) — any other role is bounced to the
 * dashboard rather than seeing an empty/forbidden queue.
 */
export default async function HrApprovalsPage() {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }
  if (claims.role !== "centre_manager" && claims.role !== "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Duyệt yêu cầu nhân sự</h1>
      <ApprovalQueueBoard />
    </div>
  );
}
