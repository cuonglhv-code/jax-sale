# Design brief — Phase 2: jax-sales remaining pages

## Context

Phase 1 (already built and live in the codebase) established the jax-sales design system — brand
tokens (navy `#2B3A8C`, red `#D01F26`, Montserrat/Sansita), a full light/dark theme, the app shell
(navy sidebar with the red "checkpoint tick" active-nav indicator, top bar with search/notifications/
theme toggle), and two fully-designed pages: the Tasks Kanban board and HR Reports. That design
reference lives in `design_handoff_jax_sales/` in this repo (read `README.md` there first — it documents
every token, the shell, and both finished pages in full).

**This brief covers everything Phase 1 deliberately left as a placeholder.** Phase 1's own prototype
said so explicitly: "Hai màn hình được dựng chi tiết là Công việc và Báo cáo nhân sự" (only Tasks and HR
Reports were built in detail; every other page was a stub). Those stub pages are now real, working
features in the codebase — built before Phase 1, never restyled — and still render in raw, unstyled
Tailwind (plain borders, `text-gray-500`, default `bg-blue-600` buttons, no brand color, no theme
support). This phase brings them up to the same system.

## Scope: 4 modules

Use the SAME token system, shell, and component patterns established in Phase 1 — do not propose new
colors, fonts, or a different sidebar/nav treatment. This is an extension, not a new system. Read
`design_handoff_jax_sales/README.md`'s token tables (§ Design Tokens) and the shell description before
starting.

### 1. Sales Performance / KPI (`/hieu-suat`)

Role-branched — the page renders different sections depending on who's looking:
- **sale_consultant**: `RecordActualForm` (self-report a period's actual numbers — enrolments closed,
  revenue) + `MyPerformance` (their own attainment against target, read-only).
- **centre_manager / centre_admin**: `ApprovalQueue` (approve/reject pending actuals from their
  consultants) + `TargetEditor` (set per-consultant targets).
- **centre_manager / centre_admin / super_admin**: `Dashboard` (tiered attainment table, already
  restyled in Phase 1 as reference — reuses `ATTAINMENT_COLOR`/`ATTAINMENT_STATE_LABEL`) +
  `Leaderboard` (ranked list) + `ExportButton` (CSV + branded PDF).

This is the module with the most distinct visual needs: a self-report form, an approval queue (accept/
reject actions), a target-setting form, and comparative/ranked data (leaderboard) — the first real
opportunity in the app for a chart or sparkline treatment, though nothing like that exists today (it's
plain numbers in tables). The attainment state colors (not_set/on_track/behind/no_result) are already
defined as real tokens (`--color-att-*`, both themes) from Phase 1 — reuse them, don't invent new ones.

### 2. HR Requests (`/yeu-cau`)

The most form-heavy surface in the app: a `RequestTypePicker` (9 buttons, one per request type — annual
leave, sick leave, personal leave, unpaid leave, shift swap, overtime, salary advance, purchase,
business travel) that swaps in one of several type-specific forms below it, plus `MyRequestsList` (the
requester's own submission history with status badges) and `MyCoverNominations` (pending "will you cover
this class" responses for teachers). The 9 form types share common building blocks (date range, day-part
selector, a cover-nomination picker, optional file-attachment upload) but aren't all built from one
shared component today — expect some visual inconsistency between them that this pass should resolve
into one coherent form language. Every request status already has a real color token from Phase 1
(`REQUEST_STATUS_COLOR`, `--color-st-*`) — reuse the same badge treatment already built for HR Reports.

### 3. HR Approvals (`/nhan-su/duyet`)

Manager-only approval queue — structurally similar to the KPI `ApprovalQueue` above but for HR requests
specifically (approve/reject with a reason, cover-assignment context surfaced when relevant). Smallest
of the four modules; a good candidate for reusing whatever approval-queue pattern gets established for
KPI's `ApprovalQueue` rather than inventing a second one.

### 4. Timetable (`/nhan-su/lich-day`)

Admin view of the class schedule — used both as a reference ("who teaches what, when") and as the
backing data for conflict/cover-assignment detection when someone requests leave. Currently the least
built-out of the four in terms of interaction; this is a genuine schedule/calendar-shaped view, the
first in the app, so this pass should establish that visual pattern (a week/day grid or list — read the
current `TimetableBoard.tsx` to see what data shape exists before designing the layout).

## What NOT to change

- The app shell (sidebar, top bar, theme toggle) — already built, do not redesign it.
- Tasks (`/tasks`) and HR Reports (`/nhan-su/bao-cao`) — already fully built in Phase 1.
- `/lo-trinh-ielts` — has its own established, deliberately distinct visual system (the mountain-climb
  metaphor); out of scope for the whole design system project, not just this phase.
- The token system itself (colors, fonts, radius, shadow) — extend usage, don't add new tokens unless a
  genuinely new state/concept appears that has no existing token (flag it if so, don't invent silently).

## Constraints (unchanged from Phase 1 — carry forward)

1. No resemblance to "Đường lên đỉnh Olympia" — no laurel/wreath, medal, podium, or its color scheme.
2. Vietnamese diacritics render correctly in Montserrat everywhere; Sansita is never used for Vietnamese
   text, ASCII wordmark only.
3. All UI copy is Vietnamese, sentence-case, professional, no filler — reuse existing `vocabulary.ts`
   strings; only write new copy for genuinely new UI moments (empty states, new microcopy).
