# Handoff: jax-sales Phase 2 — Sales/KPI, HR Requests, HR Approvals, Timetable

## Overview
Phase 2 restyles the four modules Phase 1 left as placeholders, using the **existing Phase 1 design
system unchanged**. Read Phase 1's handoff (`design_handoff_jax_sales/README.md`) first for the token
tables, shell, and finished pages — this document only covers what's new.

**Hard rule honored:** no new colors, fonts, radii, or shadows. Every value below is an existing Phase 1
token. The only new *interaction* pattern is the approve/reject action pair (spec'd below), and it is
built from existing tokens.

## About the design files
`JaxSales.dc.html` (this bundle) is the same interactive prototype from Phase 1 with all four new modules
now built in behind the sidebar routes. It's a **design reference, not code to copy** — recreate the four
modules in the real Next.js 16 / React 19 / Tailwind v4 codebase using its established patterns
(`Field`/`SelectField`, the card/table/drawer/segmented patterns, `vocabulary.ts` `BadgeColor` maps).
Open it in a browser and click Hiệu suất kinh doanh / Yêu cầu nhân sự / Duyệt yêu cầu / Lịch dạy in the
sidebar to see each module.

## Fidelity
High-fidelity. States (hover/focus/disabled/loading, approve/reject, form validation) are all specified in
the prototype — match them using existing tokens.

---

## Token reuse map (nothing new)
| New UI element | Reuses |
|---|---|
| Section panel + red-tick header | HR Reports section pattern (`--surface`, `--border`, `--radius-panel`, 3px `--red` tick) |
| Data tables (KPI queue, target editor, requests list, timetable) | HR Reports table pattern (uppercase muted header on `--surface-2`, zebra rows, tabular-nums) |
| Status badges | `REQUEST_STATUS_COLOR` / `ATTAINMENT_COLOR` (`--st-*`, `--att-*` triples) |
| **Duyệt** button | primary button token (`--btn-primary` navy fill) |
| **Từ chối** button | ghost button using the `--st-rejected` triple (text/border, bg on hover) |
| Timetable Đang/Ngừng hoạt động | `--st-approved` / `--st-cancelled` (no new active/inactive pair) |
| Progress / leaderboard bars | `--navy` fill on a `--surface-3` track |
| Segmented controls (role switcher, day-part, status toggle, priority filter) | Tasks `TaskFilters` segmented pattern |
| Create-class / request forms | `Field`/`SelectField` + the `CreateTaskDrawer` slide-over pattern |
| Neutral type pill (request type) | `--surface-3` fill + `--border` (chrome, not a state token) |

---

## New component spec: approve/reject action pair
The one new interaction. **Build once, reuse in both KPI's queue and HR Approvals** — do not create two.
- **Duyệt**: primary button — `bg var(--btn-primary)`, white text, hover `var(--btn-primary-hover)`. Sizes: 30px tall in table rows, 38px in approval cards.
- **Từ chối**: ghost-danger — `bg var(--surface)`, `color var(--st-rejected-text)`, `border 1px var(--st-rejected-border)`, hover `bg var(--st-rejected-bg)`.
- On decide: replace the pair with the resulting status badge (`Đã duyệt` = `--st-approved`, `Bị từ chối` = `--st-rejected`) and, in cards, a muted confirmation line. In the real app this maps to the mutation + optimistic status update.
- The sidebar "Duyệt yêu cầu" nav count reflects **undecided** items (decreases as you approve/reject).

---

## Modules

### 1. Sales Performance / KPI (`/hieu-suat`) — role-branched
A role view is chosen server-side; the prototype exposes a switcher to demo both.
- **Consultant**: `MyPerformance` (per-metric attainment — big number `actual / target · pct`, a navy progress bar, an `--att-*` badge: ≥100% = Đạt mục tiêu/ontrack, else Chưa đạt/behind) + `RecordActualForm` (numeric inputs per metric with target hint; submit → loading "Đang gửi…" → success note "Đã gửi kết quả, chờ quản lý duyệt").
- **Manager**: `ApprovalQueue` (table Tư vấn / Chỉ số / Mục tiêu / Thực tế / action pair; header shows "N chờ duyệt") + `Leaderboard` (ranked rows: rank chip navy for top 3, avatar, name, navy bar, pct, att badge) + `TargetEditor` (inline-editable HV/Doanh thu inputs per consultant, footer "Lưu mục tiêu" → loading → "Đã lưu mục tiêu").
- Metrics: Số HV chốt (integer), Doanh thu (₫, vi-VN grouped). Reuse `METRIC_LABEL`, `ATTAINMENT_*` from `vocabulary.ts`.

### 2. HR Requests (`/yeu-cau`)
- **RequestTypePicker** grouped into 3 labeled clusters: **Nghỉ phép** (Nghỉ phép năm / Nghỉ ốm / Nghỉ việc riêng / Nghỉ không lương), **Tạm ứng & mua sắm** (Tạm ứng lương / Đề xuất mua sắm), **Vận hành lịch dạy** (Đổi ca / dạy thay, Tăng ca, Công tác). Selected = navy-tint fill + navy border; a not-yet-registered type renders disabled with "(sắp ra mắt)".
- **Selected form** = the leave-family shared form (4 of 9 types use it): Từ ngày / Đến ngày (date range, required), Buổi nghỉ (segmented Cả ngày / Buổi sáng / Buổi chiều), Người dạy thay (select), Lý do (textarea), Tệp đính kèm (optional dashed dropzone). Submit → loading → "Đã gửi yêu cầu, chờ duyệt".
- **MyRequestsList**: table Loại / Thời gian / Ngày gửi / Trạng thái — statuses as real `--st-*` badges (Đã duyệt, Bị từ chối, Chờ người thay, Đã hủy, Chờ duyệt).
- **MyCoverNominations**: cards with the class/time, a `--st-awaiting` "Chờ phản hồi" badge, and the action pair (Nhận dạy thay / Từ chối).

### 3. HR Approvals (`/nhan-su/duyet`) — manager only
Card queue. Each card: header (avatar, name, "Gửi {date}", neutral type pill, status badge); body detail grid (Thời gian / Số lượng / Lý do); a cover-context banner (`--st-awaiting` treatment) when the request needs a substitute teacher; footer = reject-reason input + the shared action pair. Uses the **same** approve/reject pattern as KPI.

### 4. Timetable (`/nhan-su/lich-day`) — grouped-by-weekday list
**Decision (agreed):** grouped-by-weekday list, NOT a calendar grid. Rationale: classes carry a single
weekday + a date range and volumes are low (a few dozen/centre), so a list sorted by start time puts
same-day classes adjacent for conflict-spotting, reuses the report-section+table pattern exactly, and adds
**zero new tokens** — a spatial week grid would need a new calendar-cell token and hide the date-range
dimension.
- One `<section>` per weekday that has classes (Thứ 2…Chủ nhật; empty days omitted), each the report-section pattern: red tick + "Thứ N" + "{count} lớp".
- Table: Khóa / lớp / Giáo viên / Giờ (start–end) / Khoảng ngày (start–end date) / Trạng thái. Rows sorted ascending by start time. Status badge: Đang hoạt động = `--st-approved`, Ngừng hoạt động = `--st-cancelled`.
- "Tạo lớp học" opens the drawer (reused `CreateTaskDrawer` pattern): Tên khóa/lớp, Giáo viên, Thứ, Giờ bắt đầu/kết thúc, Từ/Đến ngày, Trạng thái (segmented). `TeachingClass` fields: `courseLabel`, `teacherId`, `weekday` (1–7, `WEEKDAY_LABEL`), `startTime`/`endTime`, `startDate`/`endDate`, `isActive`.

---

## Interactions & states (in the prototype)
- Approve/reject → status badge swap; nav count decrements.
- All submit buttons: disabled + spinner + label swap ("Đang gửi…" / "Đang lưu…") ~900ms, then a success note.
- Form focus = navy border + 3px navy-tint glow; required marked with red `*`.
- Segmented controls, card/row hovers, drawer slide-over — all inherit Phase 1 behavior.
- Light/dark: every new surface uses tokens, so both themes work with no extra work.

## Sample data
Reuses Phase 1 staff names (Nguyễn Thị Mai Anh, Trần Quốc Bảo, Lê Hoàng Yến, Phạm Thị Hồng Nhung, Vũ Đức
Thắng, Đặng Thị Thu Hà, Bùi Minh Tuấn, Hoàng Thị Lan, Ngô Văn Sơn, Đỗ Thị Kim Ngân) and centres, for
continuity. All copy is Vietnamese — reuse `vocabulary.ts` labels; only empty-state / new microcopy is new.

## Constraints (carried from Phase 1)
1. No resemblance to "Đường lên đỉnh Olympia" — no laurel/medal/podium or its palette.
2. Vietnamese diacritics render in Montserrat everywhere; Sansita is ASCII wordmark only.
3. Vietnamese, sentence-case, professional, no filler; reuse existing strings.

## Files
- `JaxSales.dc.html` — the full interactive prototype (Phase 1 pages + the four Phase 2 modules).
