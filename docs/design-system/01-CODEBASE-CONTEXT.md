# Codebase context

Technical grounding for the brief in `00-BRIEF.md`. This describes what exists today, verified against
the actual repo on 2026-07-20 — not aspirational.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- **Tailwind CSS v4** (`@import "tailwindcss"` in `globals.css`, zero custom `@theme` config today —
  every class in the app right now is an unmodified Tailwind default like `text-gray-500`,
  `border`, `hover:bg-gray-100`)
- No component library (no shadcn/ui, no Radix, nothing) — every element in every page is hand-written
  JSX with inline Tailwind classes
- No design tokens beyond two CSS custom properties (see below)

## Current state of `globals.css` (the entire file, verbatim)

```css
@import "tailwindcss";

:root {
  --background: oklch(99% 0 0);
  --foreground: oklch(18% 0 0);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(15% 0 0);
    --foreground: oklch(96% 0 0);
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

That's it. No brand font is loaded. No brand color is defined. The Montserrat/Sansita/navy/red brand
tokens described in the brief exist only inside one PDF-generation module and are invisible everywhere
else in the app.

## A known, real bug the new system should fix

The codebase's single vocabulary file (`vocabulary.ts`, the canonical source for every Vietnamese label
and badge color in the app) already references CSS custom properties for status/state badges that
**were never defined anywhere**. They resolve to nothing today — this is presently a latent bug, not a
working feature to preserve. Here is the exact list of tokens the code expects to exist, grouped by
what they represent:

**Task priority** (3 states — used on the Tasks Kanban board):
```
--pri-high-text / --pri-high-bg / --pri-high-border    (Cao / High)
--pri-mid-text  / --pri-mid-bg  / --pri-mid-border     (Trung bình / Medium)
--pri-low-text  / --pri-low-bg  / --pri-low-border     (Thấp / Low)
```

**KPI attainment state** (4 states — used on the Sales Performance dashboard/leaderboard):
```
--att-notset-text   / --att-notset-bg   / --att-notset-border    (Chưa đặt mục tiêu / not set)
--att-ontrack-text  / --att-ontrack-bg  / --att-ontrack-border   (Đạt mục tiêu / on track)
--att-behind-text   / --att-behind-bg   / --att-behind-border    (Chưa đạt / behind)
--att-noresult-text / --att-noresult-bg / --att-noresult-border  (Chưa có kết quả / no result yet)
```

Each badge color is a **triple** (text / background / border) by design — see the `BadgeColor`
TypeScript interface in `vocabulary.ts`. Any new state-color system should follow this same
text/bg/border triple shape so it plugs into existing component code without a rewrite, and should
define real light+dark values for both groups above.

There are two more status enums in the app that currently render with NO color coding at all (plain
text labels only) and would benefit from the same triple-token treatment if the new system extends to
them:
- **HR request status** (6 states): pending, awaiting_cover, approved, rejected, cancelled, withdrawn
- **Task status** (6 states, 4 shown as Kanban columns): TODO, DOING, DONE, BLOCK, plus
  RESCHEDULED/CANCELLED (list-only, not columns)

## Current app shell (`src/app/(app)/layout.tsx`, verbatim)

```tsx
<div className="flex min-h-screen">
  <aside className="flex w-56 flex-col border-r p-4">
    <p className="mb-4 text-sm text-gray-500">{ROLE_LABEL[claims.role]}</p>
    <nav className="flex flex-1 flex-col gap-2">
      {items.map((item) => (
        <a key={item.key} href={item.route} className="rounded px-2 py-1 hover:bg-gray-100">
          {item.label}
        </a>
      ))}
    </nav>
    <div className="mt-4 border-t pt-4">
      <LogoutButton />
    </div>
  </aside>
  <main className="flex-1 p-6">{children}</main>
</div>
```

A 224px (`w-56`) fixed sidebar, flat nav list, no logo, no active-route indicator, no centre switcher
visible in this shell (centre-scoping exists in data logic but has no chrome presence yet). This is the
literal starting point — feel free to restructure entirely, this is not a constraint, just the current
baseline.

## Representative page patterns (so you can gauge current density/complexity)

**Tasks Kanban** (`src/app/(app)/tasks/`) — `TasksBoard.tsx` renders `KanbanColumns.tsx` (4 status
columns) of `TaskCard.tsx` items, plus `TaskFilters.tsx` and a `CreateTaskForm.tsx`. Cards show title,
assignee, priority badge, group/category tag. This is the busiest, most-used screen in the app.

**HR Reports** (`src/app/(app)/nhan-su/bao-cao/ReportsBoard.tsx`) — just shipped, deliberately minimal:
4 stacked `<section>` blocks, each a plain `<table>` with a "Xuất CSV" export button, a shared date-range
filter row at the top. Every cell is unstyled text. A good target for showing what a "real" data table
in the new system looks like — sortable? zebra-striped? sticky header? your call.

**HR request forms** (`src/app/(app)/yeu-cau/`) — 9 form components (one per request type) sharing
common building blocks (date range, day-part selector, a cover-nomination picker, a file-attachment
upload for some types). Currently plain `<input>`/`<select>` with minimal Tailwind (`rounded border
px-2 py-1`, matching the visible pattern in `LeaveFamilyForm.tsx`). This is the app's most form-heavy
surface — worth a deliberate form-field/label/validation-error visual language.

**KPI Dashboard** (`src/app/(app)/hieu-suat/Dashboard.tsx`, `Leaderboard.tsx`, `ApprovalQueue.tsx`,
`TargetEditor.tsx`) — role-branched: a consultant sees `RecordActualForm` + `MyPerformance`; a manager
sees `ApprovalQueue` + `TargetEditor` + `Leaderboard` + `ExportButton`. Numeric/comparative data — the
first place a real chart or sparkline treatment could matter, though nothing currently exists beyond
plain numbers in tables.

**IELTS Roadmap** (`src/app/(app)/lo-trinh-ielts/`) — out of primary redesign scope (see brief), but
technically: `Mountain.tsx`, `Summit.tsx`, `StagePanel.tsx` etc. already implement the climb-metaphor
visual language using the `BRAND.mountain` palette. If useful as a reference for "here's Jaxtina's
existing visual range," it's worth a look, but don't feel obligated to match its specific execution.

## Language

Every user-facing string in the app is Vietnamese. There is no English UI at all — not even
placeholder/dev-only text. Any copy Claude Design writes for the redesign (empty states, button labels,
error messages) should be written in Vietnamese matching the existing register: direct, professional,
no filler (see examples throughout `vocabulary.ts` — e.g. "Chờ duyệt", "Đã duyệt", "Bị từ chối" for
statuses; sentence-case, no exclamation marks, no forced friendliness).
