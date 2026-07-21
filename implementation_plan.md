# Implementation Plan: Pre-Launch Comprehensive Review & Testing

[Overview]
Complete a thorough review and testing pass across all 4 vertical slices (Tasks/Kanban, KPI Performance, IELTS Roadmap Builder, HR Requests) of jax-sales before launch — covering every page, action, service, migration, and test.

## ✅ Results (Completed 21 July 2026)

All verification checks pass with **zero failures**:

| Check | Status | Details |
|-------|--------|---------|
| **Tests** | ✅ **385/385 passed** | All 82 files — 225 unit + 160 integration |
| **TypeScript** | ✅ **Zero errors** | `tsc --noEmit` clean |
| **Build** | ✅ **Production build success** | 14 routes compiled (12 dynamic + 2 static) |
| **Lint** | ✅ **Zero warnings** | 3 warnings fixed (1 unused eslint-disable, 2 react-pdf Image) |

### Key fixes applied:
1. **`.env.local`** — Updated `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to match fresh local `supabase start` values
2. **`eslint.config.mjs`** — Added rule override for `jsx-a11y/alt-text` in `src/lib/ielts/pdf/*.tsx` (react-pdf Image is not an HTML img element)
3. **`src/app/(app)/hieu-suat/TargetEditor.tsx`** — Removed unused `eslint-disable` directive

### Critical issues discovered and resolved:
- **Docker DNS resolution failure** after `supabase stop` corrupted old containers/volumes — required full `docker rm` + `docker volume rm` cleanup before `supabase start` worked
- **Auth sign-in pattern**: First sign-in per test file worked, subsequent sign-ins failed with empty `{}` error when using old anon key — fixed by updating `.env.local` after fresh `supabase start`

### Environment setup required:
- Docker Desktop (v29.4.0) must be running
- `npm run db:start` → `npm run db:reset` (21 migrations + seed)
- `.env.local` must have local Supabase keys (not the commented-out remote project)

### Routes (14 total):
- Static: `/`, `/login`, `/reset-password`
- Dynamic (server-rendered): `/hieu-suat`, `/lo-trinh-ielts`, `/nhan-su/bao-cao`, `/nhan-su/duyet`, `/nhan-su/lich-day`, `/tasks`, `/yeu-cau`, `/api/cron/pending-reminders`, `/api/cron/purge-documents`
- Middleware: `/ (proxy.ts)` — auth guard

### HR Polish Tasks (T063–T068) status:
All 6 unchecked tasks from `specs/004-hr-requests/tasks.md` remain pending:
- **T063**: Medical-doc auto-purge cron (`purge_after < today` sweep)
- **T064**: Leave-policy config UI (`/nhan-su/cau-hinh`)
- **T065**: Vocabulary completeness pass (no raw enum id renders)
- **T066**: Coverage top-up to ≥80%
- **T067**: Quickstart validation V1–V7 + security proofs S1–S4
- **T068**: VERIFY-AT-IMPLEMENTATION register walk

[Types]
No type system changes were needed — all existing types are correct.

[Files]
Files modified during review:
- `.env.local` — Updated anon/service-role keys for local dev
- `eslint.config.mjs` — Added react-pdf alt-text rule override
- `src/app/(app)/hieu-suat/TargetEditor.tsx` — Removed unused eslint-disable

[Functions]
No function modifications were needed.

[Dependencies]
No changes. Stack confirmed: Next.js 16.2.10, React 19.2.7, TypeScript 5.7.3, Supabase local.

[Testing]
All 385 tests pass against the live local Supabase stack — the security-proof tests (`permission-matrix`, `audit-completeness`, `isolation-e2e`) that were previously flagged as "not yet green" now pass. Each integration test goes through real `signInWithPassword` and real RLS (no mocking, per constitution Principle IV).

[Implementation Order]
Steps completed:
1. ✅ **Environment setup**: Docker clean → `supabase start` → `db reset` (21 migrations)
2. ✅ **Full test pass**: 385/385 green 
3. ✅ **Fix failing tests**: 0 failing tests after env fix
4. ✅ **TypeScript check**: Zero errors
5. ✅ **Production build**: Success (14 routes)
6. ⬜ **HR polish tasks**: T063–T068 remain unchecked
7. ✅ **KPI security-proof re-check**: All pass
8. ✅ **Final verification**: All green