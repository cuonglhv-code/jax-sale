# Feature Specification: IELTS Roadmap Builder

**Feature Branch**: `002-ielts-roadmap-builder`

**Created**: 2026-07-16

**Status**: Draft — requirements artifact (review gate 1 of 3: spec → plan → tasks)

**Input**: User brief — an internal tool for Jaxtina sales consultants that turns a prospective
student's current + target IELTS band into a personalised, ladder-consistent study roadmap, lets the
consultant review/edit it, and produces a branded Vietnamese PDF delivered to the student. Built as
**slice #002 of jax-sales**: a page in the existing Next.js + Supabase app, on the slice-#001
foundation (auth, the `sale_consultant` role, centre tenancy, the audit seam, the vocabulary /
nav-access-matrix seams).

---

## Overview

The **IELTS Roadmap Builder** lets a Vietnamese-speaking sales consultant, working on a laptop in a
centre, go from a blank form to a branded, ready-to-send PDF study roadmap in under three minutes.
The consultant enters a prospect's current and target band (plus audience segment and a few details);
a deterministic engine slices the **official IELTS 2026 course ladder** into a personalised sequence
of courses — with entry/output bands, session counts, a timeline, and per-course narrative — that
**can never skip a level**. The consultant reviews the roadmap exactly as the student will see it,
optionally edits narrative or adds a note, then approves; the tool renders an on-brand PDF, delivers
it to the student, and logs every roadmap so the academic team can audit what is being promised.

**Why this slice:** it is the consultant's primary pre-sales artifact and the first revenue-facing
surface of the rebuild. It reuses the foundation's tenancy, audit, permission-registry, and
vocabulary seams directly (proving those seams generalise beyond Tasks), and it establishes the
content-data pattern (editable Vietnamese copy separated from engine logic) that later academic
modules will reuse.

**Foundation integration (from slice #001):**
- New permission key `roadmap.generate` registered in the single permission registry (FR-024a of
  #001). Roles granted: `super_admin`, `centre_manager`, `centre_admin`, `sale_consultant`.
- One new entry in the single nav/access matrix (`NAV_ITEMS`), route `/lo-trinh-ielts`, label
  "Lộ trình IELTS", visible to the four roles above (not `teacher`).
- A new tenant-scoped entity (`RoadmapRecord`) following the broad-read / centre-narrow-write RLS
  pattern; its writes also emit the general audit-log entry (FR-024g of #001).
- All labels via the single vocabulary source; every mutating action flows through the canonical
  pipeline (`withError → assertPermission → schema.parse → service`).

---

## Domain data (authoritative — encode as data, not logic)

This data is the contract. It lives in a dedicated, **academic-team-editable** content store, kept
strictly separate from engine logic (FR-CONTENT-01). The engine reads it; it is never inlined.

### Course ladder

| Order | Code | Course name | Entry band | Output band | Sessions (buổi) |
|---|---|---|---|---|---|
| 1 | `PRE_S` | Pre-S (bổ trợ mất gốc) | below A1 | ~A1 | 16 |
| 2 | `IF1` | IELTS Foundation 1 | ~A1 | 2.5 | 24 (20 chính + 2 ôn tập + Midterm + Final) |
| 3 | `IF2` | IELTS Foundation 2 | 2.5 | 3.5 | 24 (20 chính + 2 ôn tập + Midterm + Final) |
| — | `GP` | Grammar Pathway | — | — | **TBD — placeholder; confirm with academic team** (optional insert) |
| 4 | `B1` | Booster 1 | 3.5 | 4.5 | 28 (24 chính + 2 ôn tập + Midterm + Final) |
| 5 | `B2` | Booster 2 | 4.5 | 5.5 | 28 (24 chính + 2 ôn tập + Midterm + Final) |
| 6 | `A1` | Achiever 1 | 5.5 | 6.0 | 28 (24 chính + 2 Mock + Midterm actual + Final actual) |
| 7 | `A2` | Achiever 2 | 6.0 | 6.5 | 28 (24 chính + 2 Mock + Midterm actual + Final actual) |
| 8 | `A3` | Achiever 3 | 6.5 | 7.0 | 28 (24 chính + 2 Mock + Midterm actual + Final actual) |
| — | `INT` | Luyện đề Intensive | 5.5+ | +0.5 overall | 16 |

**Band ordering** (for slicing; ascending): `below A1` < `~A1` < `2.5` < `3.5` < `4.5` < `5.5` <
`6.0` < `6.5` < `7.0` < `7.5` < `8.0+`. Current-band input options run `Chưa có nền ~A1` … `7.0`;
target-band input options run `2.5` … `8.0+`.

### Per-course narrative content shape (into the PDF; copy lives in the content store)

- **Booster 1 → Achiever 3** — four blocks each: (1) *Học viên bắt đầu ở đâu?* (2) *Nút thắt thật
  sự* (3) *Khóa học giải quyết như thế nào?* + a 3-row skill-progression table (Listening/Reading;
  Writing; Speaking) where each row = *Progression cốt lõi* + *Cách hiểu đơn giản* (4) *Sau khóa
  học, học viên thay đổi như thế nào?*
- **Foundation 1 & Foundation 2** — different shape: *Bạn sẽ học gì?* (Nghe & Đọc / Viết & Nói / Từ
  vựng / Ngữ pháp) + *Mục tiêu khóa học*.
- **Luyện đề Intensive** — *Đối tượng*, *Mục tiêu khóa học*, and a three-column content block (NÓI /
  VIẾT / CHIẾN LƯỢC THI).
- **Pre-S / Grammar Pathway** — copy shape TBD with academic team; rendered from the content store
  when present.

### Reference roadmaps (validation baseline — official deck slide 42)

The engine's output for a given entry/target/audience MUST land within the stated duration range for
that audience, or the design/plan MUST explain the divergence.

| Audience | Suggested path | Duration | Target |
|---|---|---|---|
| Mất gốc tiếng Anh | Pre-S → IF1 → IF2 → B1 → B2 → A1 → A2 | 18–24 months | 6.0–6.5 |
| Học sinh THCS | Grammar Pathway → (IF2) → B1 → B2 → A1 → A2 → (A3) | 15–18 months | 6.5–7.5 |
| Học sinh THPT | B1 → B2 → A1 → A2 → (A3) → Luyện đề | 10–13 months | 6.5–7.5+ |
| Sinh viên | B2 → A1 → A2 → Luyện đề | 6–7 months | 6.0–6.5 |
| Người đi làm | IF2 → B1 → B2 → A1 | 8–9 months | 6.0 |
| Muốn bứt phá | A2 → A3 → Luyện đề | 4–6 months | 7.0–8.0+ |

### Study intensity & timeline maths

- Standard delivery: 2 hours/session, 3 sessions/week, plus 1–1.5 h/day self-study on the LMS.
- Effective rate (holidays + make-ups): **~2.7 sessions/week** (Standard).
- `weeks = total_sessions / rate` → `months = weeks / 4.33`.
- "Tăng cường" (intensive) option: proposed **4 sessions/week** — **flagged for academic-team
  confirmation** (see Open Decisions).

### Commitment thresholds (verbatim in the PDF; MUST stay distinct)

| Threshold | Conditions |
|---|---|
| **Course completion certificate** | Overall ≥ level output band **AND** attendance ≥ 90% **AND** homework completion ≥ 90% |
| **Written output guarantee** (Cam kết đầu ra bằng văn bản) | Stricter — homework completion ≥ 95% **AND** no more than 1 absence per course |

These are two different guarantees. The PDF MUST render both and MUST NOT conflate, merge, or
approximate them (NON-NEGOTIABLE).

---

## User Scenarios & Testing *(mandatory)*

Acceptance criteria use EARS form: `WHEN <trigger> THE SYSTEM SHALL <response>` (event-driven),
`IF <condition> THEN THE SYSTEM SHALL <response>` (unwanted/edge), `WHILE <state>` (state-driven),
`THE SYSTEM SHALL <response>` (ubiquitous).

### User Story 1 — Consultant enters a prospect and generates a roadmap (Priority: P1)

A consultant opens the Roadmap Builder, fills a Vietnamese form (student name, audience segment,
email, phone, current band, target band, exam purpose, optional target exam date, intensity,
consultant name/phone/email, centre), and generates a personalised roadmap.

**Why P1**: This is the entry point; nothing downstream exists without a validated request and a
generated roadmap.

**Independent Test**: Fill the form with a valid entry/target/audience and generate → a roadmap with
an ordered course list, session totals, and a timeline appears.

**Acceptance criteria (EARS)**:
- AC-1.1 — WHEN the consultant submits the form with all required fields valid THE SYSTEM SHALL
  generate a roadmap and display it for review.
- AC-1.2 — IF the target band is not strictly greater than the current band THEN THE SYSTEM SHALL
  reject generation and show a Vietnamese validation message naming the offending fields.
- AC-1.3 — IF a required field (student name, audience, student email, current band, target band,
  intensity, consultant name, centre) is missing THEN THE SYSTEM SHALL block generation and mark
  each missing field.
- AC-1.4 — IF the student email is not a valid email format THEN THE SYSTEM SHALL block generation
  and flag the email field.
- AC-1.5 — THE SYSTEM SHALL present current band as a select (`Chưa có nền ~A1` … `7.0`) and target
  band as a select (`2.5` … `8.0+`), so a free-typed invalid band is impossible.
- AC-1.6 — THE SYSTEM SHALL restrict access to the four operational roles (`super_admin`,
  `centre_manager`, `centre_admin`, `sale_consultant`); WHEN a `teacher` attempts to reach the page
  THE SYSTEM SHALL deny access.

### User Story 2 — Roadmap never skips a level (Priority: P1) 🔒 NON-NEGOTIABLE

The generated sequence is a contiguous slice of the official ladder — from the course matching the
entry band through the course whose output band meets the target — with no rung omitted.

**Why P1**: "Học chắc từ gốc, không nhảy cóc" is a product principle, not a preference. A roadmap
that skips a level mis-sells the programme and is the single worst failure mode.

**Independent Test**: For every entry/target pair across the ladder, assert the output is exactly the
contiguous ladder slice with no gaps and correct endpoints.

**Acceptance criteria (EARS)**:
- AC-2.1 — WHEN a roadmap is generated THE SYSTEM SHALL include every ladder course from the
  entry-band course through the first course whose output band ≥ the target band, inclusive, in
  ladder order, with no course omitted.
- AC-2.2 — THE SYSTEM SHALL start the sequence at the course whose entry band matches the student's
  current band (e.g. current `2.5` → starts at `IF2`; current `3.5` → starts at `B1`).
- AC-2.3 — THE SYSTEM SHALL derive the sequence solely from the course-ladder data; IF the ladder
  data changes THEN THE SYSTEM SHALL reflect the change without any code edit.
- AC-2.4 — THE SYSTEM SHALL guarantee that no generated sequence contains a gap in ladder order
  (this invariant MUST be covered by automated tests across all entry/target pairs).

### User Story 3 — Auto-append Intensive, audience overrides, and timeline (Priority: P1)

The engine applies audience-specific overrides, auto-appends the Intensive exam-prep course when
warranted, and computes the full timeline and projected completion date.

**Why P1**: The roadmap is only correct and sellable when it reflects the audience path and shows a
believable duration and completion date.

**Independent Test**: Generate for each of the six reference audiences at a representative
entry/target; assert the path and that total duration falls within that audience's reference range.

**Acceptance criteria (EARS)**:
- AC-3.1 — WHEN the target band ≥ 5.5 AND (a target exam date is set OR the gap between target and
  the final selected course's output band ≤ 0.5) THE SYSTEM SHALL append `INT` (Luyện đề Intensive)
  to the sequence.
- AC-3.2 — WHEN the audience is "Mất gốc" THE SYSTEM SHALL start the sequence at `PRE_S`.
- AC-3.3 — WHEN the audience is "THCS" THE SYSTEM SHALL insert `GP` (Grammar Pathway) before `B1`.
- AC-3.4 — THE SYSTEM SHALL compute total sessions as the sum of all selected courses' session
  counts, and `weeks = total_sessions / rate`, `months = weeks / 4.33`, where rate = 2.7 (Standard)
  or the confirmed intensive rate (Tăng cường).
- AC-3.5 — WHEN a target exam date or a start date is available THE SYSTEM SHALL compute a projected
  completion date from the total months.
- AC-3.6 — THE SYSTEM SHALL produce, for each of the six reference audiences at its reference
  entry/target, a total duration within that audience's stated range (validation baseline); IF an
  output diverges THEN the divergence MUST be documented in the design.

### User Story 4 — Deadline feasibility warning (internal-only) (Priority: P2) 🔒 NON-NEGOTIABLE boundary

When the projected completion is later than the student's target exam date, the consultant is warned
— but the warning is structurally incapable of reaching the student PDF.

**Why P2**: Protects the written-output guarantee from being over-promised. Not required to generate
a roadmap, but a core safety control.

**Independent Test**: Generate with a target exam date earlier than projected completion → the
consultant view shows an amber warning; the produced PDF contains no trace of it.

**Acceptance criteria (EARS)**:
- AC-4.1 — WHEN the projected completion date is later than the target exam date THE SYSTEM SHALL
  show the consultant an amber warning recommending intensive intensity or a revised target.
- AC-4.2 — THE SYSTEM SHALL confine the deadline warning to the consultant-facing view; the warning
  data MUST NOT be included in any student-facing artifact (PDF or email). It MUST be structurally
  impossible for the warning to appear in the PDF.
- AC-4.3 — IF no target exam date is provided THEN THE SYSTEM SHALL omit the feasibility check
  without error.

### User Story 5 — Review & edit before sending (Priority: P2)

The consultant sees the roadmap exactly as the student will receive it and can edit narrative blocks
inline, add a free-text "Ghi chú từ tư vấn viên", remove a course, or reorder courses — with
guardrails.

**Why P2**: A consultant can send the auto-generated roadmap as-is; editing is an enhancement, but
overrides must be safe and audited.

**Independent Test**: Edit a narrative block, add a note, remove a course → the preview updates; the
removal raises a non-blocking warning and the record is flagged as manually edited.

**Acceptance criteria (EARS)**:
- AC-5.1 — THE SYSTEM SHALL render the review screen identically to the student-facing PDF layout.
- AC-5.2 — WHEN the consultant edits a narrative block inline THE SYSTEM SHALL reflect the edit in
  the preview and the eventual PDF.
- AC-5.3 — THE SYSTEM SHALL allow a free-text "Ghi chú từ tư vấn viên" placed above the courses.
- AC-5.4 — WHEN the consultant removes or reorders a course THE SYSTEM SHALL show a non-blocking
  warning that the result departs from the standard ladder, allow the consultant to proceed, and
  flag the roadmap as manually edited.
- AC-5.5 — WHEN a roadmap that was manually edited (narrative, note, removal, or reorder) is logged
  THE SYSTEM SHALL record the manual-edit flag.

### User Story 6 — Branded PDF with correct commitments and Vietnamese fidelity (Priority: P1)

The tool produces an on-brand PDF that needs no manual editing in another tool, with full Vietnamese
diacritics and both commitment thresholds stated distinctly.

**Why P1**: The PDF is the deliverable; brand correctness, diacritic fidelity, and threshold
accuracy are hard acceptance criteria.

**Independent Test**: Generate a PDF for a multi-course roadmap; verify section order, brand tokens,
diacritic rendering, and that both thresholds appear separately and verbatim.

**Acceptance criteria (EARS)**:
- AC-6.1 — THE SYSTEM SHALL render the PDF sections in this order: (1) Cover (student name, current
  → target band, total duration); (2) Timeline strip (visual course ladder); (3) Course-by-course
  cards; (4) Cam kết đầu ra & điều kiện; (5) Hệ sinh thái hỗ trợ; (6) Contact block.
- AC-6.2 — THE SYSTEM SHALL render the "Cam kết đầu ra & điều kiện" section with BOTH thresholds
  stated distinctly and verbatim — the completion certificate (≥ output band, attendance ≥ 90%,
  homework ≥ 90%) and the written output guarantee (homework ≥ 95%, ≤ 1 absence) — never merged.
- AC-6.3 — THE SYSTEM SHALL render all Vietnamese diacritics correctly with embedded brand fonts
  (Montserrat + Sansita) — a hard acceptance criterion.
- AC-6.4 — THE SYSTEM SHALL apply the brand palette (navy `#2B3A8C`, red `#D01F26`), a red footer bar
  reading "Jaxtina – IELTS Made SIMPLE", and the Jaxtina logo and mascot.
- AC-6.5 — THE SYSTEM SHALL include the "Hệ sinh thái hỗ trợ" section listing: LMS Tracking, AI
  Speaking Coach PRE(F)C, Thư viện số & E-book, Hệ thống bài kiểm tra định kì, CLB Speaking.
- AC-6.6 — THE SYSTEM SHALL render the contact block with the consultant's name/phone/email, the
  centre, and the company footer.
- AC-6.7 — THE SYSTEM SHALL populate each course card from the content store per that course's
  narrative shape (Booster/Achiever four-block; Foundation shape; Intensive shape).

### User Story 7 — Deliver to the student and log the roadmap (Priority: P1)

On approval, the student receives the PDF, and every generated roadmap is logged for the academic
team.

**Why P1**: "Every roadmap logged" is a stated success criterion; delivery is the point of the tool.

**Independent Test**: Approve a roadmap → the delivery path produces the PDF for the student and a
log record is written with the required fields.

**Acceptance criteria (EARS)**:
- AC-7.1 — WHEN the consultant approves and submits THE SYSTEM SHALL deliver the PDF to the student
  via the configured delivery adapter, with a Vietnamese-language accompanying message.
- AC-7.2 — WHEN a roadmap is generated THE SYSTEM SHALL log a record containing: timestamp,
  consultant, centre, student identity, entry band, target band, audience, the ordered course
  sequence, whether it was manually edited, and whether it was sent.
- AC-7.3 — THE SYSTEM SHALL route the send step through a single injectable `deliveryAdapter`
  interface so the delivery mechanism can change without touching the engine or the UI.
- AC-7.4 — THE SYSTEM SHALL confine each roadmap log record to the consultant's own centre
  (centre-narrow write) and permit broad read for oversight, per the foundation's tenancy model.

### Edge Cases

- **Target below current band** — IF target < current THEN THE SYSTEM SHALL refuse generation with a
  Vietnamese message (no roadmap produced). (AC-1.2)
- **Target equal to current band** — IF target = current THEN THE SYSTEM SHALL refuse generation
  (nothing to teach; not strictly greater). (AC-1.2)
- **Entry band above the top of the ladder** — IF the current band is at/above the highest entry
  rung such that no course applies (e.g. already ≥ 7.0 with target 8.0+) THEN THE SYSTEM SHALL
  produce only `INT` (exam prep) if eligible, or SHALL explain that no ladder course applies and
  recommend Intensive/consultation — never an empty or gapped roadmap.
- **Target 8.0+ (beyond A3 + Intensive)** — IF the target exceeds what `A3` (+ one `INT` +0.5) can
  reach THEN THE SYSTEM SHALL cap the ladder at `A3`, append `INT`, and surface a
  consultant-only note that the target exceeds the standard ladder's guaranteed reach (not in the
  student PDF).
- **Missing exam date** — WHEN no exam date is given THE SYSTEM SHALL still generate and compute a
  timeline, and SHALL skip the deadline feasibility check. (AC-4.3)
- **Grammar Pathway session count unknown** — WHILE the GP session count is a placeholder THE SYSTEM
  SHALL clearly mark GP's contribution as provisional in totals and flag it, never silently assuming
  a number.

---

## Requirements *(mandatory)*

### Functional Requirements

**Input & validation**
- **FR-INPUT-01**: The form MUST capture: student full name; audience segment (THCS / THPT / Sinh
  viên / Người đi làm / Mất gốc); student email; phone; current band; target band; exam purpose (Xét
  tuyển ĐH / Tốt nghiệp / Du học – học bổng / Chuẩn B2 / Khác); target exam date (optional);
  intensity (Tiêu chuẩn / Tăng cường); consultant name, phone, email; centre.
- **FR-INPUT-02**: The system MUST validate that target band > current band, email format is valid,
  and all required fields are present, before generation, with Vietnamese messages.
- **FR-INPUT-03**: Current and target band MUST be selects constrained to the ladder's band values;
  free-typed bands MUST be impossible.

**Engine**
- **FR-ENGINE-01** (no-skipping, NON-NEGOTIABLE): The engine MUST output the contiguous ladder slice
  from the entry-band course through the first course whose output ≥ target, with no rung skipped,
  and this MUST be enforced in the engine and covered by tests.
- **FR-ENGINE-02**: The engine MUST auto-append `INT` when target ≥ 5.5 and (an exam date is set OR
  target − final-course output ≤ 0.5).
- **FR-ENGINE-03**: The engine MUST apply audience overrides: "Mất gốc" starts at `PRE_S`; "THCS"
  inserts `GP` before `B1`.
- **FR-ENGINE-04**: The engine MUST compute total sessions, total weeks, total months, and projected
  completion date, using rate 2.7 (Standard) or the confirmed intensive rate.
- **FR-ENGINE-05**: The engine MUST be a pure, deterministic function of (request + course-ladder
  data), independently unit-testable without UI, DB, or network.
- **FR-ENGINE-06**: The deadline feasibility check MUST compare projected completion to the target
  exam date and produce an internal-only warning; the warning MUST be structurally excluded from all
  student-facing artifacts.

**Review & edit**
- **FR-EDIT-01**: The review screen MUST render identically to the student PDF layout.
- **FR-EDIT-02**: The consultant MUST be able to edit narrative blocks inline, add a "Ghi chú từ tư
  vấn viên", remove a course, and reorder courses.
- **FR-EDIT-03**: Removing or reordering MUST raise a non-blocking "departs from standard ladder"
  warning and MUST set the manual-edit flag on the logged record.

**PDF**
- **FR-PDF-01**: The PDF MUST render the six sections in the specified order.
- **FR-PDF-02**: The PDF MUST state both commitment thresholds distinctly and verbatim; they MUST
  never be merged or approximated (NON-NEGOTIABLE).
- **FR-PDF-03**: The PDF MUST render full Vietnamese diacritics with embedded brand fonts, apply the
  brand palette and footer bar, and include the logo and mascot — needing no manual post-editing.
- **FR-PDF-04**: The PDF MUST include the "Hệ sinh thái hỗ trợ" list and the contact block.
- **FR-PDF-05**: Course cards MUST be populated from the content store per each course's narrative
  shape.

**Delivery & logging**
- **FR-DELIVERY-01**: On approval, the system MUST deliver the PDF to the student with a
  Vietnamese-language message, via a single injectable `deliveryAdapter` interface.
- **FR-DELIVERY-02**: This slice MUST provide a default adapter (generate + download PDF + open a
  pre-filled mail draft) and MUST define the interface so a server-side email adapter can drop in
  later without engine/UI changes. (Real automated emailing is deferred — see Assumptions.)
- **FR-LOG-01**: Every generated roadmap MUST be logged with: timestamp, consultant, centre, student
  identity, entry/target band, audience, ordered course sequence, manual-edit flag, sent flag.
- **FR-LOG-02**: Roadmap log records MUST be centre-scoped (centre-narrow write, broad read) and MUST
  also emit the foundation's general audit-log entry on write.

**Content & localization**
- **FR-CONTENT-01**: The course ladder, per-course narrative copy, reference roadmaps, ecosystem
  list, and commitment-threshold text MUST live in dedicated, academic-team-editable content data
  (separate from engine and UI logic); editing copy MUST require no change to logic.
- **FR-CONTENT-02**: All student-facing and consultant-facing copy MUST be Vietnamese, resolved
  through the single vocabulary source for enum labels (bands, audiences, intensities, purposes).

**Access & foundation integration**
- **FR-ACCESS-01**: The page MUST be gated to `super_admin`, `centre_manager`, `centre_admin`,
  `sale_consultant` via a new permission key and one entry in the single nav/access matrix; a
  `teacher` MUST be denied.
- **FR-ACCESS-02**: Generation and submission MUST flow through the canonical mutation pipeline
  (`withError → assertPermission → schema.parse → service`).

### Key Entities *(include if feature involves data)*

- **Course** (content data): `code`, `name`, `entryBand`, `outputBand`, `sessions`, `narrative`
  (shape varies by course family), optional-insert/append flags. The ladder is an ordered list of
  these.
- **RoadmapRequest** (input): student name/email/phone, audience, current band, target band, exam
  purpose, optional exam date, intensity, consultant name/phone/email, centre.
- **Roadmap** (engine output): the ordered course sequence, per-course session counts, total
  sessions/weeks/months, projected completion date, the internal-only deadline-feasibility warning,
  and any manual edits/note.
- **RoadmapRecord** (persisted audit log; tenant-scoped): timestamp, consultantId, centreId, student
  identity (name/email/phone), entryBand, targetBand, audience, courseSequence (codes, in order),
  manualEdited (bool), sent (bool). Broad read; centre-narrow write.
- **DeliveryResult**: outcome of the delivery adapter (delivered / drafted / failed) feeding the
  `sent` flag.

---

## Success Criteria *(mandatory)*

### Measurable outcomes
- **SC-001**: A consultant completes blank-form → deliverable PDF in **under 3 minutes** (measured
  end-to-end on a centre laptop).
- **SC-002**: **100%** of generated roadmaps are contiguous ladder slices with **zero** level-skips,
  across all entry/target pairs — verified by exhaustive engine tests.
- **SC-003**: For each of the six reference audiences at its reference entry/target, total duration
  falls within the audience's stated range (or a documented divergence exists).
- **SC-004**: The produced PDF requires **no** manual editing in another tool and renders **100%** of
  Vietnamese diacritics correctly.
- **SC-005**: **100%** of generated roadmaps are logged with all required fields.
- **SC-006**: The deadline feasibility warning appears in **0%** of student-facing PDFs (structurally
  impossible), verified by test.
- **SC-007**: Both commitment thresholds appear **distinctly** in **100%** of PDFs; **0%** conflate
  them — verified by test.
- **SC-008**: A `teacher` is denied page access **100%** of the time; the four operational roles are
  granted — verified against the real permission gate.

### Quality bar
- **SC-009**: Automated coverage of the engine (ladder slicing, append, overrides, timeline) and the
  tenancy/permission boundaries is **≥ 80%**; the no-skipping invariant is exhaustively tested.
- **SC-010**: No consultant- or student-facing screen displays a raw enum id or an English system
  string; all copy is Vietnamese via the content/vocabulary stores.

---

## Open Decisions (blocking — to be resolved in plan.md / with academic team)

These are surfaced here (not silently chosen). The requirements above are written against the
**recommended default** so the spec is internally consistent; the alternative is noted.

1. **Achiever 3 policy** (BLOCKING; affects engine output at target = 6.5). The deck is ambiguous
   (ladder slide shows A1 as 5.5–6.0+, but the THPT reference path reaches 6.5–7.5+ via A3). Options:
   - **(i)** A3 optional — auto-included only when target ≥ 6.5.
   - **(ii)** A3 standard for any target ≥ 6.5.
   - **Recommended default (pending):** **(i)** — treat A3 as an included-but-removable rung when
     target ≥ 6.5, consistent with the "(A3)" parenthetical in the THCS/THPT reference paths and
     with the no-skipping rule. **Requires academic-team confirmation.**
2. **Grammar Pathway session count** — not in the source deck. **Open question for academic team;**
   a clearly-marked placeholder is used and GP's contribution to totals is flagged provisional.
3. **Intensive ("Tăng cường") rate** — proposed **4 sessions/week**; **flagged for confirmation.**
4. **PDF rendering approach** (design/plan): must guarantee Vietnamese diacritics + embedded brand
   fonts; library choice and justification belong in plan.md.
5. **Offline capability** (design/plan): centres may have unreliable connectivity; plan.md must
   state whether/how the tool works offline and how that constrains the PDF/delivery approach.
6. **Delivery architecture** (design/plan): the brief's A (static/no-backend) vs B (Apps Script) is
   largely moot here — it is a page in the existing Next.js + Supabase app; the live decision is the
   default `deliveryAdapter` implementation and when server-side email lands.

---

## Assumptions

- **Built into jax-sales** (not standalone): a page in the existing Next.js 16 + Supabase app, on the
  slice-#001 foundation. The brief's static-HTML-vs-Apps-Script delivery question is therefore
  reframed as a `deliveryAdapter` choice; PDF generation and logging happen server-side.
- **Email deferred**: this slice generates + logs + downloads the PDF and opens a pre-filled mail
  draft; the `deliveryAdapter` interface is defined so real server-side email (a mail provider) drops
  in later without engine/UI change. The <3-minute criterion is met via the download + draft flow.
- **Student data is typed input** for this slice (no link to a Lead/Student record yet — the
  leads/students slices are not built). `RoadmapRequest` is structured so it can later reference a
  Lead/Student without rework.
- **Content store editability**: the exact mechanism (a TS content module vs a DB-backed table the
  academic team edits) is a plan decision; the requirement is only that copy is data, separate from
  logic, and editable without touching engine/UI.
- **Recommended defaults** for the blocking open decisions (A3 = option (i), intensive = 4/week, GP
  = provisional placeholder) are used so the spec is testable now; they are confirmed in plan.
- **Band arithmetic** treats `~A1`/`below A1` as ordered pseudo-bands below `2.5` for slicing; the
  numeric target/output comparisons use the ordered band scale defined above.

## Dependencies

- Slice #001 foundation: auth + `sale_consultant` role, centre tenancy + RLS pattern, the audit-log
  seam (FR-024g), the permission registry (FR-024a), the nav/access matrix (FR-024b), and the single
  vocabulary source (FR-024).
- The official IELTS 2026 programme deck (course ladder, narrative copy, reference roadmaps,
  ecosystem, thresholds) as the content source of truth.
- Academic-team confirmations for the three blocking open decisions before the affected engine paths
  are finalised.
