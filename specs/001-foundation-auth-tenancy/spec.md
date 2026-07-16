# Feature Specification: Foundation — Authentication, Roles, Tenancy & Tasks Vertical

**Feature Branch**: `001-foundation-auth-tenancy`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User-defined via interview. Foundation "walking skeleton" for the Jaxtina CRM rebuild:
email/password login + session, all 5 roles with a permission gate on every write, multi-centre
tenancy (broad read / narrow write, database-enforced), and one real vertical — Tasks (list,
create, assign, change status with full status history) — to prove every layer end-to-end.

---

## Overview

This is **slice #1** of a multi-centre, Vietnamese-language CRM rebuilt from scratch. Rather than
build a module in breadth, it stands up the *load-bearing base* every later module depends on —
identity, role-based permissions, and centre-level data isolation — and proves that base works by
driving one genuine feature (Tasks) all the way through read and write paths for every role.

The vertical is deliberately narrow but complete: a staff member logs in, sees the tasks they are
entitled to see, creates and assigns work within their own centre, and moves tasks through their
lifecycle — while the system provably prevents them from reaching another centre's data or
performing an action their role forbids.

**What this slice proves:** the security model and data-access plumbing are real and enforced —
not just present in the UI — so subsequent module specs (leads, activities, pricing, workflows,
KPI, dashboards) can be built on a trusted foundation.

**Why "foundation" is a first-class goal here:** this slice is explicitly built to be the base that
future modules — sales performance tracker, course suggestions, human-resource management, and
further CRM features — extend *without reworking the base*. To make that real (not aspirational),
the slice requires the **extension seams** to exist as single sources of truth: a permission-key
registry, the shared vocabulary source, one unified navigation/access matrix, and the canonical
mutation pipeline. Adding a future module must be a matter of *registering* permission keys, a
navigation entry, and vocabulary labels — not re-architecting the base. No future-module
functionality is built in this slice (KISS/YAGNI); only the seams they plug into.

---

## Clarifications

### Session 2026-07-16

- Q: How should "foundation for future modules" be treated in this spec? → A: Bake in the extension
  seams (permission-key registry, vocabulary source, unified nav/access matrix, canonical mutation
  pipeline) as explicit foundation requirements; build zero future-module functionality.
- Q: Should Departments be a first-class entity in this foundation? → A: Yes — establish Department
  as a first-class, network-wide entity now (staff belong to a department; tasks carry a
  department), so HR and sales-performance modules plug in later without base rework.
- Q: Should a general audit trail be a foundation requirement? → A: Yes — require a general
  audit-log seam on sensitive writes (actor, action, entity type/id, timestamp), proven by this
  slice's own sensitive actions (create/assign task, deactivate account); future modules reuse it.
- Q: How fast must a role/centre change take effect? → A: Ordinary role/centre/department changes
  take effect within ≤30 minutes; security-critical changes (deactivation, demotion) are enforced
  immediately via forced session revocation.
- Q: What data-scale baseline should the foundation design for? → A: Mid-size chain — ~10 centres,
  low-hundreds of staff, ~tens of thousands of tasks/records per year (hundreds of thousands over
  the product's life). Pagination, indexing, and future analytics design to this.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff member signs in and reaches their workspace (Priority: P1)

A staff member of a training centre opens the application, signs in with their email and password,
and lands in an authenticated workspace scoped to their identity, role, and centre. An
unauthenticated visitor cannot reach any workspace page and is sent to sign in.

**Why this priority**: Nothing else in the product is reachable or testable without an established,
identity-bearing session. This is the literal entry point and the source of the role/centre
context every downstream rule reads.

**Independent Test**: Seed a user, sign in with correct credentials → reach the workspace; sign in
with wrong credentials → rejected with a friendly message; navigate to a workspace URL while signed
out → redirected to sign-in. Fully testable with only auth in place.

**Acceptance Scenarios**:

1. **Given** a seeded active staff member, **When** they submit correct email + password, **Then**
   a session is established and they land in the workspace with their role and centre resolved.
2. **Given** a visitor with no session, **When** they navigate directly to any workspace page,
   **Then** they are redirected to the sign-in page and shown no protected content.
3. **Given** a signed-in user, **When** they sign out, **Then** their session ends and workspace
   pages are no longer reachable.
4. **Given** a staff member who submits an incorrect password, **When** they attempt to sign in,
   **Then** they remain signed out and see a friendly Vietnamese error that does not reveal whether
   the email exists.
5. **Given** a staff member who has forgotten their password, **When** they complete the
   password-reset flow, **Then** they can set a new password and sign in with it.

---

### User Story 2 - Users see only the tasks and actions their role and centre permit (Priority: P1)

Each role sees a workspace shaped to its access rights, and each user's data view respects centre
boundaries. A network-wide administrator can view across all centres and switch the active centre;
every other role is pinned to their own centre. A teacher sees only tasks assigned to them. Reads
are broad (oversight), but the interface never exposes a control the role is not allowed to use.

**Why this priority**: The whole product is defined by "who can see and do what, where." Proving
the role + centre resolution end-to-end is the core value of the foundation.

**Independent Test**: Seed users of all five roles across at least two centres. For each, sign in
and verify the visible navigation, the centre scope of the tasks list, and the presence/absence of
the centre switcher match that role's rights.

**Acceptance Scenarios**:

1. **Given** a network-wide administrator, **When** they open the workspace, **Then** they can view
   all centres and use a centre switcher to focus one centre or view the whole network.
2. **Given** a centre-scoped user (manager, admin, or consultant), **When** they open the
   workspace, **Then** their data view is fixed to their own centre and no centre switcher is
   offered, regardless of any URL manipulation.
3. **Given** a teacher, **When** they open the tasks area, **Then** they see only tasks assigned to
   them and are offered no access to modules their role excludes.
4. **Given** any signed-in user, **When** the navigation renders, **Then** it shows exactly the
   modules permitted to their role and nothing more.

---

### User Story 3 - A user creates and assigns a task within their centre (Priority: P1)

An authorized user creates a task — describing the work, choosing an assignee within their own
centre, a group/category, a priority, and a deadline — and it appears in the assignee's task view.
Assignment is confined to the user's own centre.

**Why this priority**: This is the first *write*, and it exercises the permission gate, input
validation, and the narrow-write (own-centre) boundary. Without a write, the tenancy model is only
half-proven.

**Independent Test**: As a centre-scoped user, create a task assigned to a colleague in the same
centre → it appears for that colleague. Attempt to assign to someone in another centre → rejected.

**Acceptance Scenarios**:

1. **Given** an authorized user, **When** they create a task with valid details and an assignee in
   their own centre, **Then** the task is saved and appears in the assignee's task view.
2. **Given** an authorized user, **When** they attempt to create or assign a task targeting another
   centre, **Then** the write is rejected and no cross-centre task is created.
3. **Given** a user whose role does not permit creating tasks, **When** they attempt the create
   action, **Then** it is refused with a friendly message and nothing is written.
4. **Given** a create attempt with missing or invalid details (e.g. no deadline), **When** it is
   submitted, **Then** it is rejected at the boundary with a clear message identifying the problem.

---

### User Story 4 - A user moves a task through its lifecycle and history is recorded (Priority: P1)

A user changes a task's status. The common flow cycles TODO → DOING → DONE and back to TODO. A task
can also be explicitly set to a paused/exited state (blocked, rescheduled, or cancelled). Every
change — automatic or explicit — is recorded as history showing who changed it, when, and from
which status to which.

**Why this priority**: Status change is the representative guarded mutation with an invariant
(history-on-every-transition). Proving it establishes the atomicity/audit pattern the rest of the
product reuses.

**Independent Test**: Advance a task through the cycle and verify each hop; explicitly block then
unblock a task; after each change, verify a history entry with actor, timestamp, and from→to
statuses exists.

**Acceptance Scenarios**:

1. **Given** a task in TODO, **When** the user advances it without naming a target, **Then** it
   moves to DOING; advancing again moves it to DONE; advancing again returns it to TODO.
2. **Given** a task in any active state, **When** the user explicitly sets it to blocked, **Then**
   it becomes blocked and stays there until an explicit status is chosen (the automatic cycle never
   enters or leaves the blocked state on its own).
3. **Given** any status change, **When** it completes, **Then** a history entry records the actor,
   the time, and the from-status and to-status.
4. **Given** a newly created task, **When** it is first saved, **Then** an initial history entry
   records its creation (from "none" to its starting status), so history is complete from the
   start.
5. **Given** a user attempting to change the status of a task outside their permitted scope,
   **When** they act, **Then** the change is refused and no history entry is written.

---

### Edge Cases

- **Cross-centre access attempt via direct navigation**: a centre-scoped user manipulates a URL to
  reference another centre — the system must ignore the override and keep them pinned to their own
  centre; any write targeting the other centre is refused at the data layer even if an interface
  check were somehow bypassed.
- **Stale role/centre after an admin change**: an ordinary change to a user's role, centre, or
  department takes effect within **≤30 minutes** without action by the affected user. A
  **security-critical** change — account deactivation or a demotion that removes access — is
  enforced **immediately** by revoking the user's active session(s), so no user retains elevated or
  revoked-scope access beyond that point.
- **Assignee no longer valid**: creating/assigning a task to an assignee who is not an active
  member of the user's centre is rejected.
- **Invalid status target**: requesting a status transition that is not defined (or not permitted
  for the task's current state) is refused without corrupting the task or its history.
- **Deactivated account**: a user whose account has been deactivated cannot sign in, and any
  existing session is prevented from performing protected actions.
- **Concurrent status changes**: if two users change the same task's status near-simultaneously,
  the task ends in a single well-defined state and history reflects the changes without loss.
- **Empty / first-run states**: a user with no tasks sees a clear empty state, not an error.

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & session**

- **FR-001**: The system MUST let a staff member sign in with an email and password and, on
  success, establish an authenticated session.
- **FR-002**: The system MUST reject invalid credentials without revealing whether the email
  exists, showing a friendly Vietnamese message.
- **FR-003**: The system MUST let a signed-in user sign out, ending their session.
- **FR-004**: The system MUST provide a password-reset flow allowing a user to set a new password
  and subsequently sign in with it.
- **FR-005**: The system MUST prevent a deactivated account from signing in and MUST prevent an
  already-established session belonging to a deactivated account from performing protected actions.
- **FR-006**: The system MUST NOT offer public self-registration; accounts originate from
  seeding/administration, not self-signup. (Out of scope: any self-signup page.)
- **FR-007**: The system MUST resolve each session's role, centre, and staff identity from the
  verified session itself and MUST NOT trust any client-supplied role, centre, or identity value.
- **FR-007a**: An ordinary change to a user's role, centre, or department MUST take effect within
  **30 minutes** without action by the affected user. A security-critical change (account
  deactivation, or a demotion that removes access) MUST be enforceable **immediately** by revoking
  the affected user's active session(s).

**Roles & permissions**

- **FR-008**: The system MUST support exactly five roles — network administrator (network-wide),
  centre manager, centre administrator, sales consultant, and teacher — each with a defined set of
  permitted modules and actions.
- **FR-009**: The system MUST render navigation and controls per role so that a user is only shown
  modules and actions their role permits; the list that governs what a route allows and the list
  that renders navigation MUST be one and the same source (no divergent parallel lists).
- **FR-010**: Every mutating action MUST be gated server-side by a permission check that runs before
  any change, and MUST refuse the action for a caller whose role lacks the required grant — even if
  the interface did not offer the control.
- **FR-011**: Read/list access to operational business data MUST be permitted broadly to any
  authenticated user (oversight), with data scope constrained by centre rules rather than by
  per-action permission keys. **Exception:** the general audit-log trail (FR-024g) is NOT broadly
  readable — because it records sensitive administrative actions (e.g. deactivations, demotions) —
  and MUST be restricted to the caller's own centre and elevated/administrative roles. This is the
  one deliberate carve-out from broad read; all other entities in this slice follow the broad-read
  rule.

**Multi-centre tenancy**

- **FR-012**: The system MUST partition data by centre and MUST confine writes to the caller's own
  centre; a user MUST NOT create, modify, or delete another centre's data.
- **FR-013**: The centre-isolation boundary MUST be enforced at the data layer (authoritatively),
  such that a mutating action that failed to check permissions still cannot write outside the
  caller's centre.
- **FR-014**: Only the network-administrator role MUST be able to select/override the active centre
  (a centre switcher, including a "whole network" option); every other role MUST be pinned to its
  own centre regardless of any client-supplied override.
- **FR-015**: A read filter with no centre selected MUST mean "whole network" and MUST be available
  only to the network-wide role.

**Tasks vertical**

- **FR-016**: An authorized user MUST be able to view a paginated list of tasks; the list MUST be
  scoped by the caller's effective centre (own centre, or a chosen/all centre for the network
  administrator).
- **FR-017**: A teacher MUST see only tasks assigned to them.
- **FR-018**: An authorized user MUST be able to create a task capturing at least: a description, an
  assignee, a department, a group/category, a priority, and a deadline.
- **FR-019**: Task creation and assignment MUST be confined to the caller's own centre; assigning a
  task to a member of another centre MUST be refused.
- **FR-020**: The system MUST support the full task-status model: an automatic cycle
  TODO → DOING → DONE → TODO (advancing without naming a target), plus explicit-only states
  Blocked, Rescheduled, and Cancelled that are entered and left only by naming them and are never
  touched by the automatic cycle.
- **FR-021**: The system MUST record a status-history entry for every status change — automatic or
  explicit — capturing the actor, the time, the from-status, and the to-status.
- **FR-022**: The system MUST record an initial status-history entry at task creation (from "none"
  to the starting status) so history is complete from the moment a task exists.
- **FR-023**: All user-supplied input for these actions MUST be validated at the server boundary
  before any change, and invalid input MUST be refused with a clear, friendly Vietnamese message.

**Extension seams (foundation for future modules)**

- **FR-024a**: Permission grants MUST be defined in a single registry that maps each role to its
  set of permission keys; adding a future module's capability MUST be possible by registering new
  keys against roles, without changing the permission-gate mechanism itself.
- **FR-024b**: The navigation/access matrix MUST be one shared, per-role list that governs both what
  a route permits and what navigation renders; adding a future module MUST be possible by adding one
  entry to this list, with no second parallel list to keep in sync.
- **FR-024c**: All display labels and badge styling MUST come from the single shared vocabulary
  source; adding a future module's labels MUST be an addition to that source, not a new parallel
  labeling scheme.
- **FR-024d**: Every mutating action across the product MUST flow through one canonical pipeline
  (permission check → input validation → domain logic), so a future module's write inherits the
  same auth, validation, and error-handling guarantees without re-implementing them.
- **FR-024e**: Tenant-scoped data added by future modules MUST be able to adopt the same
  centre-partitioning and broad-read/narrow-write model demonstrated here; the tenancy mechanism
  MUST NOT be specific to the Tasks entity.
- **FR-024g**: The system MUST provide a **general audit-log seam**: every sensitive write records
  the actor, the action (as `<entity>.<verb>`), the affected entity type and id, and a timestamp.
  This slice MUST exercise it on its own sensitive actions — at minimum task creation, task
  assignment, and account deactivation — so future modules (HR, sales performance) inherit the trail
  rather than reinventing it. (This is distinct from, and additional to, task status history.)
- **FR-024f**: The system MUST model **Department** as a first-class, network-wide entity (a flat
  set of departments spanning all centres, unique by name). Each staff member MUST belong to a
  department, and each task MUST carry a department. This establishes the org primitive that future
  HR and sales-performance modules reuse; no department-specific management UI is built in this
  slice beyond assigning a staff member's and a task's department.

**Cross-cutting**

- **FR-024**: All user-facing copy — labels, statuses, role names, and error messages — MUST be
  Vietnamese, resolved through a single shared vocabulary source; no raw internal identifier or
  English string may reach the interface.
- **FR-025**: Errors MUST be handled explicitly and never silently swallowed: users see a friendly
  Vietnamese message; full detail is retained in server-side logs.
- **FR-026**: Every list MUST be paginated; the slice MUST issue no unbounded queries.

### Key Entities *(include if feature involves data)*

- **Centre**: a training centre; the unit of tenancy. Data belongs to a centre; writes are confined
  to a caller's own centre. ~10 centres exist in seed data across at least two for isolation tests.
- **Staff member / Employee**: a person who signs in; belongs to exactly one centre, one department,
  and holds exactly one role; may be active or deactivated; may be a task assignee.
- **Department**: a first-class, network-wide organizational unit (flat, unique by name, spanning
  all centres). Staff belong to a department and tasks carry a department. It is the shared org
  primitive future HR and sales-performance modules build on.
- **Role**: one of five (network administrator, centre manager, centre administrator, sales
  consultant, teacher); determines permitted modules and actions and centre scope (network-wide vs
  own-centre).
- **Session / Identity claims**: the verified role, centre, and staff identity established at
  sign-in and read by the system for every access decision.
- **Task**: a unit of work belonging to a centre, with a description, an assignee, a department, a
  group/category, a priority, a deadline, and a current status.
- **Task status history entry**: an immutable record of a single status change — actor, time,
  from-status, to-status — belonging to a task.
- **Audit-log entry**: an immutable record of a sensitive write — actor, action (`<entity>.<verb>`),
  entity type and id, and timestamp. The general trail future modules reuse (distinct from task
  status history).

---

## Success Criteria *(mandatory)*

Both bars below are required to consider this slice done.

### Security-proof bar

- **SC-001**: For every mutating action in this slice, an attempt by a caller whose role lacks the
  grant is refused and results in no change — demonstrated by automated tests running against a
  real (non-mocked) data layer.
- **SC-002**: A user of centre A can neither read the private-scoped data of centre B nor create,
  modify, or delete any centre-B data — demonstrated by automated centre-isolation tests running
  against a real data layer, for the tenant-scoped entities in this slice.
- **SC-003**: A mutating action that omits its permission check is still unable to write outside the
  caller's centre (data-layer enforcement is independently verified).
- **SC-003a**: After an account is deactivated or demoted, the affected user can no longer perform
  actions their removed access allowed — immediately (within one request cycle of the revocation),
  verified by test.
- **SC-004**: 100% of status changes produce a corresponding history entry (no transition is ever
  unlogged), verified by test.
- **SC-004a**: 100% of the slice's sensitive writes (task create, task assign, account
  deactivation) produce a corresponding audit-log entry with actor, action, entity, and timestamp,
  verified by test.

### Working-vertical bar

- **SC-005**: A seeded user of each of the five roles can sign in and use the tasks area exactly per
  their access rights (correct navigation, correct centre scope, teacher sees only own tasks),
  verified end to end.
- **SC-006**: An authorized user can create, assign (within their centre), and advance a task
  through its full lifecycle, and the result is visible to the assignee, in a single session.
- **SC-007**: A network administrator can switch the active centre and see the tasks list rescope
  accordingly, including a whole-network view.
- **SC-008**: A first-time user completes sign-in in under 1 minute, and creating a task takes under
  1 minute, on standard connectivity.
- **SC-008a**: At the mid-size-chain baseline (~10 centres, low-hundreds of staff, tens of thousands
  of tasks), the tasks list returns its first page quickly enough to feel instant to the user
  (perceived-immediate), and no list operation issues an unbounded query — verified at representative
  seed volume.

### Quality bar

- **SC-009**: Automated test coverage for the slice's mutating actions and tenancy boundaries is at
  least 80%.
- **SC-010**: No user-facing screen in the slice displays a raw internal identifier or an English
  system string; all copy is Vietnamese.

---

## Assumptions

- **Stack is intentionally undecided here.** Concrete technology (framework, database, auth
  provider) is deferred to `/speckit-plan`. The requirements are written to be enforceable on any
  stack that can provide server-side permission gating and database-level tenant isolation; a stack
  that cannot enforce row-level tenant isolation at the data layer would not satisfy FR-013/SC-003.
- **Enum values are a stable contract; only display labels are defined fresh.** The internal string
  values for statuses, roles, groups, and priorities are treated as the contract (stable across the
  rebuild); their Vietnamese display labels live in the single vocabulary source. Precise label
  wording follows the vocabulary defined during planning; `REBUILD-SPEC.md` §2/§4/§5.4 is the
  reference for values and labels but is not auto-imported.
- **Reads are broad by design.** Any authenticated user may read network-wide for oversight; the
  narrow boundary is on writes. This is a deliberate product property, not an oversight.
- **Task generation is out of scope.** Tasks in this slice are created manually (or seeded);
  automated task generation from activities or workflows is deferred to later slices. Task
  reassignment across centres is unsupported by design.
- **Password reset delivery** (e.g. how a reset link/notification reaches the user) uses a standard,
  reasonable mechanism to be selected at plan time; the requirement is that a user can reset and
  then sign in.
- **Seed data** provides at least two centres and at least one user per role (with cross-centre
  coverage) so the security-proof and working-vertical bars are exercisable.
- **Data-scale baseline is a mid-size chain**: ~10 centres, low-hundreds of staff, ~tens of
  thousands of tasks/records per year (hundreds of thousands over the product's life). Pagination,
  indexing, and future analytics/reporting modules (sales performance) design to this order of
  magnitude — not a small single-site tool, and not a speculative millions-of-records system.
- **Out of scope for this slice**: Google/OAuth sign-in, public self-signup, and all other modules
  (leads/CRM, students, activities, pricing/pathway, workflows, dashboards, KPI/BI, personnel
  administration beyond what auth requires, team directory, import/export, calendar sync).

## Dependencies

- A running data layer that supports authoritative, database-enforced tenant isolation (required by
  FR-013 and SC-003).
- Seed/administration capability to create accounts (since self-signup is out of scope).
- The project constitution (`.specify/memory/constitution.md`), whose non-negotiable principles
  (layered security, canonical mutation pipeline, test-first with isolation proof, Vietnamese-first
  vocabulary, status-log-on-every-transition) this slice is the first to embody.
