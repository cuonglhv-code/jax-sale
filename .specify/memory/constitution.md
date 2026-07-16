<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 2.0.0
Rationale: MAJOR — the governing principles are re-established around the product itself:
           a sales-consultation presentation instrument that renders a training roadmap as
           a mountain ascent. All five prior CRM-rebuild principles are removed as the
           constitution's core; build-process discipline (Spec Kit flow, TDD, coverage) is
           retained in Development Workflow & Quality Gates.

Removed principles (v1.0.0):
  I.   Vietnamese-First (Single Vocabulary Source)      — subsumed by new Principle VII
  II.  Layered Security & Multi-Tenant Isolation        — removed from core principles
  III. Canonical Mutation Pipeline & Boundary Validation — removed from core principles
  IV.  Test-First with Isolation Proof                  — retained as a workflow gate, not a principle
  V.   Atomicity, Idempotency & Immutability            — removed from core principles

Added principles (v2.0.0):
  I.   The Metaphor Is the Argument
  II.  Ladder Integrity Is Enforced, Never Merely Implied
  III. Provisional Roadmaps Are Visibly Provisional
  IV.  Two Commitment Thresholds, Legally Distinct
  V.   The Presentation Never Depends on the Network
  VI.  Nothing Blocks the Consultant's Speech
  VII. Content Is Data, Never Code
  VIII. Original Visual Identity
  IX.  Consent Gates Proof

Added sections:
  - Scope Boundary (sole-user definition; anti-goals)

Removed sections:
  - Engineering Standards (CRM-specific items dropped; durable items moved into
    Development Workflow & Quality Gates)
  - KPI subsystem invariants (spec-specific; belongs to feature specs, not the constitution)

Templates reviewed for alignment:
  ✅ .specify/templates/plan-template.md   — Constitution Check reads this file at runtime; no edit needed
  ✅ .specify/templates/spec-template.md   — generic; compatible; no edit needed
  ✅ .specify/templates/tasks-template.md  — generic; TDD task types compatible; no edit needed

Follow-up:
  ⚠ specs/001–004 plans passed their Constitution Check against v1.0.0. Any slice still
    active must be re-validated (e.g. /speckit-analyze) against v2.0.0 before further
    implementation.
-->

# Jax-Sales Constitution

Jax-sales is a presentation instrument: it renders a Jaxtina training roadmap as an ascent up a
mountain, read bottom to top, and is used by a sales consultant in a live conversation with a
student and a parent. This constitution governs everything built in this repository. Where any
other document, template, or legacy artifact disagrees with it, this constitution wins.

## Core Principles

### I. The Metaphor Is the Argument

The product presents the roadmap as a climb because Jaxtina's central pedagogical claim —
"Học chắc từ gốc, không nhảy cóc" (build solidly from the roots, never skip a level) — is
natively expressed by a climb: you cannot skip a stage of an ascent. The metaphor is NOT
decoration and NOT theming. Any change that inverts the direction of the climb (it MUST read
bottom to top) or that implies a student could jump a stage breaks the product's central claim
and MUST be rejected, regardless of aesthetic or technical merit.

### II. Ladder Integrity Is Enforced, Never Merely Implied

The course ladder admits no skipping. This MUST be enforced in the roadmap generation logic —
generated roadmaps MUST be contiguous from the starting level to the target level — and the
enforcement MUST be covered by automated tests. A UI that discourages skipping is NOT
sufficient; the generator itself MUST be incapable of producing a roadmap with a skipped stage.

### III. Provisional Roadmaps Are Visibly Provisional

Placement MUST derive from an actual placement-test result; that is the programme's own
requirement. When a roadmap is built from an estimated starting point rather than a measured
one, its provisional status MUST be unmistakable on screen and in every document produced from
it. It MUST be structurally impossible — not merely discouraged — to send or export a
provisional roadmap that reads as confirmed: the provisional state MUST be carried in the data
model and enforced by the renderer, never left to a consultant remembering to add a caveat.

**Rationale:** A hypothetical climb that looks identical to a measured one is a promise the
organisation has not earned.

### IV. Two Commitment Thresholds, Legally Distinct

The product states exactly two commitment thresholds, and they MUST never be merged, rounded,
simplified, or restated approximately anywhere — screen, document, or data:

- **Chứng nhận hoàn thành khóa học** (course completion certificate):
  Overall ≥ the level's output band AND attendance ≥ 90% AND homework completion ≥ 90%.
- **Cam kết đầu ra bằng văn bản** (written output commitment) — strictly harder:
  homework completion ≥ 95% AND absence no more than 1 buổi/khóa (one session per course).

These figures are a contractual promise made to a paying family at the moment they decide.
Misstating them is a real harm, not a copy defect. Both threshold sets MUST live in one
canonical data definition (per Principle VII) that every rendering reads; no surface may carry
its own copy of the numbers.

### V. The Presentation Never Depends on the Network

The product runs in centres with unreliable connectivity, and a consultation that fails in
front of a parent is worse than no tool. Presentation and document generation MUST work fully
offline — no network fetch may sit on the path from opening the tool to showing the climb or
producing the document. Only delivery (sending a document out) MAY require a network, and when
it fails it MUST fail loudly and MUST preserve the prepared work for retry. Silent loss of a
prepared roadmap or document is a critical defect.

### VI. Nothing Blocks the Consultant's Speech

This is a presentation instrument used in live conversation. Animation the room must wait for
is animation that loses the room. Nothing autoplays. Nothing emits sound by default.
Transitions MUST be swift and MUST never gate the consultant's next utterance — every state
the consultant needs next MUST be reachable immediately, without waiting out a transition.

### VII. Content Is Data, Never Code

All Vietnamese copy, course narrative, level descriptions, pricing, and proof material MUST
live in editable data files maintained by the academic and marketing teams. Changing a word,
a number, or a price MUST never require touching layout or logic. Any user-facing string
inlined in component or logic code is a defect, to be caught in review and repaired by moving
it into the content data layer.

### VIII. Original Visual Identity

The product evokes a staged ascent, and it MUST do so in Jaxtina's own brand. It MUST NOT
reproduce the identity of the VTV television programme "Đường lên đỉnh Olympia" — not its
logo, laurel device, colour scheme, stage design, music, or name. Evoking the climb is
required; imitating that programme is prohibited.

### IX. Consent Gates Proof

No real student's name, photograph, band score, or words may render without confirmed written
consent. Unconsented material MUST be structurally unrenderable — the proof-rendering path
MUST only accept records whose consent is recorded as confirmed — not merely omitted by
convention or filtered at the last surface. Adding a consent flag after the fact is the only
way unconsented material becomes visible; no override may exist in the presentation layer.

## Scope Boundary

The sole users are sales consultants, in centres, on laptops, presenting to a student and a
parent across a desk. Explicit anti-goals — the product is NOT:

- a self-service tool for students;
- a portal for parents at home;
- a phone experience.

Design and implementation decisions MUST NOT compromise the primary case to serve a
hypothetical one. A feature request framed for any excluded audience is out of scope until
this constitution is amended.

## Development Workflow & Quality Gates

- Features are built through the Spec Kit flow: **constitution → specify → clarify → plan →
  tasks → analyze → implement** (skills under `.claude/skills/speckit-*`). Every `plan` MUST
  pass a Constitution Check against this document before tasks are generated. Artifacts
  planned under constitution v1.x MUST be re-validated against v2.0.0 before further
  implementation.
- **TDD is mandatory** (failing test → implement to green → refactor), with a minimum of 80%
  coverage. In addition, each structurally-enforced principle carries a named test
  obligation:
  - Principle II — tests prove the generator rejects or cannot produce a skipped stage;
  - Principle III — tests prove a provisional roadmap cannot render or export as confirmed;
  - Principle IV — tests pin both threshold sets to the canonical data definition, exactly;
  - Principle V — presentation and document generation pass with the network disabled;
  - Principle IX — tests prove an unconsented record cannot reach the proof renderer.
- **Content edit test:** a copy or price change MUST be achievable by editing data files
  only. A change that requires a code edit for content is a Principle VII violation.
- **Review gates:** every review checks for inverted climb direction, skipped-stage
  implications, threshold restatements, inline user-facing strings, network calls on the
  presentation path, and autoplaying or speech-gating motion.

## Governance

This constitution supersedes ad-hoc practice and all prior versions. All plans, reviews, and
merges MUST verify compliance with the Core Principles; any deviation MUST be justified in
writing. Complexity MUST be justified against KISS / YAGNI defaults.

Amendments follow semantic versioning:

- **MAJOR** — backward-incompatible removal or redefinition of a principle or governance rule.
- **MINOR** — a new principle/section or materially expanded guidance.
- **PATCH** — clarifications, wording, or non-semantic refinements.

Every amendment updates the Sync Impact Report at the top of this file, propagates to the
`.specify/templates/*` and `speckit-*` skill references, and bumps the version line below.

**Version**: 2.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-16
