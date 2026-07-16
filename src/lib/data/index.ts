import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * THE single data seam (constitution §8, plan Project Structure). Client components NEVER import
 * Supabase directly — every read/write goes through this module (reads via query hooks that call
 * server actions; direct browser DB access, if ever needed, is created here and nowhere else).
 * This is the one swappable place if the backing implementation changes.
 */
export const dataSeam = {
  browserClient: createBrowserSupabaseClient,
};
