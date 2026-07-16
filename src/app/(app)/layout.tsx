import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { navItemsForRole, ROLE_LABEL } from "@/lib/domain/vocabulary";

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r p-4">
        <p className="mb-4 text-sm text-gray-500">{ROLE_LABEL[claims.role]}</p>
        <nav className="flex flex-col gap-2">
          {items.map((item) => (
            <a key={item.key} href={item.route} className="rounded px-2 py-1 hover:bg-gray-100">
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
