# Design brief: Jaxtina internal ops CRM ("jax-sales")

## What this is

`jax-sales` is Jaxtina's internal, Vietnamese-language CRM/ops tool used by staff at an IELTS training
centre chain. It is not the student/parent-facing product — it's the day-to-day working surface for
five internal roles across five feature areas (below). It currently runs on default, unstyled Tailwind
(gray borders, `gray-100` hovers, no brand color anywhere in the app chrome) and needs a real,
distinctive visual system.

**Your job:** design a complete design system — color, type, spacing, component states, and layout
patterns — for this internal tool, then apply it across the pages listed below. This is an **internal
enterprise tool**, not a marketing site: prioritize clarity, density-appropriate information design, and
a professional register over spectacle. But "internal tool" is not an excuse for a generic admin-panel
look — Jaxtina has a real, characterful brand (below) that should feel present in every screen, not just
in a logo in the corner.

## The existing brand — extend this, don't replace it

Jaxtina already has a brand identity, currently used only in one PDF-generation module (a roadmap
document handed to prospective students) and **never yet applied to the actual app UI**. Treat this as
the seed to grow the whole system from, not a constraint to work around.

```
Colors:
  navy   #2B3A8C   — primary brand color
  red    #D01F26   — secondary/accent brand color
  ink    #1A1A1A   — near-black text
  muted  #666666   — secondary text
  paper  #FFFFFF   — base background

Fonts:
  body     Montserrat   — ALL Vietnamese diacritic-bearing text (this is a hard technical
                           constraint, see below — never substitute for body copy)
  display  Sansita      — ASCII-only brand/display strings (headlines in Latin characters,
                           wordmarks — never Vietnamese body text)

Assets:
  logo     docs/design-system/assets/jaxtina-logo.png (real file, included in this folder)
  mascot   a schoolgirl-climber illustration (referenced in code, asset not yet delivered —
           design around its eventual presence, don't block on it)
```

There's also a second, richer palette already designed for a "mountain ascent" metaphor used in the
IELTS product (a training roadmap is presented as a climb up a mountain, read bottom to top — Jaxtina's
pedagogical claim is "Học chắc từ gốc, không nhảy cóc": build solidly from the roots, never skip a
level). This palette is NOT meant to be forced onto the whole CRM — the climb metaphor belongs to the
IELTS roadmap feature specifically — but it's useful evidence of the brand's visual range and could
inform accent/data-visualization colors elsewhere:

```
skyTop      #1B2660   skyMid   #2B3A8C   skyBase  #46549E
slopeLit    #F5F6FB   slopeDim #B9C0DD
pathLit     #D01F26   pathDim  #8A93BC
summitGlow  #FFD9A0
```

### Hard constraint (non-negotiable)

The product's visual identity **must not resemble** the Vietnamese TV programme "Đường lên đỉnh
Olympia" — not its logo, laurel/medal devices, color scheme, stage design, or any recognizable motif.
This constraint exists because the IELTS roadmap feature also uses a mountain-climb metaphor, and the
show does too; the resemblance must be avoided deliberately, not accidentally converged on. If your
design explores mountain/ascent/climb visual language anywhere, actively design away from that show's
specific visual vocabulary (its laurel wreath, its podium staging, its color scheme) — evoke height and
progress through Jaxtina's own means (the navy/red palette, original iconography), not through
similarity to an existing broadcast identity.

### Hard constraint: Vietnamese typography

All Vietnamese text uses diacritics extensively (ả, ế, ộ, ữ, etc.). Whatever body typeface you choose or
pair Montserrat with, **verify full Vietnamese glyph coverage** — many display/decorative webfonts drop
Vietnamese diacritics silently, which is a real bug class this codebase has already hit once (see the
`fonts.ts` note in the codebase-context file). Reserve display-only faces for short ASCII brand strings,
never for Vietnamese sentence-level content.

## Who uses this and what they're doing

Five roles, each seeing a different slice of the nav (this is enforced server-side, not just hidden in
CSS — the design should make each role's slice feel like *their* workspace, not a subset view of
someone else's):

| Role | Vietnamese label | Sees |
|---|---|---|
| `super_admin` | Quản trị hệ thống | Everything, network-wide |
| `centre_manager` | Quản lý trung tâm | Everything scoped to their centre, plus HR approvals/reports |
| `centre_admin` | Quản trị viên trung tâm | Most modules scoped to their centre |
| `sale_consultant` | Tư vấn tuyển sinh | Tasks, their own KPI performance, IELTS roadmap builder, HR requests |
| `teacher` | Giáo viên | Tasks (their own), HR requests, timetable |

This is a **multi-centre chain** (~10 physical training centres, low hundreds of staff) — centre
identity/scoping is a real, everyday concept for users, not an edge case.

## The pages to design (7 built, all real, all in scope)

1. **Công việc — Tasks** (`/tasks`) — a Kanban board (Cần làm / Đang làm / Hoàn thành / Tạm dừng),
   filterable, with a create-task form. Every role sees this. This is the highest-traffic page in the
   app — treat it as the anchor for the whole system's data-density and interaction patterns.
2. **Hiệu suất kinh doanh — Sales Performance/KPI** (`/hieu-suat`) — role-branched: consultants record
   period actuals and see their own attainment; managers see an approval queue, set targets, see a
   leaderboard, export reports (CSV+PDF). Needs a strong "attainment state" visual language: not-set /
   on-track / behind / no-result must read instantly and never be confused with each other.
3. **Lộ trình IELTS — IELTS Roadmap Builder** (`/lo-trinh-ielts`) — the one page that already has a
   distinct visual identity (the mountain-climb presentation, used live in front of prospective
   students). Out of primary redesign scope — the constitution treats its visual direction as
   load-bearing to the product's sales pitch — but note it in the system so surrounding chrome
   (nav, buttons) doesn't visually clash with it when a consultant navigates in and out.
4. **Yêu cầu nhân sự — HR Requests** (`/yeu-cau`) — every role submits/tracks 9 different request-form
   types (leave, overtime, salary advance, purchase, business travel, etc.) through one shared engine.
   Needs a form-type picker, status badges (pending/awaiting_cover/approved/rejected/cancelled/
   withdrawn), and a "my requests" list.
5. **Duyệt yêu cầu nhân sự — HR Approvals** (`/nhan-su/duyet`) — manager-only approval queue for the
   above.
6. **Lịch dạy — Timetable** (`/nhan-su/lich-day`) — admin view of the class schedule, used for
   conflict/cover-assignment detection when someone requests leave.
7. **Báo cáo nhân sự — HR Reports** (`/nhan-su/bao-cao`) — 4 report views (leave by employee, requests
   by type/status, outstanding leave balances, "who's off and who's covering") with CSV export. Just
   shipped, currently 4 stacked plain-HTML tables with zero styling — a good target for showing off the
   new system's data-table/report patterns.

Plus the **app shell** itself (`layout.tsx`): a left sidebar nav (currently: role label, flat list of
links, logout button) and a main content area. This is the first thing every user sees on every visit —
treat it with real design weight, not as scaffolding.

See `01-CODEBASE-CONTEXT.md` for the technical shape of these pages (current markup patterns, what
exists today) and `02-DELIVERABLE-SPEC.md` for exactly what output format is expected back.

## What "done" looks like

A cohesive system where:
- Every page shares one recognizable visual language, clearly Jaxtina's (navy/red-derived, Montserrat
  body), not a generic admin template.
- The Tasks Kanban board and the HR Reports tables — the two most information-dense surfaces — are
  legible and well-organized at realistic data volumes (dozens of tasks, hundreds of report rows).
- Status/state colors (task status, approval status, KPI attainment, HR request status) are visually
  distinct from each other and consistent in meaning across every page that reuses them.
- The system respects the Olympia-avoidance constraint and the Vietnamese-diacritics constraint above.
- Light and dark mode both feel intentional (the codebase already branches on
  `prefers-color-scheme: dark`, currently just swapping two variables — the new system should do this
  properly).
