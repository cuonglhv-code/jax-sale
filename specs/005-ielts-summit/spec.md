# Feature Specification: Jaxtina IELTS Summit

**Feature Branch**: `005-ielts-summit`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Build the Jaxtina IELTS Summit — a tool used by sales consultants
at Jaxtina English Group during a face-to-face consultation with a prospective student and their
parent. It does two jobs in one continuous motion: PRESENT — walk the family up a mountain from
current band to target band; SEND — at the summit, produce a branded PDF of that exact roadmap
and email it to the student. The presentation becomes the document. There is no second tool."

## Clarifications

### Session 2026-07-17

- Q: What happens for students already at/near the ladder top (e.g. 7.0 → 7.5), and for
  targets beyond A3 + Intensive reach? → A: INT-only climb is valid when current ≥ 5.5 and
  target ≤ current + 0.5; out-of-reach targets render the highest honest climb plus a
  consultant-facing advisory — never a silent empty mountain, never an inflated promise.
- Q: Where does each tier's session composition (e.g. 24 buổi = 20 chính + 2 ôn tập + Midterm
  + Final) render? → A: In the expanded stage detail on screen AND on each PDF course card —
  it answers "24 buổi gồm những gì?" in the room and in the document the family keeps.
- Q: Does Mode A record the placement test date? → A: Optional — Mode A works without a date
  (three-input opening preserved); when known, the date is recorded and appears in the send
  archive metadata for audit context.
- Q: How wide is the displayed duration range? → A: Computed at 2.4–3.0 effective
  sessions/week (±~10% around the 2.7 nominal); the rate constants live in content data
  marked provisional pending academic confirmation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Present the Climb (Priority: P1)

A consultant opens the tool on a laptop, turns the screen toward a student and parent, enters the
student's name, current band, and target band, and walks the family up a mountain rendered bottom
to top: this is where you are, this is where you're going, these are the stages between, this is
what it costs. The stretch between current and target illuminates; stages below recede dimmed;
stages above recede but stay visible. Opening a stage reveals its narrative and price and
collapses the others. A summary surfaces total buổi, duration range, projected finish, and total
price. When the parent asks "what if we aimed for 7.0?", the consultant changes the target
mid-sentence and the mountain responds instantly.

**Why this priority**: This is the product's reason to exist — the persuasive live presentation.
Without it nothing else has value; with it alone, a consultant already conducts a better
consultation even if sending is manual.

**Independent Test**: With ladder and narrative data loaded and the network disabled, a
consultant can set bands, see the correct illuminated slice, expand every stage one at a time,
and read a correct summary — deliverable and demonstrable without any send capability.

**Acceptance Scenarios**:

1. **Given** a blank consultation, **When** the consultant sets current band 4.5 and target 7.0,
   **Then** the mountain illuminates exactly Booster 2 → Achiever 1 → Achiever 2 → Achiever 3
   plus auto-appended Luyện đề Intensive, with no level skipped, and the summary shows the total
   buổi, a duration range, a projected finish window, and the total price of exactly those
   stages.
2. **Given** an illuminated climb, **When** the consultant opens a stage, **Then** that stage's
   narrative blocks and per-stage price are revealed, all other stages collapse, and the climb
   remains visible as context.
3. **Given** an open consultation, **When** the consultant changes the target band, **Then** the
   mountain re-illuminates and the summary recalculates with no other action required, and every
   prior state remains reachable in one action.
4. **Given** a first-time viewer three seconds in front of the default view, **When** they glance
   at the screen, **Then** they can identify a mountain, its stages, and the highlighted
   here-to-there stretch without any interaction.
5. **Given** the tool is running with no network connection, **When** the consultant performs the
   entire presentation, **Then** every view, expansion, and recalculation works identically to
   the connected case.

---

### User Story 2 - Distinguish Measured from Provisional (Priority: P2)

Placement determines the start of the climb. In Mode A (placement test complete) the consultant
presents a measured result: the starting point is evidence, the climb is a plan. In Mode B (not
yet tested) the consultant presents a hypothetical climb from an estimated start: the starting
marker carries a distinct, unmissable provisional treatment; copy names it "Lộ trình dự kiến —
cần xác nhận bằng kết quả test đầu vào"; duration and price are framed as estimates; and a clear
call to action offers to book the placement test.

**Why this priority**: The programme's own material requires placement from a measured result. A
hypothetical climb that looks identical to a measured one is a promise the organisation has not
earned (Constitution Principle III). This gates trust in everything Story 1 presents.

**Independent Test**: Create one consultation in each mode with identical bands; verify the two
renderings are visibly distinct at a glance, that Mode B carries the named caveat copy and
placement-test call to action, and that no path exists to produce a confirmed-looking output from
Mode B.

**Acceptance Scenarios**:

1. **Given** Mode B is selected, **When** the mountain renders, **Then** the starting marker uses
   the distinct provisional treatment, the caveat copy is visible without interaction, and
   duration and price are presented as estimates.
2. **Given** a Mode B consultation, **When** any document is produced from it, **Then** the
   provisional caveat appears prominently on the document's cover, and there is no user action
   that yields a document without it.
3. **Given** a Mode B consultation, **When** the consultant records an actual placement result,
   **Then** the consultation becomes Mode A and the provisional treatment disappears everywhere
   at once.

---

### User Story 3 - Send the Summit Document (Priority: P3)

At the summit, the same screen produces a branded PDF of exactly the roadmap that was presented
and emails it to the student. The consultant first reviews the roadmap as the family will receive
it, edits any narrative block inline, adds a free-text "Ghi chú từ tư vấn viên", may remove or
reorder courses (with a warning that the result departs from the standard ladder), captures
student and consultant contact details, sends, and then resets to a fresh state for the next
appointment with one obvious action.

**Why this priority**: Sending closes the loop — the family leaves with the exact artifact they
saw. It depends on Stories 1–2 existing but is independently testable as a pipeline from a
prepared consultation to a delivered document.

**Independent Test**: From a prepared consultation, run review → edit → capture → PDF → send →
reset end to end; verify the PDF matches the presented roadmap section for section, that a
simulated delivery failure is loud and loses nothing, and that reset produces a clean state.

**Acceptance Scenarios**:

1. **Given** a presented roadmap, **When** the consultant enters review, **Then** the document
   preview shows exactly what will be sent, every narrative block is editable inline, and the
   "Ghi chú từ tư vấn viên" field sits above the courses.
2. **Given** a consultant removes or reorders a course in review, **When** the change is applied,
   **Then** a warning states the result departs from the standard ladder, and the change never
   introduces a silently skipped level into an unedited roadmap.
3. **Given** capture is complete, **When** the PDF is produced, **Then** it contains, in order:
   cover (student name, current → target band, total duration, provisional caveat if Mode B);
   timeline of the climb; course-by-course cards with narrative, session composition, and
   price; Cam kết đầu ra & điều
   kiện; Hệ sinh thái hỗ trợ; contact block — and its content is identical to the reviewed
   presentation.
4. **Given** the PDF is ready and the network is down, **When** the consultant attempts to send,
   **Then** the failure is immediately and unmistakably visible, the prepared document and all
   entered data are preserved, and the send can be retried without re-entering anything.
5. **Given** a completed appointment, **When** the consultant triggers reset, **Then** the tool
   returns to a blank consultation in one action and no prior student's details remain visible.

---

### User Story 4 - Proof at the Summit (Priority: P4)

The summit carries real student results, band scores, and testimonials — proof the climb works.
Proof is matched to the presented journey: a family looking at a 4.5 → 7.0 climb sees a student
who made that climb. Only students with confirmed written consent on file can ever appear.

**Why this priority**: Matched proof is likely the highest-leverage persuasive element, but the
presentation and document stand without it, so it lands after the core flow.

**Independent Test**: Load proof records with varied consent status and band journeys; verify
that unconsented records cannot be rendered by any path, and that the summit surfaces proof
matching the presented journey, falling back gracefully when no match exists.

**Acceptance Scenarios**:

1. **Given** proof records exist without confirmed consent, **When** any summit view or document
   renders, **Then** those records are structurally absent — no name, photo, score, or quote —
   with no consultant-facing override.
2. **Given** a presented 4.5 → 7.0 climb and a consented record of that same journey, **When**
   the summit renders, **Then** that record is surfaced ahead of generic proof.
3. **Given** no consented record matches the presented journey, **When** the summit renders,
   **Then** the nearest consented proof appears with no misleading claim that it matches the
   family's exact climb.

---

### User Story 5 - Secondary Content in One Action (Priority: P5)

Available but never in the way: Hệ sinh thái hỗ trợ học tập (the equipment for the climb), Cam
kết đầu ra & điều kiện (the written guarantee and its conditions), and Câu hỏi thường gặp
(objection handling). When a parent raises a doubt, the consultant reaches the right answer in
one action — not by scrolling a list.

**Why this priority**: Supports the conversation but does not carry it. The guarantee content
itself already appears in the PDF (Story 3); this story is about live-consultation access.

**Independent Test**: From any presentation state, verify each secondary content area opens in
one action, displays the exact canonical threshold copy for the two commitments, and returns to
the prior presentation state in one action.

**Acceptance Scenarios**:

1. **Given** any presentation state, **When** the consultant invokes a secondary content area,
   **Then** it opens in one action and the prior state is restored in one action afterwards.
2. **Given** the Cam kết đầu ra & điều kiện view, **When** it renders anywhere (screen or
   document), **Then** it states both thresholds exactly: Chứng nhận hoàn thành khóa học —
   Overall ≥ level output band AND attendance ≥ 90% AND homework ≥ 90%; Cam kết đầu ra bằng văn
   bản — homework ≥ 95% AND absence ≤ 1 buổi/khóa — never merged, rounded, or simplified.
3. **Given** a parent raises a known objection, **When** the consultant opens Câu hỏi thường
   gặp, **Then** the relevant answer is reachable in a single action (e.g. direct choice), not by
   scanning an undifferentiated list.

---

### Edge Cases

- Current band ≥ target band: the tool must refuse to render an empty or downhill climb and
  prompt the consultant to adjust, without losing entered data.
- Entry below A1: Pre-S renders as the base of the mountain and joins the climb; it is the only
  stage without a fixed buổi count, so summary math must handle it explicitly.
- Target ≥ 5.5 with the gap to the final course's output ≤ 0.5: Luyện đề Intensive is appended
  exactly once; an INT-only climb (current ≥ 5.5, target ≤ current + 0.5, e.g. 7.0 → 7.5)
  renders as a valid one-stage climb.
- Target beyond A3 + Intensive reach (e.g. 8.0+): highest honest climb renders with a
  consultant-facing advisory; the mountain never appears empty and never claims the target.
- Delivery failure mid-appointment: the failure is loud, the work is preserved, retry needs no
  re-entry (Constitution Principle V).
- Full offline appointment: everything except the send step works; the prepared document
  survives until connectivity returns.
- Consultant edits in review: removals/reorders warn about departing from the standard ladder;
  the generator itself can never produce a skipped level (Constitution Principle II).
- Vietnamese diacritics: full diacritic rendering at every weight and size actually used, on
  screen and in the PDF — a hard acceptance criterion.
- Mid-presentation target change after stages were expanded: expanded state collapses cleanly;
  no stale narrative from the previous slice remains visible.
- Reset with unsent work: reset must warn before discarding a prepared-but-unsent document.

## Requirements *(mandatory)*

### Functional Requirements

**Ladder & generation**

- **FR-001**: The system MUST hold the course ladder as canonical data, rendered bottom to top:
  Pre-S (below A1 → ~A1, no fixed buổi); IELTS Foundation 1 (~A1 → 2.5, 24 buổi); IELTS
  Foundation 2 (2.5 → 3.5, 24 buổi); Booster 1 (3.5 → 4.5, 28 buổi); Booster 2 (4.5 → 5.5, 28
  buổi); Achiever 1 (5.5 → 6.0, 28 buổi); Achiever 2 (6.0 → 6.5, 28 buổi); Achiever 3 (6.5 →
  7.0, 28 buổi); Luyện đề Intensive (5.5+ → +0.5 overall, 16 buổi) — including each tier's
  session composition (Foundation: 20 chính + 2 ôn tập + Midterm + Final; Booster: 24 chính + 2
  ôn tập + Midterm + Final; Achiever: 24 chính + 2 Mock tests + Midterm actual + Final actual).
- **FR-002**: Roadmap generation MUST slice the ladder contiguously from the course matching the
  entry band through the course whose output band meets the target. The generator MUST be
  incapable of producing a roadmap with a skipped level, and this MUST be covered by automated
  tests.
- **FR-003**: Generation MUST auto-append Luyện đề Intensive when target ≥ 5.5 and (target −
  final course output band) ≤ 0.5. When no rung applies but current ≥ 5.5 and target ≤ current
  + 0.5, the climb is Luyện đề Intensive alone — a valid one-stage climb, never an error. When
  the target exceeds what A3 + Intensive can honestly reach, the system renders the highest
  honest climb and a consultant-facing advisory recommending direct consultation; it MUST NOT
  render an empty mountain or imply the out-of-reach target is covered.
- **FR-004**: The timeline MUST be computed as: 2 hours per session, 3 sessions per week, ~2.7
  effective sessions per week (holidays and make-ups); weeks = sessions ÷ 2.7; months = weeks ÷
  4.33 — and MUST always be presented as a range, never false precision. The displayed range
  spans the 2.4–3.0 effective-sessions/week pace band; these rate constants are content data
  marked provisional pending academic confirmation.

**Presentation**

- **FR-005**: The mountain MUST read bottom to top at all times; no view, animation, or document
  may invert the direction of the climb (Constitution Principle I).
- **FR-006**: Setting current and target bands MUST illuminate the stretch between them; stages
  below MUST recede dimmed but visible; stages above MUST recede but remain reachable.
- **FR-007**: A summary MUST surface total buổi, duration range, projected finish, and total
  price for the illuminated climb; the student's name MUST appear on the presentation.
- **FR-008**: Exactly one stage may be expanded at a time; opening a stage MUST collapse the
  others.
- **FR-009**: Stage detail MUST follow the tier's narrative shape — Booster/Achiever: "Học viên
  bắt đầu ở đâu?", "Nút thắt thật sự" (given visual weight as the emotional hook), "Khóa học
  giải quyết như thế nào?" with a three-row progression table (Listening/Reading, Writing,
  Speaking; each row carrying "Progression cốt lõi" and "Cách hiểu đơn giản"), "Sau khóa học,
  học viên thay đổi như thế nào?"; Foundation 1–2: "Bạn sẽ học gì?" (Nghe & Đọc / Viết & Nói /
  Từ vựng / Ngữ pháp) and "Mục tiêu khóa học"; Luyện đề Intensive: "Đối tượng", "Mục tiêu khóa
  học", and three columns NÓI / VIẾT / CHIẾN LƯỢC THI. Every expanded stage also shows its
  session composition from the canonical ladder data (FR-001).
- **FR-010**: Every presentation state MUST be reachable in one action from every other state —
  no wizards, no forced linearity; changing the target mid-conversation MUST re-render
  immediately.
- **FR-011**: Nothing may autoplay; nothing may emit sound by default; no transition may gate
  the consultant's next action or utterance (Constitution Principle VI).

**Modes**

- **FR-012**: Every consultation MUST be in exactly one of two modes: Mode A (measured placement
  result) or Mode B (estimated start). The mode MUST be part of the roadmap's data, not merely
  its styling. Mode A MAY carry an optional placement-test date; when present it is recorded in
  the send archive metadata. The date is never required to present.
- **FR-013**: In Mode B, the starting marker MUST carry a distinct, unmissable provisional
  treatment; the copy "Lộ trình dự kiến — cần xác nhận bằng kết quả test đầu vào" MUST be
  visible; duration and price MUST be framed as estimates; and a call to action to book the
  placement test MUST be presented.
- **FR-014**: It MUST be structurally impossible to produce any on-screen or document output
  from a Mode B consultation that reads as confirmed; the provisional caveat MUST appear
  prominently on the PDF cover (Constitution Principle III).

**Price**

- **FR-015**: Price MUST display per-stage when a stage expands and as a total for the
  illuminated climb in the summary; price MUST live in content data structured to support
  per-centre variation.
- **FR-016**: Total price MUST be the arithmetic sum of the illuminated stages' prices from
  the centre's price list — nothing more. Promotions, package discounts, bundle pricing, and
  payment schedules are out of scope for v1 and MUST NOT appear on screen or in the document.

**Proof**

- **FR-017**: Proof material (name, photo, band score, words of a real student) MUST be
  renderable only for records whose written consent is recorded as confirmed; unconsented
  records MUST be structurally unrenderable with no presentation-layer override (Constitution
  Principle IX).
- **FR-018**: Proof records MUST carry their band journey (start → result) so the summit can
  surface proof matched to the presented climb, with graceful fallback to nearest consented
  proof when no exact match exists.

**Handoff, document & send**

- **FR-019**: Review MUST show the roadmap exactly as the family will receive it; every
  narrative block MUST be editable inline; a free-text "Ghi chú từ tư vấn viên" MUST sit above
  the courses; courses MAY be removed or reordered only with a warning that the result departs
  from the standard ladder.
- **FR-020**: Capture MUST collect student name, email, phone; consultant name, phone, email.
  The centre is recorded from the consultant's verified session — never entered or editable at
  capture time.
- **FR-021**: The PDF MUST contain, in order: (1) cover — student name, current → target band,
  total duration, provisional caveat if Mode B; (2) timeline — the climb, rendered; (3)
  course-by-course cards — narrative, session composition, and price; (4) Cam kết đầu ra &
  điều kiện; (5) Hệ sinh
  thái hỗ trợ — LMS Tracking, AI Speaking Coach (mô hình PRE(F)C), Thư viện số & E-book độc
  quyền, Hệ thống bài kiểm tra định kì, CLB Speaking miễn phí; (6) contact — consultant
  name/phone/email, centre, company footer.
- **FR-022**: The sent document MUST be provably identical in content to the reviewed
  presentation — one source produces both.
- **FR-023**: Presentation and document generation MUST work fully offline; only the send step
  may require a network; a failed send MUST fail loudly and preserve the prepared document and
  all entered data for retry (Constitution Principle V).
- **FR-024**: A single obvious reset action MUST clear the consultation to a fresh state; reset
  MUST warn if a prepared document has not been sent; no prior student's details may remain
  visible after reset.
- **FR-025**: Every sent roadmap MUST be archived: the exact PDF as delivered, plus metadata —
  consultant, centre, date, mode (A/B), current and target bands, total price, and whether the
  standard ladder was manually edited. The academic team MUST be able to review this archive to
  audit what is being promised to families. Archiving rides on the send step (which already
  requires a network) and MUST NOT add any network dependency to the presentation path; if
  archiving fails, the failure is loud and the document is preserved for retry (FR-023).

**Commitments**

- **FR-026**: The two commitment thresholds MUST live in one canonical data definition read by
  every surface, stated exactly and never merged, rounded, or simplified: Chứng nhận hoàn thành
  khóa học — Overall ≥ level output band AND attendance ≥ 90% AND homework completion ≥ 90%;
  Cam kết đầu ra bằng văn bản — homework completion ≥ 95% AND absence ≤ 1 buổi/khóa
  (Constitution Principle IV).

**Content & brand**

- **FR-027**: All Vietnamese copy, course narrative, pricing, proof material, FAQ, ecosystem
  and commitment content MUST live in editable data files maintainable by academic/marketing
  staff without touching layout or logic; any inline user-facing string is a defect
  (Constitution Principle VII).
- **FR-028**: Visual identity MUST use Jaxtina's brand — navy #2B3A8C primary, red #D01F26
  accent, Montserrat body/headings, Sansita tagline lockup "Jaxtina – IELTS Made SIMPLE",
  Jaxtina logo, and the schoolgirl mascot used deliberately as a climber, not decoratively. The
  product MUST NOT reproduce any element of the VTV programme "Đường lên đỉnh Olympia" — logo,
  laurel, colours, stage design, music, or name; the word "Olympia" MUST NOT appear in any copy
  (Constitution Principle VIII).
- **FR-029**: All UI copy MUST be Vietnamese with full diacritic rendering at every weight and
  size actually used, on screen and in the PDF.
- **FR-030**: The opening MUST require exactly three inputs — student name, current band,
  target band (plus the Mode A/B distinction). The six learner profiles (mất gốc, THCS, THPT,
  sinh viên, người đi làm, muốn bứt phá) and their reference paths are out of scope for v1 and
  MUST NOT appear in the opening flow.

### Key Entities

- **Course Ladder**: The canonical, ordered ladder of nine rungs with band ranges, buổi counts,
  session composition per tier, and per-tier narrative shape. Authoritative data, not code.
- **Stage Narrative**: The tier-shaped narrative blocks for each course, including the
  progression table rows for Booster/Achiever. Supplied by academic team; placeholder copy of
  realistic length until then.
- **Consultation / Roadmap**: One family's climb — student name, current band, target band, mode
  (A measured / B provisional), the generated contiguous slice, consultant edits and Ghi chú,
  summary figures, capture details, send status. The single source rendered as both screen and
  PDF.
- **Price Data**: Per-stage prices structured for per-centre variation; totals derived, never
  stored independently of their stages.
- **Commitment Terms**: The two thresholds as one canonical definition (see FR-026).
- **Proof Record**: A real student's result — name, photo, scores, testimonial, band journey
  (start → result), and consent status; renderable only when consent is confirmed.
- **Secondary Content**: Hệ sinh thái hỗ trợ items, Cam kết đầu ra & điều kiện copy, FAQ entries
  keyed for one-action retrieval.
- **Sent Roadmap Archive**: The record of every send — exact delivered PDF plus consultant,
  centre, date, mode, bands, total price, ladder-edited flag — reviewable by the academic team.
- **Centre & Consultant**: The presenting centre and consultant identity captured into the
  document's contact block.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A consultant goes from blank screen to sent PDF within a single appointment, with
  no step requiring them to leave the tool or re-enter previously entered information.
- **SC-002**: A first-time viewer glancing at the screen for three seconds can state the shape
  of the journey: a mountain, its stages, and the highlighted here-to-there stretch.
- **SC-003**: For any consultation, the roadmap presented and the roadmap emailed are provably
  identical in content — verified by comparison for every generated document.
- **SC-004**: Zero generated roadmaps contain a skipped level, across every band combination the
  ladder admits (verified exhaustively by automated tests).
- **SC-005**: The two commitment thresholds render exactly as canonically defined in 100% of
  surfaces (screen, PDF) — no merged, rounded, or simplified statement anywhere.
- **SC-006**: With the network disabled for the entire session, 100% of presentation and
  document-generation functionality works; a send attempted offline fails visibly and loses
  nothing.
- **SC-007**: Every Mode B output — screen and document — is identifiably provisional at a
  glance; no Mode B artifact exists that reads as confirmed.
- **SC-008**: From any presentation state, any other state (stage, summary, secondary content,
  review) is reachable in one action; no transition forces the consultant to wait before
  speaking or acting.
- **SC-009**: Academic/marketing staff can change any copy, price, or proof item by editing data
  files alone, with zero layout or logic changes.

## Assumptions

- **Price varies by centre structurally**: price data is structured per-centre; the consultation
  uses its centre's price list. Whether lists actually differ today is a data question and does
  not change the product.
- **Price is always visible**: no consultant-facing toggle to hide prices in v1; a consultant
  who does not wish to dwell on price simply does not expand it.
- **Consent is a data prerequisite, not a workflow**: this feature renders only
  confirmed-consent proof records (FR-017); collecting and recording consent is an operational
  process outside this feature. If no consented record exists, the summit shows no real-student
  proof rather than weakening the rule.
- **Proof matching is required with fallback**: proof records are tagged with band journeys
  (FR-018); when no exact match exists, nearest consented proof appears without claiming to
  match the family's exact climb.
- **"Olympia" never appears**: resolved by Constitution Principle VIII — the word, name, logo,
  and all associated identity elements are prohibited outright.
- **Pre-S is the mountain's base, shown when relevant**: it joins the climb only when the entry
  band is below A1. The Grammar Pathway side programme is out of scope for v1.
- **Real narrative copy arrives later**: build with placeholder text of realistic length so
  layout is honest; the content data layer (FR-027) makes the swap a data edit.
- **Email is the only delivery channel in v1**: no chat/print/QR delivery; printing the PDF
  manually remains possible outside the tool.
- **Laptop-only, consultant-only** (Constitution Scope Boundary): no student self-service, no
  parent portal, no phone experience; design decisions never compromise the across-the-desk
  case.
- **The send-archive review surface is internal operations tooling** (academic team), not a
  presentation surface; it sits outside the sole-user clause without compromising the primary
  across-the-desk case. All presentation surfaces remain consultant-only.
- **One consultation at a time per machine**: the tool models a single active consultation;
  the send archive (FR-025) is the system of record — there is no local consultation history
  or multi-session management beyond reset.
