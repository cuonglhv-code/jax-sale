# Feature Specification: HR Requests Module

**Feature Branch**: `004-hr-requests`

**Created**: 2026-07-16

**Status**: Draft — requirements artifact (review gate 1 of 3: spec → plan → tasks)

**Input**: User brief (2026-07-16, delivered by interview) — a lightweight internal
request-and-approval system for Jaxtina English Group. Employees submit HR forms from phone or
laptop; centre managers approve or reject; every decision is recorded with an immutable audit trail.
Built as **slice #004 of jax-sales**: new pages under the reserved `personnel` (`/nhan-su`) area of
the existing Next.js + Supabase app, on the slice-#001 foundation (auth, the five-role model, centre
tenancy, the audit seam, the single vocabulary / nav-access-matrix seams, the canonical mutation
pipeline).

**Scope discipline:** This is deliberately **not** a full HRIS. No payroll, performance reviews,
recruitment, contracts, attendance, or scheduling system. It handles exactly: *someone needs
permission for something, a manager grants or denies it, and the decision is recorded and actioned.*

---

## Overview

The **HR Requests module** lets any Jaxtina employee — mostly teachers and staff on a phone between
classes — submit one of nine HR forms in under a minute, and lets the centre manager approve or
reject everything awaiting their decision from a single screen without opening a second system. All
nine forms run through **one shared submission → approval → notification → record engine**; they
differ only in payload, validation, and side effects. The module is the **system of record for annual
leave balance**, so statutory entitlement is never silently over-drawn, and it **detects at
submission time** when a teacher's leave collides with a class they teach — turning cover from a
post-approval scramble into part of the request. Every state transition is written to an immutable
audit trail.

**Why this slice:** operationally, Jaxtina's real pain is teacher leave colliding with scheduled
classes and annual-leave entitlement being tracked in scattered spreadsheets. This module closes both
gaps while reusing the foundation's tenancy, audit, permission-registry, and vocabulary seams — it
adds new capability without reworking the base.

**One engine, nine forms.** The brief's table is headed "seven form types" but lists nine rows
(purchase and business travel were added later; the money-form rules reference "forms 7, 8 and 9").
This spec treats it as **nine form types on one engine**. Forms 1–4 (annual, sick, personal, unpaid
leave) are one leave *family* sharing a date-range core with differing rules — never four unrelated
forms, and never merged into one legally-blurred "leave" type.

---

## Clarifications

### Session 2026-07-16

- Q: When an annual-leave request spans several days, which days count against the annual-leave balance? → A: Working days only, per an HR-configurable working-week (that week's non-working days plus configured public holidays are excluded); half-day = 0.5.
- Q: Can every employee submit every one of the nine form types, or is availability role/teaching-gated? → A: All nine forms are available to every employee (no role×form matrix); forms that depend on class sessions (shift-swap, and the leave cover step) are gated by validation — submittable only when the submitter actually teaches affected sessions — not hidden by role.
- Q: Who is eligible to be nominated as a covering teacher, and what if the nominee has their own conflict? → A: The cover pool is active teachers of the affected class's centre (same-centre only, matching the foundation's centre-confined writes); a nominee already teaching at that time is hard-blocked from nomination (they cannot cover), not merely flagged.
- Q: How long is medical documentation retained, and what triggers deletion? → A: Retain while the request record is live plus a configurable retention window (default = statutory record-keeping horizon, requires HR sign-off), then auto-purge. Retention period is an HR-editable config value.
- Q: Since balance is consumed at approval, when is the balance impact / over-balance status the manager acts on determined? → A: Recomputed fresh against the current balance at approval time; the submission-time warning is indicative only (guards SC-004 against out-of-order approvals).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit a leave request in under a minute (Priority: P1)

An employee opens the HR area on their phone, picks a form type, fills the dynamic form for that type
(for annual leave: date range, half/full day), sees their remaining annual-leave balance inline,
confirms, and the request is recorded as *pending* and routed to their centre's manager.

**Why this priority**: Submission is the entry point of the entire module; without it nothing else
has input. Getting one form type (annual leave) working end-to-end is the walking skeleton the other
eight forms generalise from.

**Independent Test**: Log in as a `teacher` or `sale_consultant`, submit an annual-leave request on a
narrow (phone-width) viewport, and confirm a pending request appears in the submitter's "My requests"
list and is visible to the centre manager — delivering a usable single-form request system on its own.

**Acceptance Scenarios**:

1. **Given** an authenticated employee with a positive leave balance, **When** they choose "Xin nghỉ
   phép năm", enter a valid future date range and confirm, **Then** the system records a *pending*
   request scoped to the submitter's centre and shows it in "My requests".
2. **Given** the form is open, **When** the annual-leave form renders, **Then** the employee sees
   their remaining balance inline ("Bạn còn X ngày phép") before submitting.
3. **Given** an invalid submission (end date before start date, empty required field), **When** they
   submit, **Then** the system rejects it with a Vietnamese field-level message and records nothing.
4. **Given** a submitter on a phone-width screen, **When** they complete the annual-leave form,
   **Then** the flow (pick type → fill → confirm) is completable without horizontal scrolling.

---

### User Story 2 - Approve or reject from one queue (Priority: P1)

A centre manager opens their approval queue and sees every request awaiting their decision, scoped to
their centre, sorted by urgency (leave starting soonest first), each row carrying enough context to
decide without opening anything else. They approve or reject; rejection requires a reason; the
decision is recorded immutably and the submitter is notified.

**Why this priority**: Approval is the other half of the walking skeleton — a request that cannot be
decided is inert. US1 + US2 together are the true MVP: one form type, submitted and decided, recorded.

**Independent Test**: As a `centre_manager`, open the queue with pending requests from own-centre
employees, approve one and reject one (with a reason), and confirm both leave the queue, the submitter
sees the new status, and each decision is auditable.

**Acceptance Scenarios**:

1. **Given** pending requests exist in the manager's centre, **When** the manager opens the queue,
   **Then** they see only own-centre requests, sorted with the soonest-starting leave first, each
   showing who/what/when, balance impact, and (if applicable) affected classes and proposed cover.
2. **Given** a pending request, **When** the manager approves it, **Then** its status becomes
   *approved*, the decision (actor, timestamp) is recorded, and the submitter is notified.
3. **Given** a pending request, **When** the manager rejects it, **Then** the system requires a
   non-empty reason before the rejection is accepted, records it, and notifies the submitter.
4. **Given** a request from another centre, **When** the manager views their queue, **Then** that
   request is never shown and cannot be acted on (enforced at the data layer, not just hidden).

---

### User Story 3 - Annual-leave balance ledger (Priority: P1)

The module calculates each employee's annual-leave entitlement (statutory baseline + seniority
accrual, pro-rated for mid-year joiners and by employment type), draws it down **on approval** (never
on submission), restores it on cancellation, and displays remaining balance at submission time. When
a request exceeds remaining balance the system **warns** and lets the manager decide (manager
discretion). The other three leave types are recorded and reportable but do **not** draw down this
balance.

**Why this priority**: "Annual leave entitlement is never silently over-drawn" is a core success
criterion, and consuming-on-approval (not submission) with safe concurrency is the invariant that
makes the ledger trustworthy. It underpins every leave form.

**Independent Test**: Approve an annual-leave request and confirm the balance decreases by exactly the
requested days; cancel it and confirm the balance is restored; submit two concurrent approvals that
together exceed the balance and confirm the balance is never driven below zero without an explicit
recorded manager override.

**Acceptance Scenarios**:

1. **Given** an employee with N remaining days, **When** an annual-leave request for D days is
   *approved*, **Then** the balance becomes N−D and the consumption is recorded; submission alone
   (before approval) never changes the balance.
2. **Given** an approved annual-leave request, **When** it is cancelled or withdrawn, **Then** the
   consumed days are restored to the balance.
3. **Given** a request for D days where D exceeds remaining balance, **When** the employee submits,
   **Then** the system shows an over-balance warning and still allows submission; the manager sees the
   negative impact and may approve (recorded as a discretionary over-draw) or reject.
4. **Given** a sick / personal / unpaid leave request, **When** it is approved, **Then** the
   annual-leave balance is unchanged, but the leave is recorded and appears in reports.
5. **Given** two managers approving two requests against the same balance simultaneously, **When**
   both commit, **Then** the balance reflects both consumptions correctly with no lost update (no
   double-spend).

---

### User Story 4 - Class-conflict detection and cover nomination (Priority: P2)

When a teacher submits leave that overlaps class sessions they teach, the system surfaces the affected
sessions at submission and requires the submitter to nominate a covering teacher. The nominated
teacher must **accept** before the manager can approve. At approval the manager sees the affected
sessions and the accepted cover and approves both together. The *đổi ca / dạy thay* (shift-swap) form
uses this same mechanism deliberately rather than as a consequence of leave.

**Why this priority**: This is the operational reason the module exists, but it depends on US1/US2
existing first and on a minimal class timetable that must be built as part of this module.

**Independent Test**: Create a minimal class schedule, submit leave overlapping a taught session,
confirm the conflict is surfaced and a cover nomination is required, have the nominee accept, and
confirm the manager can then approve the leave + cover as one decision.

**Acceptance Scenarios**:

1. **Given** a teacher with scheduled sessions in the requested date range, **When** they submit
   leave, **Then** the system lists the affected sessions and requires a nominated covering teacher
   before the request can be submitted.
2. **Given** a nominated covering teacher, **When** they are notified, **Then** they can accept or
   decline; the manager cannot approve until the nomination is accepted.
3. **Given** a proposed cover who already teaches at that time, **When** the nomination is attempted,
   **Then** the system blocks it (the double-booked nominee cannot cover) and the submitter must choose
   another teacher from the same centre.
4. **Given** an accepted cover, **When** the manager approves, **Then** the leave and the cover
   assignment are approved together as one recorded decision.
5. **Given** a shift-swap (đổi ca / dạy thay) request, **When** submitted, **Then** it uses the same
   cover-nomination-and-acceptance mechanism without an associated leave request.

---

### User Story 5 - The remaining form types on the same engine (Priority: P2)

All nine form types are available and run through the one engine: annual / sick / personal / unpaid
leave, shift-swap, overtime, salary advance, purchase request, business travel. Each has its own
payload and validation; sick and some personal-leave categories require a documentation attachment;
the three money forms (salary advance, purchase, business travel) notify accounting on approval.

**Why this priority**: Generalising to all nine is high value but must come after one form type works
end-to-end (get one right, then generalise — never nine parallel implementations).

**Independent Test**: Submit one request of each of the nine types, confirm each renders its correct
form fields and validation, routes to the manager, and on approval performs its correct side effect
(balance draw-down for annual only; accounting notification for the three money forms).

**Acceptance Scenarios**:

1. **Given** the form-type picker, **When** an employee selects any of the nine types, **Then** the
   correct type-specific form and validation are presented.
2. **Given** an overtime request, **When** it is submitted, **Then** date, hours and justification are
   captured and it routes for approval like any other form, with no leave-balance effect.
3. **Given** a salary-advance / purchase / business-travel request, **When** it is approved, **Then**
   accounting is notified for visibility, and the amount/cost is captured and reportable.
4. **Given** a personal-leave request whose statutory category requires documentation, **When** the
   employee submits without an attachment, **Then** the system requires the attachment before
   accepting.

---

### User Story 6 - Documentation upload with protected access (Priority: P2)

Sick leave and certain personal-leave categories require an attachment. Medical documentation is
sensitive: it is visible only to the approver and to HR (`super_admin` in v1), never to peers, and
must never appear in any list view, export, or notification email body.

**Why this priority**: Attachments are required for a legally-valid sick-leave request, and the
confidentiality guarantee is a hard constraint — but it layers onto the leave forms from US5.

**Independent Test**: Attach a document to a sick-leave request; confirm the approver and HR can open
it, a peer employee cannot, and it never appears in any list, export, or email body.

**Acceptance Scenarios**:

1. **Given** a sick-leave request, **When** the employee attaches a document of an accepted type
   within the size limit, **Then** it is stored and linked to the request.
2. **Given** an uploaded medical document, **When** a peer (non-approver, non-HR) tries to access it,
   **Then** access is denied at the data layer.
3. **Given** any list view, export, or notification email, **When** it renders a request that has a
   medical attachment, **Then** the attachment contents are never included — only, at most, an
   indicator that documentation exists.

---

### User Story 7 - Notifications (Priority: P3)

The relevant party is notified by email (Vietnamese) at each key transition: approver on submission,
submitter on decision, nominated teacher on cover nomination (with accept/decline), accounting on
approval of a money form. Approvers receive a periodic reminder of pending requests. No email body
ever contains medical documentation or attachment contents.

**Why this priority**: Notifications make the workflow usable in practice, but the module functions
(via the in-app queue and "My requests" views) without them; they are additive.

**Independent Test**: Trigger each transition and confirm the correct recipient receives a Vietnamese
notification, and that no notification body contains attachment contents.

**Acceptance Scenarios**:

1. **Given** a submitted request, **When** it is created, **Then** the approver is notified.
2. **Given** a decision (approve/reject), **When** it is recorded, **Then** the submitter is notified
   with the outcome and (for rejection) the reason.
3. **Given** a cover nomination, **When** it is made, **Then** the nominated teacher is notified with a
   way to accept or decline.
4. **Given** an approved money form, **When** the decision is recorded, **Then** accounting is
   notified.

---

### User Story 8 - Reporting (Priority: P3)

HR and managers can answer, without asking anyone: who is off next week and who is covering; leave
taken by employee / centre / period; requests by type and status; outstanding annual-leave balances.
Reports are exportable.

**Why this priority**: Reporting consumes the records the earlier stories produce; valuable to HR but
not required for the core submit-approve-record loop.

**Independent Test**: With a set of approved and pending requests, produce the "who is off next week
and who is covering" view and a leave-by-employee report, and export them.

**Acceptance Scenarios**:

1. **Given** approved leave and cover assignments, **When** HR opens the coverage view for a date
   range, **Then** they see who is off and who is covering each affected session.
2. **Given** requests across types and statuses, **When** a report is generated, **Then** it can be
   filtered by employee, centre, type, status and period, and exported.

---

### Edge Cases

- **Leave spanning a leave-year boundary**: a request straddling the leave-year end is attributed and
  drawn down per the balance rules of each year it touches; the balance display and consumption must
  not silently mis-attribute days.
- **Overlapping an existing approved request**: submitting leave that overlaps the submitter's own
  already-approved leave is flagged and prevented (or requires explicit resolution).
- **Past-date leave**: a request whose dates are in the past is flagged; retroactive requests are
  allowed only as an explicit, recorded action (e.g. recording sick leave after the fact).
- **Covering teacher declines after manager approval**: if a cover declines (or the class is later
  cancelled) after approval, the request is flagged for re-resolution and the manager/submitter are
  notified; the leave decision does not silently stand with broken cover.
- **Nobody accepts cover**: if no nominated teacher accepts, the request cannot progress to approval
  and the submitter must nominate an alternative.
- **Manager approving their own request**: self-approval is forbidden; a manager's own request routes
  to `super_admin`.
- **Submitter leaves the company while a request is pending**: a pending request from a now-inactive
  employee is surfaced and closed (auto-withdrawn/cancelled) rather than left actionable.
- **Class cancelled after cover was arranged**: the cover assignment for a cancelled session is
  released and flagged.
- **Concurrent approvals racing on the same balance**: two approvals against one balance must not
  double-spend it.
- **Half-day leave**: annual leave supports half-day granularity in both the balance draw-down and the
  conflict check.
- **Public holidays inside a date range**: public holidays within a leave range are not counted
  against the annual-leave balance (holiday calendar is configurable).

---

## Requirements *(mandatory)*

### Submission & form engine

- **FR-001**: The system MUST present a single form-type picker offering all nine request types to
  every employee, each labelled in Vietnamese, and render a dynamic, type-specific form once a type is
  chosen. Eligibility MUST NOT be a role×form matrix; forms that depend on class sessions (shift-swap,
  and the cover step of a leave request) MUST be gated by validation — submittable only when the
  submitter actually teaches affected sessions — never hidden by role.
- **FR-002**: The system MUST implement one shared submission → approval → notification → record
  pipeline, driven by per-type form definitions (payload fields, validation rules, side effects) —
  NOT nine parallel implementations.
- **FR-003**: The system MUST validate every submission at the server boundary against the selected
  type's rules and reject invalid input with Vietnamese messages, recording nothing on rejection.
- **FR-004**: The system MUST record an accepted submission as a *pending* request scoped to the
  submitter's centre, with the submitter, type, payload, and creation timestamp.
- **FR-005**: Forms MUST be usable on a phone-width viewport (mobile-first is a target, not a hard
  constraint), completing the pick → fill → confirm flow without horizontal scrolling.
- **FR-006**: The system MUST NOT provide draft-saving in v1 (a sub-minute form does not warrant it).

### Leave taxonomy & annual-leave balance ledger

- **FR-007**: The system MUST treat the four leave types (annual `nghỉ phép năm`, sick `nghỉ ốm`,
  personal `nghỉ việc riêng`, unpaid `nghỉ không lương`) as legally distinct and MUST NOT conflate or
  approximate them; only annual leave draws down the balance.
- **FR-008**: The system MUST be the system of record for each employee's annual-leave balance.
- **FR-009**: The system MUST calculate annual-leave entitlement as a statutory baseline plus seniority
  accrual, pro-rated for mid-year joiners and by employment type, using **configurable** values (see
  FR-030); it MUST NOT hardcode statutory figures.
- **FR-010**: The system MUST consume annual-leave balance **on approval**, never on submission, and
  MUST restore it on cancellation or withdrawal of an approved request.
- **FR-011**: The system MUST display the submitter's remaining annual-leave balance at submission
  time for leave forms.
- **FR-012**: When a request exceeds remaining annual-leave balance, the system MUST warn the
  submitter and still allow submission; the manager MUST see the negative impact and MAY approve (an
  over-draw recorded as a discretionary decision) or reject. The authoritative balance impact and
  over-balance determination MUST be recomputed against the **current** balance at approval time (the
  submission-time warning is indicative only), so out-of-order approvals cannot silently over-draw.
- **FR-013**: The system MUST ensure concurrent approvals against the same balance cannot double-spend
  it (no lost update).
- **FR-014**: Sick, personal and unpaid leave MUST be recorded and reportable but MUST NOT draw down
  the annual-leave balance.
- **FR-015**: The system MUST deduct only **working days** from the annual-leave balance, per an
  HR-configurable working-week (that week's non-working days are not counted), MUST exclude configured
  public holidays, and MUST support half-day granularity (0.5) in both balance draw-down and conflict
  detection.

### Class timetable & conflict detection

- **FR-016**: The system MUST provide a minimal class timetable — classes with course, centre,
  assigned teacher, recurring day/time pattern, and start/end date — sufficient to answer "which class
  sessions does this leave hit?", and MUST let an authorised admin create and edit it.
- **FR-017**: The system MUST resolve, from (teacher, date range), the affected class sessions, and
  MUST surface them to the submitter **at submission time** when leave overlaps sessions the submitter
  teaches.
- **FR-018**: When leave overlaps taught sessions, the system MUST require the submitter to nominate a
  covering teacher before the request can be submitted; the nominee MUST be an active teacher of the
  affected class's centre (the cover pool is same-centre only).
- **FR-019**: A nominated covering teacher MUST accept before the manager can approve; the system MUST
  support decline, and MUST require an alternative nomination if no one accepts.
- **FR-020**: The system MUST block nomination of a covering teacher who is already teaching at that
  time (a hard conflict — they cannot cover); this is distinct from the discretionary over-balance
  warning, because a double-booked teacher physically cannot provide cover.
- **FR-021**: The shift-swap (`đổi ca / dạy thay`) form MUST use the same cover-nomination-and-
  acceptance mechanism, standalone (not tied to a leave request).
- **FR-022**: If a cover declines after approval, or a covered session is cancelled, the system MUST
  flag the request for re-resolution and notify the affected parties.

### Approval, routing & lifecycle

- **FR-023**: All nine forms MUST route single-step from employee to the **centre manager of the
  submitter's centre**, derived from centre membership (no per-employee manager relationship is
  introduced).
- **FR-024**: The approval router MUST be designed so a second approval step can be added per form
  type or per amount **without redesign**, even though v1 is configured single-step.
- **FR-025**: The three money forms (salary advance, purchase, business travel) MUST notify accounting
  (`super_admin` in v1) on approval; v1 applies no spend threshold and no pre-approval finance gate.
- **FR-026**: The system MUST forbid self-approval; a centre manager's own request, and any request
  where the centre manager is unavailable, MUST route to `super_admin`.
- **FR-027**: Approval and rejection MUST both record the decision (actor, timestamp); rejection MUST
  require a non-empty reason.
- **FR-028**: The submitter MUST be able to cancel a pending request and to withdraw an already-
  approved request; withdrawal of an approved annual-leave request MUST restore consumed balance.
- **FR-029**: The manager's queue MUST show only requests scoped to their centre, sorted by urgency
  (soonest-starting leave first), each row carrying who, what, when, balance impact, affected
  sessions, proposed cover, and a documentation-present indicator — enough to decide without opening a
  second screen. The system MUST NOT provide bulk approval in v1 (it weakens the per-decision audit
  trail).

### Configuration (HR-editable, statutory)

- **FR-030**: Statutory and policy values — annual-leave baseline, seniority accrual rule, statutory
  event day-allowances, documentation thresholds, public-holiday calendar, working-week definition,
  leave-year boundary, notice period, part-time/contract accrual rules, carry-over policy,
  medical-document retention period — MUST live in an HR-admin-editable
  configuration store, NOT in code. The shipped figures are unverified starting points supplied by the
  requester and MUST be flagged as requiring HR/legal sign-off before launch.

### Documentation & sensitive-data protection

- **FR-031**: The system MUST support a documentation attachment on personal-leave categories that
  require it, restricting accepted file types and enforcing a size limit. Sick leave requires a
  free-text reason instead of a document attachment (superseded from the original "sick leave
  requires documentation" requirement — a typed explanation is the simplification adopted here).
- **FR-032**: Medical documentation MUST be access-controlled at the data layer — visible only to the
  request's approver and to HR (`super_admin` in v1), never to peers.
- **FR-033**: Medical documentation and attachment contents MUST NEVER appear in any list view,
  export, or notification email body (at most an indicator that documentation exists).
- **FR-033a**: The system MUST retain medical documentation only for a configurable retention period
  (default aligned to the statutory record-keeping horizon, requiring HR sign-off) measured from the
  point its request record is no longer live, and MUST auto-purge it thereafter. The retention period
  is an HR-editable configuration value (FR-030).
- **FR-034**: Salary-advance amounts and other sensitive money-form fields MUST be access-controlled at
  the data layer, not merely hidden in the UI.

### Notifications

- **FR-035**: The system MUST notify, in Vietnamese: the approver on submission; the submitter on
  decision (with the rejection reason where applicable); the nominated teacher on cover nomination
  (with accept/decline); accounting on approval of a money form.
- **FR-036**: The system MUST send approvers a periodic reminder of outstanding pending requests
  (cadence configurable).
- **FR-037**: No notification MUST ever include medical documentation or attachment contents.

### Reporting

- **FR-038**: The system MUST provide reports covering leave taken by employee / centre / period,
  requests by type and status, and outstanding annual-leave balances, all exportable.
- **FR-039**: The system MUST provide a coverage view answering "who is off in a given period and who
  is covering" without manual cross-referencing.

### Audit, roles & tenancy

- **FR-040**: Every state transition (submission, nomination, acceptance/decline, approval, rejection,
  cancellation, withdrawal, balance consumption/restoration) MUST be written to an immutable,
  append-only audit trail recording actor, action, entity, timestamp, and reason where applicable.
- **FR-041**: Approved requests MUST NOT be edited in place; corrections MUST be new records.
- **FR-042**: Every mutating action MUST pass a server-side permission check before any write, and MUST
  resolve the caller's identity, role and centre from the verified session — never from client-supplied
  values.
- **FR-043**: Read access and write authority MUST be centre-scoped and enforced at the data layer
  (authoritative), such that an employee of one centre can neither read nor act on another centre's
  requests, regardless of any client-supplied parameter; only `super_admin` may act network-wide.
- **FR-044**: The module MUST reuse the existing five-role model, permission registry, centre-tenancy
  mechanism, audit seam, single vocabulary source, nav/access-matrix, and canonical mutation pipeline
  — it MUST NOT introduce a parallel authentication, permission, navigation, notification, or
  form-validation system. (Notification delivery and file storage are net-new infrastructure — see
  Dependencies — but MUST be built as reusable seams consistent with the existing patterns, not as
  one-off forks.)
- **FR-045**: All user-facing copy (form labels, statutory categories, email templates, validation
  messages) MUST be Vietnamese and MUST live in the shared vocabulary / content seam, not inline in
  components; all inputs, storage, exports and emails MUST fully support Vietnamese diacritics.

### Employee-record extensions

- **FR-046**: The employee record MUST be extended with the attributes HR needs and that do not exist
  today — hire/start date (for seniority accrual and pro-rating), employment type (full/part-time),
  and contract type — so entitlement can be computed. A manager relationship is **not** added (routing
  is centre-derived, FR-023).
- **FR-047**: The system MUST allow a recorded, audited manual opening-balance adjustment per employee
  (since there is no historical data to migrate in v1).

### Key Entities *(include if feature involves data)*

- **RequestType**: One of the nine form types; carries its Vietnamese label, payload field definitions,
  validation rules, whether documentation is required, whether it is a money form, and its side-effect
  (balance draw-down for annual leave only). The engine's per-type definition — adding a type is adding
  a definition, not a feature.
- **Request**: A single submitted form instance — submitter, type, centre, payload, status (pending /
  approved / rejected / cancelled / withdrawn / awaiting-cover), decision (approver, timestamp,
  reason), timestamps. The central record.
- **LeaveBalance**: An employee's annual-leave ledger — entitlement, consumed, remaining, per leave
  year; the authoritative balance, mutated only by approval, cancellation, and audited manual
  adjustment.
- **LeaveEntitlementConfig**: HR-editable statutory/policy configuration — baseline, accrual, event
  allowances, documentation thresholds, holiday calendar, working-week definition, leave-year boundary,
  notice period, part-time/contract rules, carry-over, medical-document retention period. The single
  source of statutory values; requires HR sign-off.
- **ClassSession** (minimal timetable): A class with course, centre, assigned teacher, recurring
  day/time pattern, and start/end date; the resolver input for conflict detection. Deliberately minimal.
- **CoverAssignment**: A nomination of a covering teacher for affected session(s) — nominee, status
  (nominated / accepted / declined / released), and link to the originating request.
- **ApprovalRoute**: The routing decision for a request — configured single-step (centre manager,
  escalating to `super_admin` for self/absent), designed to admit additional steps by type or amount.
- **AuditRecord**: An immutable, append-only entry for every state transition — actor, action, entity,
  timestamp, reason. Reuses the existing audit seam.
- **Attachment**: A stored document linked to a request (chiefly medical documentation) with
  data-layer access control; never surfaced in lists, exports, or emails.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An employee can submit an annual-leave request on a phone in **under 60 seconds** from
  opening the HR area to confirmation.
- **SC-002**: A centre manager can see **every** request awaiting their decision on **one screen** and
  act on it without opening any other system.
- **SC-003**: **No** leave request is ever approved that leaves a taught class session uncovered —
  every approved leave with a class conflict has an accepted cover, in 100% of cases.
- **SC-004**: Annual-leave entitlement is **never silently over-drawn**: any balance going below zero
  corresponds to an explicit, recorded manager over-ride — there are zero unexplained negative or
  double-spent balances.
- **SC-005**: **Every** request carries a complete immutable audit trail — who asked, what, when, who
  decided, when, and why — for 100% of requests, with zero in-place edits of approved requests.
- **SC-006**: Medical documentation is accessible only to the approver and HR — 0% exposure to peers,
  and 0 occurrences in any list view, export, or email body.
- **SC-007**: HR can answer "who is off next week and who is covering" from the module directly,
  without contacting any employee.
- **SC-008**: The four leave types remain distinctly recorded and reportable — 100% of leave records
  carry their correct legal type, and only annual leave affects the balance.
- **SC-009**: Statutory values can be changed by an HR admin with no code change or redeploy.

---

## Assumptions

Reasonable defaults chosen where the brief left a decision open (confirmed or defaulted at the
2026-07-16 interview). Statutory figures below are **starting points supplied by the requester, not
verified law, and require HR/legal sign-off before launch** (FR-030).

- **HR & Accounting actor (decided)**: In v1, HR and Accounting duties are held by `super_admin`; no
  sixth role is introduced. Medical-document and sensitive money-field access = the request's approver
  plus `super_admin`. Money forms notify `super_admin` (as accounting) on approval.
- **Money-form routing (decided)**: Single-step to the centre manager, with accounting notified on
  approval; no spend threshold in v1. The router is built to accept a second step (by type or amount)
  later without redesign.
- **Over-balance handling (decided)**: Warn and allow submission; manager discretion to approve (a
  recorded over-draw) or reject.
- **Delegation (decided)**: No per-centre delegate in v1; a manager's own request and absent-coverage
  requests escalate to `super_admin`; self-approval is forbidden.
- **Manager routing (decided)**: Approval routes to the submitter's centre manager, derived from centre
  membership; no `manager_id`/reports-to relationship is added.
- **Leave-year boundary (default)**: Calendar year (1 Jan – 31 Dec), configurable.
- **Carry-over (default)**: Use-it-or-lose-it at leave-year end; HR may enable capped carry-over via
  config.
- **Seniority accrual (default, unverified)**: 12 days baseline + 1 additional day per 5 years of
  service; configurable, pending HR sign-off.
- **Notice period (default)**: Advisory warning, not a hard block; configurable N days.
- **Part-time / contract accrual (default)**: Pro-rated by employment type; configurable, pending HR
  sign-off.
- **Timetable ownership (default)**: `centre_admin` maintains their own centre's class schedule; no
  sync with any external LMS or spreadsheet in v1.
- **Historical balances (default)**: The module starts from zero; there is no legacy leave data to
  migrate. An audited manual opening-balance adjustment is provided instead.
- **Drafts / bulk approval (decided)**: Neither is provided in v1 — the sub-minute form does not
  warrant drafts, and bulk approval would weaken the audit trail.
- **Notifications (default)**: Email in Vietnamese is the notification channel, backed by the in-app
  approver queue and "My requests" views as the primary surfaces; email delivery is net-new
  infrastructure (see Dependencies).
- **Mobile**: Phone usability is a design target for the submission flow; a dedicated native app is out
  of scope.

---

## Dependencies

### Reused from the slice-#001 foundation (must bind to, not fork)

- The five-role model (`super_admin`, `centre_manager`, `centre_admin`, `sale_consultant`, `teacher`)
  and the single permission-key registry — extended by adding new HR permission keys and grants.
- The centre-tenancy mechanism (data-layer enforcement of broad-read / own-centre-write) — HR request
  tables are centre-partitioned; the class timetable and leave config follow the appropriate tenancy
  pattern.
- The append-only audit seam — reused for the HR audit trail.
- The single Vietnamese vocabulary source and the unified nav/access-matrix — the `personnel`
  (`/nhan-su`) area is already reserved for `super_admin` + `centre_manager`; HR pages mount there,
  and new sub-areas (e.g. a submitter-facing "my requests") register through the same matrix.
- The canonical mutation pipeline (permission gate → boundary validation → service → audit) and the
  network-wide-vs-centre-pinned read resolution.

### Net-new infrastructure (does not exist in the codebase today)

- **Notification / email delivery** — no app-level email/notification path exists yet (only the
  platform's built-in auth emails). This module introduces the first one; it MUST be a reusable seam.
- **File storage for attachments** — no storage bucket, upload path, or storage access-control exists
  yet. Medical-document handling introduces it, with data-layer access control from the outset.
- **Employee-record HR attributes** — hire/start date, employment type, contract type (FR-046) and the
  minimal class timetable (FR-016) are new data the foundation never carried.

---

## Out of Scope (explicitly)

To keep the timetable from growing into a scheduling system and the module from growing into an HRIS,
the following are explicitly excluded from v1:

- Payroll, performance reviews, recruitment, contract lifecycle management.
- Room booking, student enrolment, attendance tracking, class capacity, waitlists (the timetable
  exists **solely** to answer "which classes does this leave hit?").
- A general org chart / manager-report hierarchy (routing is centre-derived).
- Multi-step / finance-threshold approval flows (the router is *built to admit* them, but v1 ships
  single-step).
- New role enum values for HR or Accounting (folded into `super_admin` for v1).
- Migration of historical leave balances.
- External LMS / spreadsheet synchronisation of the timetable.
