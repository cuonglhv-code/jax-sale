# Handoff: jax-sales design system + Tasks board & HR Reports

## Overview
A complete visual system for **jax-sales**, Jaxtina's internal Vietnamese-language CRM/ops tool, plus
two fully-designed pages: the **Tasks Kanban board** (`/tasks`) and the **HR Reports page**
(`/nhan-su/bao-cao`), inside a persistent app shell (navy sidebar + top bar). Everything is grounded in
Jaxtina's real brand (navy `#2B3A8C`, red `#D01F26`, Montserrat) and fixes the undefined
`--pri-*` / `--att-*` badge tokens described in the codebase context with real light **and** dark values.

## About the design files
The file in this bundle (`JaxSales.dc.html`) is a **design reference created in HTML** — a working,
clickable prototype showing the intended look, states, and behavior. It is **not production code to copy
directly.** Your task is to **recreate it in the real codebase's environment** — Next.js 16 App Router,
React 19, TypeScript, Tailwind CSS v4 — using that project's established patterns (hand-written JSX +
Tailwind classes, tokens under `@theme` in `globals.css`, the existing `vocabulary.ts` label/`BadgeColor`
source). Port the *system*, not the HTML.

Open `JaxSales.dc.html` in a browser to interact with it. It is a self-contained streaming component; ignore
the `.dc.html` wrapper mechanics — read it as ordinary HTML/CSS/JS for reference.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interaction states are all specified. Recreate
the UI to match, using the codebase's Tailwind v4 tokens and React components. Exact hex/px values are in
**Design Tokens** below.

---

## Design Tokens

### 1) Paste into `globals.css` under `@theme` (Tailwind v4)
Light values are the defaults. Dark values go in a `.dark` (or `@media (prefers-color-scheme: dark)`)
override block — the app currently branches on `prefers-color-scheme`, but a **class-based `.dark`
toggle is recommended** so the top-bar sun/moon control works (persist choice to `localStorage` key
`jax-theme`).

```css
@theme {
  /* Brand */
  --color-navy: #2B3A8C;        /* primary — sidebar, primary buttons, headings, active */
  --color-navy-dark: #1B2660;   /* primary hover / pressed, sidebar gradient top */
  --color-navy-mid: #46549E;    /* focus ring */
  --color-navy-tint: #EAEDF7;   /* tinted fills, focus glow, avatar bg */
  --color-navy-tint-2: #DBE0F1;
  --color-red: #D01F26;         /* accent — the "checkpoint tick", alerts, destructive */
  --color-red-dark: #A81820;    /* red hover/pressed, error text */
  --color-red-tint: #FDECEC;

  /* Neutrals — light */
  --color-bg: #F4F5F8;          /* app content ground */
  --color-surface: #FFFFFF;     /* cards, tables, panels */
  --color-surface-2: #FAFAFB;   /* zebra rows, inputs, subtle fills */
  --color-surface-3: #EFF1F6;   /* count pills, hover fills */
  --color-border: #E5E7EF;
  --color-border-strong: #CBD0DE;
  --color-text: #1A1A1A;
  --color-text-muted: #5E6472;
  --color-text-faint: #8B90A0;

  /* Type */
  --font-body: 'Montserrat', system-ui, sans-serif;   /* ALL Vietnamese text */
  --font-display: 'Sansita', serif;                    /* ASCII wordmark ONLY */

  /* Radius */
  --radius-field: 9px;   /* inputs, buttons */
  --radius-card: 10px;   /* task cards */
  --radius-panel: 12px;  /* columns, report sections */

  /* Shadow (light) */
  --shadow-sm: 0 1px 2px rgba(20,26,54,.07);
  --shadow-md: 0 6px 20px rgba(20,26,54,.12);
  --shadow-lg: 0 18px 44px rgba(15,20,44,.22);
}
```

### 2) Sidebar tokens (navy chrome, same in both themes with minor shift)
```css
/* light */
--sidebar-grad: linear-gradient(178deg,#1B2660 0%,#12183A 100%);
--sidebar-text: #B7BEDB;  --sidebar-text-active: #FFFFFF;
--sidebar-active: rgba(255,255,255,.10); --sidebar-hover: rgba(255,255,255,.055);
--sidebar-border: rgba(255,255,255,.09);
/* dark */
--sidebar-grad: linear-gradient(178deg,#0F1428 0%,#070A14 100%);
--sidebar-text: #8E96AE;  --sidebar-active: rgba(255,255,255,.09); --sidebar-hover: rgba(255,255,255,.05);
--sidebar-border: rgba(255,255,255,.07);
```

### 3) Dark-mode neutral overrides
```css
.dark {
  --color-bg:#0D1017; --color-surface:#151A23; --color-surface-2:#1A202B; --color-surface-3:#222A38;
  --color-border:#28303D; --color-border-strong:#3A4453;
  --color-text:#E7EAF2; --color-text-muted:#9BA2B4; --color-text-faint:#6C7488;
  --color-navy:#8C9AE0; --color-navy-dark:#0E1430; --color-navy-mid:#6C7CD1;
  --color-navy-tint:#1A2240; --color-navy-tint-2:#232C50;
  --color-red:#F0757A; --color-red-dark:#F5989C; --color-red-tint:#2C1719;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4); --shadow-md:0 6px 22px rgba(0,0,0,.5); --shadow-lg:0 20px 50px rgba(0,0,0,.6);
}
```

### 4) State-color tokens (the `BadgeColor` triples — replaces the undefined tokens)
Each state is a **text / bg / border** triple, matching `vocabulary.ts`'s `BadgeColor` interface so
existing component code plugs in unchanged. Wire these into `vocabulary.ts`.

**Task priority (3) — light → dark**
```
--pri-high-text  #A81820 → #F3999D   --pri-high-bg  #FDECEC → #2E1618   --pri-high-border  #F4C4C6 → #5A2A2E   (Cao)
--pri-mid-text   #8A5B0A → #F0C978   --pri-mid-bg   #FCF1DC → #2A2110   --pri-mid-border   #F1D8A0 → #544526   (Trung bình)
--pri-low-text   #2B3A8C → #A9B4E8   --pri-low-bg   #EAEDF7 → #191F38   --pri-low-border   #C3CBE8 → #333D63   (Thấp)
```
**KPI attainment (4)**
```
--att-notset-*    #5B6270/#EFF0F3/#D9DCE4  →  #AEB4C2/#1E222B/#3A4250   (Chưa đặt mục tiêu)
--att-ontrack-*   #1B6B3A/#E5F4EB/#B4DDC3  →  #86D3A2/#122419/#2C4A38   (Đạt mục tiêu)
--att-behind-*    #B23A12/#FBEBE3/#F3CBB6  →  #F0A583/#2A1A12/#553424   (Chưa đạt)
--att-noresult-*  #5A4B8A/#F0ECF8/#D6CCEC  →  #B7A9E0/#1F1A30/#3D3560   (Chưa có kết quả)
```
**HR request status (6)** — reuse for the HR status enum in `vocabulary.ts`
```
--st-pending-*    #8A5B0A/#FCF1DC/#F1D8A0  →  #F0C978/#2A2110/#544526   (Chờ duyệt)
--st-awaiting-*   #0E6C86/#E2F4F9/#AEE0EC  →  #8AD4E6/#0F252C/#295059   (Chờ người thay / awaiting_cover)
--st-approved-*   #1B6B3A/#E5F4EB/#B4DDC3  →  #86D3A2/#122419/#2C4A38   (Đã duyệt)
--st-rejected-*   #A81820/#FDECEC/#F4C4C6  →  #F3999D/#2E1618/#5A2A2E   (Bị từ chối)
--st-cancelled-*  #5B6270/#EFF0F3/#D9DCE4  →  #AEB4C2/#1E222B/#3A4250   (Đã hủy)
--st-withdrawn-*  #5A4B8A/#F0ECF8/#D6CCEC  →  #B7A9E0/#1F1A30/#3D3560   (Đã rút)
```
Task-status (TODO/DOING/DONE/BLOCK/RESCHEDULED/CANCELLED): reuse the same hues — TODO=notset(neutral),
DOING=navy, DONE=ontrack(green), BLOCK=rejected(red), RESCHEDULED=pending(amber), CANCELLED=cancelled(gray).

### 5) Type scale & weight rules
- **Body/table:** Montserrat 13–14px / 400–500.
- **Table header:** 11px, weight 700, `letter-spacing:.04em`, `text-transform:uppercase`, muted.
- **Card title:** 13.5px / 600. **Section title (h2):** 14.5–16px / 700. **Page title (h1):** 19px / 700, `letter-spacing:-.01em`.
- **Sidebar group label:** 10px / 700, `letter-spacing:.11em`, uppercase, 55% opacity.
- **Numbers in tables:** `font-variant-numeric: tabular-nums`, right-aligned.
- **Rule:** Montserrat is the ONLY face for Vietnamese (verified full diacritic coverage). Sansita is
  used *only* for the ASCII `jax-sales` wordmark — never for Vietnamese content.

### 6) Layout
Sidebar width **264px** (fixed). Top bar height **64px**. Content padding **20px 24px 28px**. Reports
content `max-width:1180px`. Table row height ~40px (cell padding `10px 16px`). **Depth cue = flat/bordered
surfaces** (1px `--color-border`), shadows reserved for overlays (drawer, dropdown) — not on cards.

---

## Screens / Views

### App shell (every page inherits it)
- **Layout:** `flex` row, full viewport height. Sidebar 264px + main (`flex:1`, column: 64px top bar +
  scrolling content).
- **Sidebar (navy gradient):** (1) brand lockup — real logo on a white rounded plate + `jax-sales`
  wordmark (Sansita) + "Vận hành nội bộ" caption; (2) **centre switcher** — button chip with map-pin icon
  showing current centre (`TT Cầu Giấy`); click opens a dropdown of centres (`Toàn hệ thống`, `TT Cầu Giấy`,
  `TT Hà Đông`, `TT Thanh Xuân`, `TT Long Biên`, `TT Times City`, `TT Đống Đa`) with a check on the active
  one; (3) nav grouped into **Chung** (Tổng quan, Công việc, Hiệu suất kinh doanh, Lộ trình IELTS) and
  **Nhân sự** (Yêu cầu nhân sự, Duyệt yêu cầu [red count badge "5"], Lịch dạy, Báo cáo nhân sự) — each item
  is icon + label; (4) footer — user avatar (`TH`), name "Trần Thu Hương", role "Quản lý trung tâm", logout
  icon button.
- **Active nav state (SIGNATURE):** active item gets `--sidebar-active` bg + white text + a **3px red
  vertical "checkpoint tick"** at its left edge (`height:20px`, `border-radius:0 3px 3px 0`, animates from 0).
- **Top bar:** breadcrumb (11px faint) above page title (h1); right side — search input (280px, magnifier
  icon, focus ring), notification bell (red dot), theme toggle (sun/moon).

### Screen: Tasks Kanban (`/tasks`)
- **Purpose:** highest-traffic page; staff triage/create tasks across 4 status columns.
- **Filter bar:** segmented priority filter (`Tất cả` / `Cao` / `Trung bình` / `Thấp`, each with a colored
  dot; active = white bg + navy text + navy focus-glow ring); right side "N / M công việc" counter + primary
  **Tạo công việc** button (plus icon).
- **Board:** horizontally-scrollable wrapper containing a 4-col grid (`repeat(4, minmax(248px,1fr))`,
  `min-width:1010px`, `gap:14px`). Columns: **Cần làm** (accent faint), **Đang làm** (navy), **Hoàn thành**
  (green), **Tạm dừng** (red). Each column: 3px top accent bar in its color + square color chip + title +
  count pill.
- **Task card:** `--radius-card`, 1px border, surface bg. Top row: group chip (colored dot + name:
  Tuyển sinh navy / Chăm sóc HV cyan `#0E8AA8` / Vận hành amber `#C08A1A` / Học vụ green `#2E8B57`) + priority
  badge (right). Title (13.5/600). Footer: round avatar (initials, navy-tint bg) + assignee name + due date
  (calendar icon; **red when overdue & not done**). Hover: `--border-strong` + `--shadow-md` + `translateY(-1px)`.
- **Column empty state:** dashed-border box, chart icon, "Không có công việc phù hợp bộ lọc" — shows when a
  filter empties a column.

### Screen: HR Reports (`/nhan-su/bao-cao`)
- **Purpose:** 4 stacked report tables with CSV export; replaces the current unstyled `<table>`s.
- **Filter bar (card):** `Từ ngày` / `Đến ngày` date inputs + `Trung tâm` select + "Xuất tất cả (CSV)"
  secondary button.
- **4 report sections**, each a bordered panel: header = 3px red tick + h2 title + count + per-section
  **Xuất CSV** button (loading state). Tables: uppercase muted header on `--surface-2`, zebra rows
  (`--surface-2` on odd), row hover, tabular-nums right-aligned numbers, min-width 620px in an
  `overflow-x:auto` wrapper.
  1. **Nghỉ phép theo nhân viên** — Nhân viên / Trung tâm / Phép năm / Đã dùng / Còn lại / Nghỉ gần nhất.
     "Còn lại" header is **sortable** (click toggles ⇅ → ▼ desc → ▲ asc).
  2. **Yêu cầu theo loại & trạng thái** — Loại / Chờ duyệt / Đã duyệt / Bị từ chối / Đã hủy / Tổng.
  3. **Số dư phép tồn** — Nhân viên / Trung tâm / Phép còn lại / Hạn sử dụng / Trạng thái (status badge:
     Sắp hết hạn=pending, Còn hạn=approved, Đã dùng hết=cancelled).
  4. **Ai đang nghỉ & ai thay ca** — Nhân viên nghỉ / Thời gian / Loại / Người thay ca (red when "Chưa bố
     trí") / Trạng thái badge.

### Placeholder pages
`Tổng quan`, `Hiệu suất`, `Lộ trình IELTS`, `Yêu cầu`, `Duyệt`, `Lịch dạy` render a centered empty state
(navy-tint icon tile, title, explanatory copy, "Về Công việc" button). In the real app these are the other
feature pages — the shell + routing already exist.

---

## Interactions & Behavior
- **Navigation:** sidebar items switch the active route; shell persists. In Next.js use `<Link>` + App
  Router segments; mark active with `usePathname()`.
- **Theme toggle:** flips `.dark` on `<html>`, persist to `localStorage['jax-theme']`, restore on mount.
- **Priority filter + search:** filter task list live (priority match AND title/assignee substring).
- **Create task drawer:** slides from right over a blurred backdrop (`--shadow-lg`). Fields: Tiêu đề
  (required), Nhóm (select), Hạn chót (date), Mức ưu tiên (segmented Cao/TB/Thấp), Người phụ trách (select),
  Mô tả (textarea). **Validation:** empty title → red border + red-tint focus glow + inline error "Vui lòng
  nhập tiêu đề công việc". **Submit:** button shows spinner + "Đang tạo…" (~900ms), then prepends the task
  to Cần làm and closes.
- **CSV export:** each button shows a spinner + "Đang xuất…" (~1.3s) then reverts; disabled while loading.
- **Transitions:** background/color `.12s`; nav tick height `.15s`; card hover transform `.12s`.

## Component states (all specified in the prototype)
- **Button primary:** navy fill / white; hover `--navy-dark`; loading = spinner + label swap + 0.8 opacity + `cursor:default`; disabled via `disabled` attr.
- **Button secondary:** surface-2 bg + border; hover surface-3 + border-strong.
- **Input/select/textarea:** surface-2 bg, 1px border; focus = navy border + 3px navy-tint glow; error = red border + red-tint glow.
- **Focus-visible (global):** `outline:2px solid var(--color-navy-mid); outline-offset:2px`.
- **Badge:** pill, 1px border, leading 6px dot in `currentColor`, colors from the triple tokens.

## State management
`theme`, `page/route`, `centre`, `centreOpen`, `search`, `priFilter`, `tasks[]`, `createOpen`,
`submitting`, `titleError`, create-form fields, `r1sortDir`, per-section `exporting` flags. In the real
app, tasks/reports come from the existing data layer; keep UI-only state local.

## Design Tokens — quick copy
All hex/px values are in the **Design Tokens** section above (brand, neutrals light+dark, 13 state-color
triples ×2 themes, type, radius, shadow, layout).

## Assets
- `jaxtina-logo.png` — the real Jaxtina English logo (included). Displayed on a white rounded plate in the
  navy sidebar so its navy wordmark stays legible.
- **Icons:** Lucide (stroke-width 1.5–1.6). Used: grid, check-square, trending-up, mountain, file-text,
  check-circle, calendar, bar-chart, map-pin, chevron-down, search, bell, sun, moon, log-out, plus, x,
  filter, download, calendar, alert-circle, check.
- **Mascot** (schoolgirl-climber) not yet delivered — leave room for it on empty states / dashboard later.

## Files
- `JaxSales.dc.html` — the full interactive design reference (shell + Tasks + Reports + all states).
- `jaxtina-logo.png` — brand asset.

## Constraints carried from the brief (keep these when porting)
1. **No resemblance to "Đường lên đỉnh Olympia"** — no laurel/wreath, medal, podium, or its color scheme.
   Height/progress is expressed only via the navy/red palette and the abstract red "checkpoint tick".
2. **Vietnamese diacritics** must render in Montserrat everywhere; never set Vietnamese in Sansita.
3. All UI copy is Vietnamese, sentence-case, professional, no filler — reuse existing `vocabulary.ts`
   strings (Chờ duyệt, Đã duyệt, Bị từ chối…); only write new copy for empty states / new microcopy.
