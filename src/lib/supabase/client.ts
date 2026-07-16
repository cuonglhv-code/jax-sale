import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Browser Supabase client. Only ever consumed through src/lib/data/index.ts (the data seam). */
export function createBrowserSupabaseClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
