import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Test setup: load .env.local (or .env.test.local) into process.env so integration tests can
 * reach the LIVE local Supabase stack. No auth/DB mocking (constitution Principle IV) — these
 * tests run against `supabase start`, sequentially. If the env file is absent, tests that need
 * the DB will fail loudly, which is intended (do not silently pass without a real DB).
 */
const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env.local");

try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env.local not present yet — DB-backed tests will surface the missing config themselves.
}
