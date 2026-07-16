# Contract: Roadmap server actions

All follow the canonical pipeline `withError → assertPermission → schema.parse → service`; result
is a discriminated `{ data } | { error }` (friendly Vietnamese in prod). Permission key:
`roadmap.generate` (registered in `permissions.ts`, granted to `super_admin`, `centre_manager`,
`centre_admin`, `sale_consultant`).

---

## `submitRoadmap(raw)` — mutating

- **Gate**: `assertPermission("roadmap.generate")`.
- **Input** (Zod, `schemas/roadmap.ts`): the `RoadmapRequest` fields + the engine-produced
  `courseSequence` (codes), `manualEdited`, `generationKey`, and the `DeliveryResult.status`.
  `centreId` is taken from the caller's claims, NOT from the client.
- **Behavior**: inserts a `roadmap_records` row (centre = caller's centre) with all FR-LOG-01 fields;
  `sent = (deliveryStatus === "delivered")`. Emits a `roadmap.generate` audit-log entry (FR-024g).
  Idempotent on `generationKey` (on-conflict-do-nothing) so a double-submit never duplicates the log
  (Principle V).
- **Success criteria**: FR-LOG-01/02, SC-005; AC-7.2/7.4.
- **Negative path (SC-008)**: a caller lacking `roadmap.generate` (e.g. `teacher`) gets `{ error }`
  and writes nothing — proven by test against the live DB.

## `listRoadmapRecords(filter)` — read

- **Gate**: `assertAuthenticated()` (reads are broad; scope via RLS + effective centre).
- **Input**: `{ centreId?, consultantId?, page?, pageSize? }`; effective centre resolved server-side
  via `resolveEffectiveCentre` (only `super_admin` may override; others pinned).
- **Behavior**: returns `Paginated<RoadmapRecordView>` (with resolved consultant/centre names). For
  the academic team's audit view.
- **Success criteria**: SC-005 (auditability); FR-LOG-02 (broad read).

---

### Notes
- Engine execution, PDF render, and the delivery adapter run **client-side** (offline-capable);
  only `submitRoadmap` (the audited log write) crosses to the server.
- No compound guarded DB function is needed — the log write is a single insert + audit (accepted §6
  two-call trade-off; the only risk is a missing audit row, never corrupt data).
