import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { NAV_ITEMS } from "@/lib/domain/vocabulary";
import { publicEnv } from "@/lib/env";

/**
 * Layer 1 — UI route guard (constitution: "renamed middleware"; deliberate defense against
 * middleware-bypass classes of vuln, e.g. CVE-2025-29927). UX convenience ONLY — never proof a
 * mutation is safe; that's Layer 2 (assertPermission) + Layer 3 (RLS).
 *
 * Protected routes are derived by ITERATING `NAV_ITEMS` (spec FR-009/research R6) — never a
 * hand-maintained parallel array. This is the exact invariant whose divergence caused a real
 * 500-vs-redirect bug in the reference implementation (a route added to nav but not the matcher).
 */
const PROTECTED_ROUTES = NAV_ITEMS.map((item) => item.route);
const PUBLIC_ROUTES = ["/login", "/reset-password"];

function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) return false;
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // UX-only check: has a session at all. NOT used to authorize mutations (that's Layer 2/3).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
