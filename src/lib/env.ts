import { z } from "zod";

/**
 * Startup env validation (fail-fast). Constitution Principle III / plan Constraints:
 * required env vars are validated so a missing secret fails loudly at boot, not mid-request.
 *
 * Split by exposure:
 * - `publicEnv` is safe for the browser (NEXT_PUBLIC_ prefix).
 * - `serverEnv` MUST only be read in server contexts; the service-role key bypasses RLS and
 *   must never reach the client (no NEXT_PUBLIC_ prefix).
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Read + validate server-only env. Call this ONLY from server code (actions, route handlers,
 * seed/admin scripts). Throws if a required server secret is absent.
 */
export function getServerEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
