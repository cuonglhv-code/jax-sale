# Phase 1 Data Model & Engine Algorithm: IELTS Roadmap Builder

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

App types are `camelCase`; DB columns `snake_case` (converted only at the service boundary).
Enum string values are the contract; Vietnamese labels live in the vocabulary/content store.

---

## Band scale (the ordering that makes "no skip" checkable)

```
BAND_ORDER (ascending, index):
  "below A1"=0  "~A1"=1  "2.5"=2  "3.5"=3  "4.5"=4  "5.5"=5
  "6.0"=6  "6.5"=7  "7.0"=8  "7.5"=9  "8.0+"=10
bandValue(band) -> index    # total order used for all comparisons
```

Current-band input options: `~A1` (labelled "Chưa có nền ~A1") … `7.0`. `below A1` is reachable only
via the "Mất gốc" audience override. Target-band options: `2.5` … `8.0+`.

---

## Entities

### Course (content data — `src/lib/domain/ielts/courses.ts`)

| Field | Type | Notes |
|---|---|---|
| `code` | `CourseCode` | `PRE_S`\|`IF1`\|`IF2`\|`GP`\|`B1`\|`B2`\|`A1`\|`A2`\|`A3`\|`INT` |
| `name` | string | e.g. "Booster 1" |
| `entryBand` | `Band \| null` | null for `GP`/`INT` (not slotted by band) |
| `outputBand` | `Band \| null` | null for `GP`; `INT` = "+0.5 overall" (special) |
| `sessions` | number | GP = **provisional** (⚠ flagged; see research D-GP) |
| `sessionsProvisional` | boolean | true for `GP` until confirmed |
| `family` | `"foundation"\|"booster-achiever"\|"intensive"\|"support"` | drives narrative shape |
| `narrativeKey` | string | key into the narrative content store |
| `role` | `"rung"\|"optional-insert"\|"append"` | `GP`=optional-insert, `INT`=append, rest=rung |

The ladder is the ordered `Course[]` of rungs (`PRE_S…A3`) plus `GP` (insert) and `INT` (append).

### RoadmapRequest (input — `src/schemas/roadmap.ts`)

| Field | Type | Validation |
|---|---|---|
| `studentName` | string | required, non-empty |
| `audience` | `"THCS"\|"THPT"\|"SINH_VIEN"\|"NGUOI_DI_LAM"\|"MAT_GOC"` | required |
| `studentEmail` | string | required, email format |
| `studentPhone` | string | optional |
| `currentBand` | `Band` | required (select) |
| `targetBand` | `Band` | required (select); **must satisfy bandValue(target) > bandValue(current)** |
| `examPurpose` | `"XET_TUYEN_DH"\|"TOT_NGHIEP"\|"DU_HOC_HB"\|"CHUAN_B2"\|"KHAC"` | required |
| `targetExamDate` | ISO date \| null | optional |
| `intensity` | `"TIEU_CHUAN"\|"TANG_CUONG"` | required |
| `consultantName` | string | required |
| `consultantPhone` | string | optional |
| `consultantEmail` | string | optional, email format |
| `centreId` | string | resolved from claims server-side (not trusted from client on submit) |
| `startDate` | ISO date \| null | optional; defaults to today for completion-date maths |

### Roadmap (engine output — pure, in memory)

| Field | Type | Notes |
|---|---|---|
| `courses` | `RoadmapCourse[]` | ordered sequence (rungs + inserts + append) |
| `totalSessions` | number | sum of course sessions |
| `totalWeeks` | number | `totalSessions / rate` |
| `totalMonths` | number | `totalWeeks / 4.33` |
| `projectedCompletion` | ISO date \| null | `startDate + totalMonths` when computable |
| `hasProvisionalSessions` | boolean | true if any course (e.g. GP) has provisional sessions |
| `consultantNotes` | string \| null | "Ghi chú từ tư vấn viên" (US5) |
| `manualEdited` | boolean | true if narrative/order/removal/note edited |
| **`internalWarning`** | `DeadlineWarning \| null` | **INTERNAL ONLY — see barrier below** |

`RoadmapCourse` = `{ code, name, sessions, sessionsProvisional, narrative, family }`.

`DeadlineWarning` = `{ kind: "deadline"; projectedCompletion; targetExamDate; recommend: "intensive" | "revise-target" }`.

**The internal-only barrier (SC-006, structural):** the PDF document component accepts a
`StudentRoadmapView` type that is `Omit<Roadmap, "internalWarning">` (and omits any consultant-only
note flagged internal). Because the warning field does not exist on the PDF input type, it is a
**compile-time impossibility** for the warning to reach the student PDF — not a runtime check that
could be forgotten. See [contracts/engine.md](./contracts/engine.md).

### RoadmapRecord (persisted audit log — tenant-scoped table `roadmap_records`)

| Field (app) | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | uuid PK | |
| `centreId` | `centre_id` | uuid | FK → centres; tenancy key (from claims) |
| `consultantId` | `consultant_id` | uuid | FK → employees (actor) |
| `studentName` | `student_name` | text | |
| `studentEmail` | `student_email` | text | |
| `studentPhone` | `student_phone` | text | nullable |
| `audience` | `audience` | text | enum value |
| `currentBand` | `current_band` | text | |
| `targetBand` | `target_band` | text | |
| `courseSequence` | `course_sequence` | text[] / jsonb | ordered course codes |
| `manualEdited` | `manual_edited` | boolean | AC-5.5 |
| `sent` | `sent` | boolean | from `DeliveryResult` (drafted ≠ confirmed sent) |
| `generationKey` | `generation_key` | text unique | idempotency (prevents duplicate logs) |
| `createdAt` | `created_at` | timestamptz | |

- RLS: broad SELECT; centre-narrow INSERT/UPDATE/DELETE (Pattern A from slice #001). See
  [contracts/rls-policies.md](./contracts/rls-policies.md).
- Indexes: `centre_id`, `consultant_id`, `created_at`, unique `generation_key`.
- The write also emits a general audit-log entry `roadmap.generate` (FR-024g reuse).

### DeliveryResult

`{ status: "delivered" | "drafted" | "failed"; detail?: string }` → maps to `RoadmapRecord.sent`
(`delivered` ⇒ true; `drafted`/`failed` ⇒ false).

---

## Engine algorithm (pure — the crown-jewel logic)

```
generateRoadmap(req: RoadmapRequest, ladder: Course[]) -> Roadmap:

  rungs = ladder.filter(c => c.role == "rung")            # PRE_S,IF1,IF2,B1,B2,A1,A2,A3 in order
  tv = bandValue(req.targetBand); cv = bandValue(req.currentBand)

  # 0. Precondition (also enforced by schema): target strictly above current
  assert tv > cv

  # 1. Start course (audience override OR entry-band match)
  if req.audience == "MAT_GOC":
      startIdx = index of PRE_S in rungs
  else:
      startIdx = index of first rung whose bandValue(outputBand) > cv
                 # i.e. the rung the student still has something to gain from;
                 # equivalently the rung whose entryBand == currentBand for on-grid bands

  # 2. Contiguous slice — NO SKIPPING (FR-ENGINE-01). Walk rungs in order from startIdx,
  #    appending EVERY rung, until a rung's output meets the target.
  seq = []
  for i from startIdx to end(rungs):
      seq.push(rungs[i])
      if bandValue(rungs[i].outputBand) >= tv: break
  # invariant asserted in tests: seq is a contiguous sub-array of rungs (no index gap)

  # 3. A3 policy (i) (research D-A3, ⚠ confirm): include A3 when target >= 6.5
  if tv >= bandValue("6.5") and A3 not in seq and A3 reachable from seq end:
      seq.push(A3)                                        # removable (logged if removed)

  # 4. Audience insert: THCS inserts GP before B1
  if req.audience == "THCS" and B1 in seq:
      insert GP immediately before B1 in seq

  # 5. Auto-append Intensive (AC-3.1)
  finalRung = last rung in seq
  gapToTarget = tv - bandValue(finalRung.outputBand)
  if tv >= bandValue("5.5") and (req.targetExamDate != null or gapToTarget <= 1):
      # gapToTarget<=1 index-steps == <=0.5 band; INT adds +0.5 overall
      seq.push(INT)

  # 6. Timeline maths (AC-3.4/3.5)
  rate = req.intensity == "TANG_CUONG" ? INTENSIVE_RATE(4, ⚠) : 2.7
  totalSessions = sum(c.sessions for c in seq)            # GP provisional flagged
  totalWeeks = totalSessions / rate
  totalMonths = totalWeeks / 4.33
  start = req.startDate ?? today
  projectedCompletion = addMonths(start, totalMonths)

  # 7. Deadline feasibility (INTERNAL ONLY — AC-4.1/4.2)
  internalWarning = null
  if req.targetExamDate != null and projectedCompletion > req.targetExamDate:
      internalWarning = { kind:"deadline", projectedCompletion, targetExamDate:req.targetExamDate,
                          recommend: req.intensity=="TIEU_CHUAN" ? "intensive" : "revise-target" }

  return Roadmap{ courses: materialize(seq, contentStore), totalSessions, totalWeeks, totalMonths,
                  projectedCompletion, hasProvisionalSessions: any(c.sessionsProvisional),
                  consultantNotes:null, manualEdited:false, internalWarning }
```

**Edge handling inside the engine** (AC edge cases):
- `startIdx` past the last rung (current at/above ladder top): `seq` is empty of rungs → step 5 may
  still append `INT` if `tv >= 5.5`; result carries a consultant-only note "vượt thang chuẩn" (never
  in the student view). Never empty-and-silent, never gapped.
- `target 8.0+` beyond A3(+INT): cap at A3, append INT, attach the consultant-only "exceeds standard
  ladder reach" note.
- `targetExamDate == null`: step 7 skipped (no warning), everything else computes.
- Band comparisons use `bandValue` throughout so `~A1`/`below A1` order correctly below `2.5`.

**Reference-audience validation (SC-003):** a test drives `generateRoadmap` for each of the six
audiences at its reference entry/target (from `reference-roadmaps.ts`) and asserts `totalMonths`
falls in the stated range, or records a documented divergence.

## Status/flag semantics recap

- `manualEdited` — set true by the review screen on any narrative edit, note add, course removal, or
  reorder; persisted on the record (AC-5.5).
- `sent` — `true` only on a confirmed `delivered`; the default draft flow yields `drafted` ⇒ `false`.
- `generationKey` — stable per (request + engine output) so a double-submit does not duplicate the
  log (idempotency, constitution Principle V).
