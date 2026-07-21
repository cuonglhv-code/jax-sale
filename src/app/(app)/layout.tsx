import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { navItemsForRole, isNetworkWideRole } from "@/lib/domain/vocabulary";
import { listApprovalQueueCore } from "@/services/hr-request.service";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

// Authenticated shell (FR-009): nav renders from `navItemsForRole`, the SAME list the route guard
// derives its protected-route set from (research R6) — no second parallel list.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();

  let claims;
  try {
    claims = await getVerifiedClaims(supabase);
  } catch {
    redirect("/login");
  }

  const items = navItemsForRole(claims.role);
  const showCentreSwitcher = isNetworkWideRole(claims.role);

  const [{ data: employee }, centresResult, approvalQueue] = await Promise.all([
    supabase.from("employees").select("full_name").eq("id", claims.employeeId).maybeSingle(),
    showCentreSwitcher ? supabase.from("centres").select("id, name").order("name") : Promise.resolve({ data: [] }),
    items.some((i) => i.key === "hrApprovals") ? listApprovalQueueCore(supabase, claims) : Promise.resolve([]),
  ]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        items={items}
        centres={centresResult.data ?? []}
        showCentreSwitcher={showCentreSwitcher}
        role={claims.role}
        fullName={employee?.full_name ?? "Nhân viên"}
        approvalCount={approvalQueue.length}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
