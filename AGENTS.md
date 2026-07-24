# AGENTS.md

## What is this?

`jax-sales` (Jaxtina) — Next.js 16 + React 19 + TypeScript + Supabase internal CRM/ops tool. Four vertical slices: IELTS roadmap builder, sales task/Kanban board, sales performance/KPI tracker, and HR requests module. Source of truth: `CLAUDE.md` and `specs/00N-*/spec.md`.

## Commands

```bash
npm run dev          # next dev --turbopack
npm run build        # production build
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (single run, SEQUENTIAL — do not parallelize)
npm run test:watch   # vitest watch
npm run test:cov     # vitest run --coverage
npm run db:start     # supabase start (local stack — REQUIRED before tests)
npm run db:reset     # supabase db reset (re-applies migrations + seed)
```

Single test file: `npx vitest run tests/unit/kpi/attainment.test.ts`

**Critical:** Tests require a running local Supabase stack (`npm run db:start`) and `.env.local` populated from `.env.local.example`. There is NO mocking — tests sign in as real seeded users via `tests/helpers/auth.ts` against live RLS. Vitest config forces `fileParallelism: false` / `maxWorkers: 1` because integration tests share live DB state sequentially.

## Layering convention (every vertical slice follows this)

```
schemas/*.ts (zod validation + inferred types)
  → lib/domain/*        pure domain rules/vocab, no I/O
  → services/*.ts        Supabase I/O + orchestration ("...Core" functions)
  → app/actions/*.ts      "use server" — auth + permission check + zod.parse + call service
  → hooks/queries|mutations   React Query wrapping the action
  → components                call the hook
```

Always follow this ordering when adding a new feature or slice.

## Server action pattern

Every mutating server action uses `withError` from `src/lib/server-action.ts`:

```ts
"use server";
export async function createTask(raw: unknown): Promise<ActionResult<Task>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "task.create");
    const input = createTaskSchema.parse(raw);
    return createTaskCore(supabase, claims, input);
  });
}
```

- `ActionResult<T> = { data: T } | { error: string }` — never throws to caller.
- Errors map to Vietnamese user-facing messages; full detail logged server-side.
- Permission checks go through `src/lib/auth/assert-permission.ts`.

## Auth — three layers

1. **`src/proxy.ts`** — Next.js middleware (renamed from `middleware.ts` for CVE-2025-29927 defense). UX-only redirect; proves nothing about mutation safety. `PROTECTED_ROUTES` derived from `NAV_ITEMS` — never hand-maintain a parallel list.
2. **`src/app/(app)/layout.tsx`** — server-side `getVerifiedClaims(supabase)` re-check. Real gate for page rendering.
3. **Postgres RLS** — the authoritative layer. Every service/action must be safe if called directly. Never assume layers 1–2 protect a mutation.

## Supabase

- `createServerSupabaseClient()` = fresh `@supabase/ssr` client per request. `createServiceRoleClient()` bypasses RLS — server-only, never importable from client code.
- `src/lib/supabase/client.ts` = `createBrowserSupabaseClient()`, consumed only through `src/lib/data/index.ts`.
- `supabase/migrations/*.sql` — chronologically named `YYYYMMDDHHMMSS_description.sql`. Grouped by slice: `001` foundation, `002` roadmap, `003` KPI, `004` HR.
- `.mcp.json` points at a hosted Supabase MCP server for a **different project ref** than local dev — be aware which Supabase you're targeting.

## Config

- Path alias `@/*` → `./src/*`. `strict: true`. Target ES2022.
- npm is the package manager (package-lock.json).
- Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.
- ESLint: flat config with `eslint-config-next`. `jsx-a11y/alt-text` disabled for `src/lib/ielts/pdf/*.tsx`.

## Testing

- Tests live in `tests/unit/` and `tests/integration/`.
- Integration tests named `us{N}-*.test.ts` per slice (e.g. `tests/integration/hr/us4-cover.test.ts`).
- `tests/helpers/auth.ts` — `signInAs(email)` returns an authenticated Supabase client. `SEEDED_USERS` constants. Password: `Password123!`. Seed IDs in `SEED_CENTRE_Q1`, `SEED_CENTRE_Q3`, etc.
- `vitest.config.ts` uses `setupFiles: ["./tests/setup.ts"]` which loads `.env.local` into `process.env`.
- Test timeout: 30s. Hook timeout: 60s.

## Gotchas

- **`.specify/memory/constitution.md`** was rewritten to v2.0.0 — specs 001–004 validated against v1.0.0 and must be re-validated before further work on those slices.
- **`resend` + `@react-email/components`** are installed but not wired up yet (no email-sending code or cron route). `RESEND_API_KEY`/`CRON_SECRET` in `.env.local.example` are placeholders.
- **No Supabase Edge Functions** exist yet (`supabase/functions/` absent).
- **HR US4 (class-conflict-and-cover)** is in progress — files exist but `specs/004-hr-requests/tasks.md` T038–T044 unchecked.
- **KPI US6** security-proof tests written but not yet green (`tests/integration/kpi/{permission-matrix,audit-completeness,isolation-e2e}.test.ts`).

## Code style

- Don't add comments unless asked.
- Don't refactor adjacent code when making changes.
- Match existing style even if you'd do it differently.
- Every changed line should trace directly to the user's request.
