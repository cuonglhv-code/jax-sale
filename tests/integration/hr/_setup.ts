import type { SupabaseClient } from "@supabase/supabase-js";
import { signInAs, serviceRoleClient, SEEDED_USERS, SEED_CENTRE_Q1, SEED_CENTRE_Q3 } from "../../helpers/auth";

/**
 * HR slice (#004) integration test harness. Mirrors the foundation pattern: real signInWithPassword
 * against the LIVE local Supabase stack, real RLS, no auth/DB mocking (constitution Principle IV),
 * run sequentially (vitest fileParallelism:false). This module adds HR-specific seeded constants,
 * per-role client helpers, and storage fixtures for the private `medical-documents` bucket.
 *
 * ⚠ Storage: seed.sql seeds Postgres rows only — storage objects do NOT exist until a test creates
 * them (research R8). Use `setupMedicalFixture` / `teardownMedicalFixture` for that. The bucket
 * itself is declared in supabase/config.toml and only materializes after a full
 * `supabase stop && supabase start` followed by `supabase db reset`.
 */

export const MEDICAL_BUCKET = "medical-documents";

/** HR entities seeded in supabase/seed.sql (see the "HR Requests seed" block). */
export const HR_SEED = {
  leaveYear: 2026,
  policyConfigId: "40000000-0000-4000-8000-000000000001",
  classQ1Foundation: "40000000-0000-4000-8000-0000000000d1", // teacher.q1, Monday 18:00-20:00
  classQ1Intermediate: "40000000-0000-4000-8000-0000000000d2", // teacher.q1, Wednesday 18:00-20:00
  classQ3: "40000000-0000-4000-8000-0000000000d3",
  classQ1Teacher2: "40000000-0000-4000-8000-0000000000d4", // teacher2.q1, Tuesday 18:00-20:00
  balanceTeacherQ1: "40000000-0000-4000-8000-0000000000e1",
  balanceSaleQ1: "40000000-0000-4000-8000-0000000000e2",
  requestAnnualLeave: "40000000-0000-4000-8000-0000000000f1", // teacher.q1, pending
  requestSickLeave: "40000000-0000-4000-8000-0000000000f2", // sale.q1, pending
  requestSalaryAdvance: "40000000-0000-4000-8000-0000000000f3", // sale.q1, pending (amount)
  requestPersonalLeave: "40000000-0000-4000-8000-0000000000f4", // sale.q1, pending (still supports doc upload)
} as const;

export { SEED_CENTRE_Q1, SEED_CENTRE_Q3, SEEDED_USERS };

/** Role → seeded login email, for concise per-role client creation in HR tests. */
export const HR_ROLE_EMAIL = {
  superAdmin: SEEDED_USERS.superAdmin,
  managerQ1: SEEDED_USERS.managerQ1,
  managerQ3: SEEDED_USERS.managerQ3,
  adminQ3: SEEDED_USERS.adminQ3,
  saleQ1: SEEDED_USERS.saleQ1,
  saleQ3: SEEDED_USERS.saleQ3,
  teacherQ1: SEEDED_USERS.teacherQ1,
  teacher2Q1: SEEDED_USERS.teacher2Q1,
} as const;

export type HrRole = keyof typeof HR_ROLE_EMAIL;

/** Sign in as a seeded HR test user and return an authenticated (RLS-bound) client. */
export function hrClientFor(role: HrRole): Promise<SupabaseClient> {
  return signInAs(HR_ROLE_EMAIL[role]);
}

/** Resolve a seeded employee's id via their authenticated client (employees is broad-read). */
export async function resolveEmployeeId(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client.from("employees").select("id").eq("email", email).single();
  if (error || !data) throw new Error(`could not resolve employee id for ${email}`);
  return data.id as string;
}

/** A small in-memory PDF-like byte buffer for upload fixtures (real bytes, not a mock). */
export function samplePdfBytes(): Uint8Array {
  // Minimal PDF header + trailer — enough for a byte-level MIME sniff in US6 tests.
  return new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
}

export interface MedicalFixture {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Upload a medical-document object via the service-role client (bypasses storage RLS, matching the
 * real upload flow in storage-policies.md). Returns the fixture handle for teardown. Throws a clear
 * error if the bucket is absent (config.toml declared but stack not reloaded).
 */
export async function setupMedicalFixture(
  requestId: string,
  fileName = "doc.pdf",
  contentType = "application/pdf",
): Promise<MedicalFixture> {
  const path = `${requestId}/${fileName}`;
  const bytes = samplePdfBytes();
  const svc = serviceRoleClient();
  const { error } = await svc.storage.from(MEDICAL_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) {
    throw new Error(
      `medical fixture upload failed (${error.message}). If the bucket is missing, run a full ` +
        `\`supabase stop && supabase start\` then \`supabase db reset\` to reload config.toml.`,
    );
  }
  return { path, bytes, contentType };
}

/** Remove uploaded medical-document objects (idempotent — safe if already gone). */
export async function teardownMedicalFixture(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const svc = serviceRoleClient();
  await svc.storage.from(MEDICAL_BUCKET).remove([...paths]);
}
