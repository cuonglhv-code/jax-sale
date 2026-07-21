# Codebase context — Phase 2

Grounding for `00-BRIEF.md`, verified against the repo on 2026-07-20. Phase 1's design system (tokens,
shell, Tasks, HR Reports) is already implemented — see `design_handoff_jax_sales/README.md` for the full
token tables and `src/app/globals.css` for the live values. This file describes ONLY what's still unstyled.

## Current state of the 4 modules

### `/hieu-suat` (Sales Performance / KPI)

`page.tsx` branches by role and composes: `RecordActualForm` (self-report actual numbers),
`MyPerformance` (own attainment, read-only), `ApprovalQueue` (approve/reject pending actuals — a plain
3-column `<table>`, green/red default Tailwind buttons `bg-green-600`/`bg-red-600`), `TargetEditor`
(set per-consultant/dept targets), `Dashboard` and `ExportButton` (both already restyled in Phase 1 as
part of the token wiring — reference these two for the established table/badge pattern before designing
the rest).

`ApprovalQueue.tsx`'s actual shape today (representative of the module's current state):

```tsx
<table className="w-full border-collapse text-sm">
  <thead><tr className="border-b text-left">
    <th className="py-2">Chỉ số</th>
    <th className="py-2">Kết quả</th>
    <th className="py-2"></th>
  </tr></thead>
  <tbody>{pending.map((entry) => (
    <tr key={entry.id} className="border-b">
      <td className="py-2">{METRIC_LABEL[entry.metricKey]}</td>
      <td className="py-2">{entry.actual.toLocaleString("vi-VN")}</td>
      <td className="flex gap-2 py-2">
        <button className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50">Duyệt</button>
        <button className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50">Từ chối</button>
      </td>
    </tr>
  ))}</tbody>
</table>
```

### `/yeu-cau` (HR Requests)

`HrRequestsBoard.tsx` composes `RequestTypePicker` (9 buttons) + one of 9 form components (some share
`LeaveFamilyForm.tsx` for the 4 leave-family types; `AnnualLeaveForm`, `OvertimeForm`,
`SalaryAdvanceForm`, `PurchaseForm`, `BusinessTravelForm` are distinct) + `MyRequestsList` +
`MyCoverNominations`.

`RequestTypePicker.tsx`'s current button style:

```tsx
<button
  className={`rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
    isSelected ? "border-blue-600 bg-blue-50" : ""
  }`}
>
  {REQUEST_TYPE_LABEL[type]}
  {!isRegistered && <span className="ml-1 text-xs text-gray-400">(sắp ra mắt)</span>}
</button>
```

All 9 request-type buttons render in a flat `flex flex-wrap gap-2` row — no visual grouping by category
(leave-family vs. money-forms vs. logistics), though the underlying types do fall into natural groups:
- Leave family: annual_leave, sick_leave, personal_leave, unpaid_leave
- Money forms: salary_advance, purchase
- Logistics: shift_swap, overtime, business_travel

Every request already has a real status badge available (`REQUEST_STATUS_COLOR`, `REQUEST_STATUS_LABEL`
from `vocabulary.ts`, both wired to real tokens in Phase 1) — `MyRequestsList.tsx` doesn't yet use them
(renders plain text status today).

### `/nhan-su/duyet` (HR Approvals)

`ApprovalQueueBoard.tsx` — manager-only queue, structurally similar to KPI's `ApprovalQueue` above:
approve/reject with an optional reason, cover-assignment context shown when a request has one. Smallest
of the 4 modules (223 lines total across 2 files).

### `/nhan-su/lich-day` (Timetable)

`TimetableBoard.tsx` is currently a **flat list, not a calendar/grid** — a create/edit form at the top
(course name, teacher select, weekday select, start/end time, start/end date, active checkbox) and below
it a plain vertical list of classes, one row per class, each showing `courseLabel · weekday · time range
· date range [· inactive marker] [Sửa button]`. No visual grouping by day-of-week or time slot exists
yet — that's a real design decision this phase should make (grid by weekday? grouped list? actual
calendar?), not something to preserve as-is.

`TeachingClass` fields available: `courseLabel`, `teacherId`/teacher name (via `listTeachers`),
`weekday` (1–7, `WEEKDAY_LABEL` in vocabulary.ts gives Vietnamese names), `startTime`/`endTime`
(`HH:MM:SS`), `startDate`/`endDate`, `isActive`.

## Design system already available (from Phase 1 — reuse, don't recreate)

- All color tokens under `@theme` in `globals.css` — `--color-navy`, `--color-red`, full neutral ramp,
  `--color-pri-*` (3), `--color-att-*` (4), `--color-st-*` (7, includes `doing`), both light and dark.
- `PRIORITY_COLOR`, `ATTAINMENT_COLOR`, `REQUEST_STATUS_COLOR`, `TASK_STATUS_COLOR` — all real
  `BadgeColor` (text/bg/border triple) maps in `vocabulary.ts`, ready to reuse for any status badge in
  these 4 modules.
- Shared `Field`/`SelectField` components (`src/components/form/`) — already restyled in Phase 1, used
  by every form in the app including these 4 modules today. Reuse them for new form fields rather than
  hand-rolling new input styles.
- `Sidebar`/`TopBar`/`NavLink`/`CentreSwitcher`/`ThemeToggle` (`src/app/(app)/`) — the shell, already
  wired to real nav/route data. Do not touch.
- Established component patterns from Tasks + HR Reports: card style (`rounded-[var(--radius-card)]
  border border-border bg-surface`, hover lift+shadow), data-table style (uppercase muted header on
  `--surface-2`, zebra rows, tabular-nums numbers, hover), drawer style (slide-over from
  `CreateTaskDrawer.tsx`), segmented filter buttons (`TaskFilters.tsx`).

## Language

Same as Phase 1 — every string is Vietnamese, sentence-case, professional, no filler. Reuse
`vocabulary.ts`'s existing labels; only write new copy for genuinely new UI moments.
