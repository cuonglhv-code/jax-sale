import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, getServerEnv } from "@/lib/env";

/**
 * Fresh @supabase/ssr server client PER REQUEST (never a shared module-level client — constitution
 * Principle II / research R5). Canonical getAll/setAll cookie pattern (Next.js 16 App Router).
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; safe to ignore when proxy.ts refreshes sessions.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. SERVER-ONLY: never import from client code, never let the
 * key reach the browser (constitution Principle II). Used only for admin actions (create-login,
 * force-signout, deactivate) and seeding. Fresh instance per call — no shared module-level client.
 */
export function createServiceRoleClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
