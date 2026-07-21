# What to hand back — Phase 2

Same format as Phase 1's handoff (`design_handoff_jax_sales/`): a working, clickable interactive
Artifact (HTML/CSS/JS or React), not static mockups — this gets ported into real Tailwind v4 + React by
hand afterward, same as Phase 1 was.

## Required

1. **Reuse Phase 1's tokens exactly** — no new colors/fonts/radius/shadow values. If a genuinely new
   visual need arises with no existing token (e.g. a calendar-grid cell state), flag it explicitly
   rather than inventing a value silently.
2. **All 4 modules mocked with realistic Vietnamese sample data** (plausible names, dates, amounts —
   reuse names from `design_handoff_jax_sales/JaxSales.dc.html`'s own sample data for continuity):
   - KPI: at least the `ApprovalQueue` (approve/reject actions) and `RecordActualForm` (self-report
     form) since these are the two states no other module in the app has shown yet (an inline editable
     numeric form; a tabular approve/reject action pair).
   - HR Requests: the `RequestTypePicker` (grouped by leave-family/money/logistics per the codebase
     context) + at least one representative form in full (suggest the leave-family shared form, since
     4 of 9 types use it) + `MyRequestsList` with real status badges.
   - HR Approvals: the approval queue, establishing ONE pattern reused by both this and KPI's queue
     (don't design two different approve/reject visual languages for the same interaction).
   - Timetable: propose and mock a real layout decision (grid-by-weekday vs. grouped list vs. true
     calendar) — this is the one module with a genuinely open layout question, not just a restyle.
3. **Same output format as Phase 1**: token usage notes (confirm nothing new was invented), component
   specs for any new interaction pattern (e.g. an approve/reject action pair, if it differs from Phase
   1's existing button patterns), full mockups for the modules above, and a short rationale note.

## What NOT to do

- Do not redesign the shell, Tasks, or HR Reports (already built).
- Do not touch `/lo-trinh-ielts`.
- Do not invent new brand colors, fonts, or a second design language for these 4 modules — the entire
  point of this phase is consistency with what's already live.
