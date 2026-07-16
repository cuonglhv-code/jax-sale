# Data Model: Jaxtina IELTS Summit

App types are camelCase; DB columns snake_case (converted only at the service boundary — house
rule). Types below are contracts, not implementation; see [contracts/](./contracts/) for
behaviour.

## Reused from feature 002 (unchanged)

- **Band / band order** — `src/lib/domain/ielts/bands.ts`
- **Course / LADDER / RUNGS** — `src/lib/domain/ielts/courses.ts`
- **CourseNarrative** (tier-shaped blocks) — `src/lib/domain/ielts/narrative/`
- **CommitmentThreshold ×2 (canonical)** — `src/lib/domain/ielts/thresholds.ts`
- **DeliveryAdapter / DeliveryPayload / DeliveryResult** — `src/services/ielts/delivery/adapter.ts`

## New / extended types

### Placement (Mode A/B) — the structural provisional barrier

```ts
type Placement =
  | { kind: "measured"; testDate: string }   // Mode A — ISO date of the placement test
  | { kind: "estimated" };                   // Mode B — provisional, caveat is mandatory
```

- Carried on the consultation and on every rendered view; renderers switch exhaustively
  (compile-time `never` check). The estimated branch of the cover/heading components *is* the
  caveat markup — no flag, no optional prop.
- Transition: `estimated → measured` only by entering a test result (becomes Mode A
  everywhere at once). `measured → estimated` does not exist.

### SummitRequest (opening inputs — exactly FR-030)

```ts
interface SummitRequest {
  studentName: string;        // non-empty; renders on the mountain
  currentBand: Band;          // from CURRENT_BAND_OPTIONS (+ "below A1" for Pre-S entry)
  targetBand: Band;           // from TARGET_BAND_OPTIONS; must be > currentBand
  placement: Placement;
}
```

Validation: `targetBand > currentBand` (band order); otherwise the UI refuses to render a climb
and prompts adjustment (edge case), preserving inputs.

### SummitStage

```ts
interface SummitStage {
  code: CourseCode;
  name: string;
  family: CourseFamily;
  sessions: number | null;        // null for PRE_S on the summit path (D-PRES)
  narrative: CourseNarrative;
  price: number | null;           // VND from the centre price list; null → "liên hệ tư vấn"
  state: "below" | "climb" | "above";  // recede-dimmed / illuminated / recede-reachable
}
```

### SummitRoadmap (single source for screen AND document)

```ts
interface SummitRoadmap {
  request: SummitRequest;
  centreKey: CentreKey;
  stages: SummitStage[];               // full ladder with state; climb = contiguous slice
  totalSessions: number;               // sum over climb stages with non-null sessions
  durationWeeks: { min: number; max: number };   // presented as a range (FR-004)
  durationMonths: { min: number; max: number };
  projectedFinish: { earliest: string; latest: string } | null;
  totalPrice: { amount: number; excludesUnpriced: boolean };  // arithmetic sum only
  consultantNotes: string | null;      // "Ghi chú từ tư vấn viên" (student-visible)
  manualEdited: boolean;               // review removals/reorders happened (FR-019 warning shown)
}
```

Invariants (engine-enforced, tested):
- Climb stages are a contiguous ladder slice; INT appended iff target ≥ 5.5 ∧ gap ≤ 0.5 band.
- `totalPrice.amount` = Σ price of climb stages with non-null price; `excludesUnpriced` true
  iff any climb stage has null price.
- Duration range derives from totalSessions at the effective rate (2.7/week, 4.33 weeks/month)
  with the range width policy in contracts/summit-engine.md — never a single point value.

### ConsentedProof (branded — Constitution IX)

```ts
declare const consented: unique symbol;
interface ConsentedProof {
  [consented]: true;
  id: string;
  displayName: string;         // as consented for display
  photoRef: string | null;
  startBand: Band;
  resultBand: Band;
  quoteVi: string | null;
  consentRef: string;          // pointer to the written consent on file
}
```

Only `proof.ts` can construct it (brand not exported); the module exports solely
`CONSENTED_PROOF: readonly ConsentedProof[]`. Raw entries with `consent.written === false`
never leave the module.

### ProofMatch

```ts
interface ProofMatch {
  proof: ConsentedProof;
  matchKind: "exact" | "nearest";   // "nearest" renders without exact-match claims
}
```

### Capture (send-time details — Zod at the boundary)

```ts
interface Capture {
  studentEmail: string;   // validated email
  studentPhone: string | null;
  consultantName: string;
  consultantPhone: string | null;
  consultantEmail: string | null;
  // centreId resolved from verified session claims — never client-supplied
}
```

### FaqEntry / PriceList (content data)

```ts
interface FaqEntry { objectionKey: string; chipLabelVi: string; questionVi: string; answerVi: string; priority: number }
type PriceList = Partial<Record<CourseCode, number>>;         // VND
type Prices = Record<CentreKey, PriceList>;
```

## Persistence (network only at send — D-ARCHIVE)

### Table `summit_sends`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| centre_id | uuid FK | caller's centre from claims |
| consultant_id | uuid FK | `auth.uid()` |
| student_name | text | |
| student_email | text | |
| placement_kind | text CHECK IN ('measured','estimated') | Mode A/B |
| current_band | text | |
| target_band | text | |
| course_sequence | text[] | ordered climb codes as sent |
| total_price | bigint | VND at send time |
| ladder_edited | boolean | manual removals/reorders occurred |
| pdf_path | text | Storage object path of the exact sent PDF |
| delivery_status | text CHECK IN ('delivered','failed') | archive row written on success path |
| generation_key | text UNIQUE | idempotency — retry never duplicates |
| created_at | timestamptz | |

RLS: INSERT confined to caller's centre; SELECT granted network-wide to the academic-audit
permission; no UPDATE/DELETE (immutable audit).

### Storage bucket `roadmap-archive`

Private; object path `<centre_id>/<summit_send_id>.pdf`; write via the send action only; read
via the academic-audit permission. The archived object is byte-identical to the emailed PDF
(same blob — SC-003's provable identity).

## Consultation state machine (one active consultation per machine)

```text
blank → presenting ⇄ (stage expanded | summary | secondary content)   [all one-action]
presenting → review ⇄ presenting            [review edits mark manualEdited]
review → captured → sending → sent → blank  [reset; warns if prepared-but-unsent]
sending → send-failed → sending             [loud error; blob + state preserved; retry]
any state → blank                            [reset, with unsent-work warning]
```

No state transition may lose entered data except an explicitly confirmed reset.
