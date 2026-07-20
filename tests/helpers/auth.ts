import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test helper: sign in as a REAL seeded user against the live local Supabase stack and return an
 * authenticated client. Constitution Principle IV forbids mocking auth/DB for these assertions —
 * every integration test in this suite goes through real `signInWithPassword` and real RLS.
 */

const SEED_PASSWORD = "Password123!";

export const SEEDED_USERS = {
  superAdmin: "admin@jaxtina.test",
  managerQ1: "manager.q1@jaxtina.test",
  managerQ3: "manager.q3@jaxtina.test", // US2 (T031): cross-centre manager for isolation proofs
  adminQ3: "admin.q3@jaxtina.test",
  saleQ1: "sale.q1@jaxtina.test",
  saleQ3: "sale.q3@jaxtina.test",
  teacherQ1: "teacher.q1@jaxtina.test",
  teacher2Q1: "teacher2.q1@jaxtina.test", // US4 (T039): second Q1 teacher — a real cover-nominee
  deactivatedQ1: "deactivated.q1@jaxtina.test",
} as const;

export const SEED_CENTRE_Q1 = "00000000-0000-4000-8000-000000000001";
export const SEED_CENTRE_Q3 = "00000000-0000-4000-8000-000000000002";
export const SEED_DEPT_TEACHER = "00000000-0000-4000-8000-0000000000d4";
export const SEED_DEPT_SALES = "00000000-0000-4000-8000-0000000000d2";
export const SEED_EMPLOYEE_TEACHER_Q1 = "10000000-0000-4000-8000-000000000006";
export const SEED_EMPLOYEE_TEACHER2_Q1 = "10000000-0000-4000-8000-000000000009";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing test env var ${name} — is .env.local present?`);
  return v;
}

/** A fresh, unauthenticated client (anon key) — used to sign in. */
export function anonClient(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

/** Sign in as a seeded user (real signInWithPassword) and return an authenticated client. */
export async function signInAs(email: string, password = SEED_PASSWORD): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInAs(${email}) failed: ${error.message}`);
  return client;
}

/** Service-role client for test setup/teardown that must bypass RLS (e.g. re-activating a user). */
export function serviceRoleClient(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
