# Sick Leave Text Reason Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `sick_leave`'s mandatory file-upload documentation requirement with a required free-text `reason` field, matching how `personal_leave`/`unpaid_leave` already work.

**Architecture:** `sick_leave` moves from "always requires an uploaded document" (`doc_type_policy.required = true`, `FormDefinition.requiresDocument: true`, upload UI shown) to "requires a typed reason, no upload capability at all" — mirroring `unpaid_leave`'s existing shape (required `reason`, `requiresDocument: false`). The existing generic `leaveFamilyPayload()` builder in `hr-request.service.ts` already persists `reason` for any leave-family type that has it, so no service-layer code changes are needed — only the schema, form registry, seed config, UI, and the two US6 tests that currently use `sick_leave` as their attachment-upload test vehicle (they switch to `personal_leave`, which keeps its existing optional-attachment capability unchanged).

**Tech Stack:** TypeScript, Zod, Next.js Server Actions, Supabase (Postgres + RLS), Vitest (live local DB, no mocks), React 19 + TanStack Query.

## Global Constraints

- All error/validation messages are Vietnamese, matching existing strings in this codebase exactly in style (see `sickLeaveSchema`/`personalLeaveSchema` for tone).
- No mocking of Supabase/auth in tests — integration tests run against the live local stack (`npm run db:start` first).
- `vitest.config.ts` forces `fileParallelism: false` — tests run sequentially; do not attempt to parallelize.
- Every mutating server action follows the existing `withError` + `assertPermission`/`assertAuthenticated` + `schema.parse` + service call pipeline (see `src/lib/server-action.ts`).
- Do not touch `personal_leave`'s existing `reason` field, its optional attachment capability, or the attachment service/bucket/RLS infrastructure — those stay exactly as built in the prior US6 commit (`43e24b0`).

---

### Task 1: Add required `reason` to the `sick_leave` schema

**Files:**
- Modify: `src/schemas/hr/sick-leave.ts`
- Test: `tests/unit/hr/sick-leave-schema.test.ts` (new)

**Interfaces:**
- Produces: `sickLeaveSchema` now requires `reason: string` (min length 1); `SickLeaveInput` type gains `reason: string`. Consumed by `src/lib/domain/hr-forms.ts` (Task 2) and `src/services/hr-request.service.ts`'s existing `leaveFamilyPayload()` (no changes needed there — it already reads `input.reason` generically).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/hr/sick-leave-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sickLeaveSchema } from "@/schemas/hr/sick-leave";

describe("sickLeaveSchema", () => {
  const validBase = {
    requestType: "sick_leave" as const,
    startDate: "2026-11-17",
    endDate: "2026-11-17",
    dayPart: "full" as const,
  };

  it("rejects a submission with no reason", () => {
    const result = sickLeaveSchema.safeParse(validBase);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("reason"))).toBe(true);
    }
  });

  it("rejects an empty-string reason", () => {
    const result = sickLeaveSchema.safeParse({ ...validBase, reason: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a submission with a non-empty reason", () => {
    const result = sickLeaveSchema.safeParse({ ...validBase, reason: "Sốt cao, có hẹn khám bác sĩ" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("Sốt cao, có hẹn khám bác sĩ");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hr/sick-leave-schema.test.ts`
Expected: FAIL — `reason` is not in the parsed shape yet (the "no reason" test currently passes since the field doesn't exist, but the "accepts a submission with reason" test fails because `result.data.reason` is `undefined`, not the passed string, OR because zod strips unknown keys silently — either way the third assertion fails).

- [ ] **Step 3: Modify the schema**

Replace the full contents of `src/schemas/hr/sick-leave.ts`:

```typescript
import { z } from "zod";
import { LEAVE_DAY_PARTS } from "@/lib/data/types";
import { coversFieldSchema } from "@/schemas/hr/cover";

/**
 * Type-specific schema for `sick_leave` (US5, T046; data-model §10). Same leave-family core as
 * `annual_leave` (start/end/day_part promoted columns, conflict-scoped via `covers`), plus a
 * required free-text `reason` — sick leave no longer requires an uploaded document (superseded
 * FR-031: a typed explanation replaces mandatory documentation for this type). `reason` is stored
 * in `payload`, same as `personal_leave`/`unpaid_leave` (data-model §10).
 * Never draws the annual-leave balance (FR-007/FR-014) — the FormDefinition's `sideEffect: "none"`
 * enforces that, not this schema.
 */
export const sickLeaveSchema = z
  .object({
    requestType: z.literal("sick_leave"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    dayPart: z.enum(LEAVE_DAY_PARTS, { message: "Buổi nghỉ không hợp lệ" }).default("full"),
    reason: z.string().min(1, "Vui lòng nhập lý do nghỉ ốm"),
    covers: coversFieldSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type SickLeaveInput = z.infer<typeof sickLeaveSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hr/sick-leave-schema.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/schemas/hr/sick-leave.ts tests/unit/hr/sick-leave-schema.test.ts
git commit -m "feat(hr): require a text reason on sick_leave submissions"
```

---

### Task 2: Update the `sick_leave` FormDefinition — text field instead of document requirement

**Files:**
- Modify: `src/lib/domain/hr-forms.ts:111-126`

**Interfaces:**
- Consumes: nothing new (reads `sickLeaveSchema` from Task 1, already imported).
- Produces: `HR_FORM_REGISTRY.sick_leave.requiresDocument` becomes `false`; `fields` gains a `reason` textarea entry. No other file reads `requiresDocument` at runtime today (verified: only comments reference it elsewhere), so this is a metadata-only, non-breaking change.

- [ ] **Step 1: Modify the registry entry**

In `src/lib/domain/hr-forms.ts`, replace the `sick_leave` block (currently lines 111-126):

```typescript
// ── sick_leave (US5, T047) ──────────────────────────────────────────────────────
HR_FORM_REGISTRY.sick_leave = {
  type: "sick_leave",
  fields: [
    { name: "startDate", kind: "date", labelKey: "hr.sickLeave.startDate", required: true },
    { name: "endDate", kind: "date", labelKey: "hr.sickLeave.endDate", required: true },
    { name: "dayPart", kind: "select", labelKey: "hr.sickLeave.dayPart", options: LEAVE_DAY_PARTS },
    { name: "reason", kind: "textarea", labelKey: "hr.sickLeave.reason", required: true },
  ],
  schema: sickLeaveSchema,
  // A typed reason replaces the mandatory-attachment requirement (superseded FR-031) — sick_leave
  // no longer has upload capability at all; doc_type_policy carries no row for this type (seed.sql).
  requiresDocument: false,
  isMoneyForm: false,
  sideEffect: "none", // FR-007/FR-014: sick leave never draws the annual-leave balance.
  conflictScoped: true, // Same leave-family cover requirement as annual_leave.
};
```

- [ ] **Step 2: Verify no other code path depends on the old shape**

Run: `npx tsc --noEmit`
Expected: no errors (this is a metadata-only change to a `Partial<Record<...>>` registry entry; no consumer destructures `fields` or `requiresDocument` in a way that would break from this edit — confirmed by prior grep showing zero runtime reads of `requiresDocument`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/domain/hr-forms.ts
git commit -m "feat(hr): sick_leave FormDefinition drops document requirement, adds reason field"
```

---

### Task 3: Fix `us5-forms.test.ts`'s `sick_leave` probe — add the now-required `reason`

**Why this task exists:** `submitRequestCore` (`src/services/hr-request.service.ts`) calls `getFormDefinition(type).schema.parse(...)` internally — once Task 2 lands, `HR_FORM_REGISTRY.sick_leave.schema` is `sickLeaveSchema`, which now requires `reason` (Task 1). `tests/integration/hr/us5-forms.test.ts`'s first test ("submits sick_leave with a date range + day_part...") calls `submitRequestCore` with a `sick_leave` payload that has no `reason` field and casts the whole object `as never` to bypass compile-time checking — this test will start failing with a Zod validation error the moment Task 2's commit lands, even though nothing in Task 2's own diff touches this test file. Caught by the Task 1 reviewer as a ⚠️ cross-task item; fixing it now (right after Task 2, the commit that actually breaks it) keeps the branch green at every commit boundary, not just at the end.

**Files:**
- Modify: `tests/integration/hr/us5-forms.test.ts:27-51`

**Interfaces:**
- Consumes: `submitRequestCore` (unchanged signature), `sickLeaveSchema` (Task 1 — now requires `reason: string`).
- Produces: no new interfaces — this task only updates test fixture data to satisfy Task 1's new required field, so the existing "submits sick_leave..." test keeps proving exactly what it proved before (a valid sick_leave submission succeeds, an invalid one is rejected), just with a `reason` value present so the submission is valid under the NEW schema.

- [ ] **Step 1: Update the test's live submission call and its boundary-validation assertion**

The current test (`tests/integration/hr/us5-forms.test.ts:27-51`):

```typescript
  it("submits sick_leave with a date range + day_part; validation rejects a missing range", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-11-03", // Tuesday — teacher.q1 has no class this weekday (seed: Mon/Wed only)
      endDate: "2026-11-03",
      dayPart: "full",
    } as never);

    try {
      expect(request.status).toBe("pending");
      expect(request.requestType).toBe("sick_leave");
      expect(request.workingDays).toBe(1);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }

    // Boundary (Zod) validation — matches convention (unit-level schema tests elsewhere).
    expect(() =>
      sickLeaveSchema.parse({ requestType: "sick_leave", startDate: "", endDate: "2026-11-03", dayPart: "full" }),
    ).toThrow();
  });
```

Replace with (adds `reason` to the live submission so it satisfies the now-required field, and adds `reason` to the boundary-validation object too — that assertion is specifically testing the missing-date-range rejection, not the missing-reason rejection, so it must supply a valid `reason` to isolate what it's actually probing; `tests/unit/hr/sick-leave-schema.test.ts` from Task 1 already covers the missing-reason case directly):

```typescript
  it("submits sick_leave with a date range + day_part + reason; validation rejects a missing range", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");
    const svc = serviceRoleClient();

    const request = await submitRequestCore(client, claims, {
      requestType: "sick_leave",
      startDate: "2026-11-03", // Tuesday — teacher.q1 has no class this weekday (seed: Mon/Wed only)
      endDate: "2026-11-03",
      dayPart: "full",
      reason: "Sốt cao",
    } as never);

    try {
      expect(request.status).toBe("pending");
      expect(request.requestType).toBe("sick_leave");
      expect(request.workingDays).toBe(1);
    } finally {
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }

    // Boundary (Zod) validation — matches convention (unit-level schema tests elsewhere). `reason` is
    // supplied here so this assertion isolates the missing-date-range rejection specifically; the
    // missing-reason rejection is already covered by tests/unit/hr/sick-leave-schema.test.ts (Task 1).
    expect(() =>
      sickLeaveSchema.parse({
        requestType: "sick_leave",
        startDate: "",
        endDate: "2026-11-03",
        dayPart: "full",
        reason: "Sốt cao",
      }),
    ).toThrow();
  });
```

- [ ] **Step 2: Run the test**

Requires the local Supabase stack running (`npm run db:start` if not already up). Run: `npx vitest run tests/integration/hr/us5-forms.test.ts`
Expected: PASS (all tests in the file, not just the sick_leave one — confirm no other test in this file was already broken by Task 1/2's changes; the plan's earlier review already checked `personal_leave`/`unpaid_leave`/`overtime`/money-form tests in this same file are unaffected since they don't touch `sick_leave`).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/hr/us5-forms.test.ts
git commit -m "test(hr): add required reason to us5-forms.test.ts's sick_leave probe"
```

---

### Task 4: Remove `sick_leave`'s mandatory-attachment policy from seed config

**Files:**
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces: `doc_type_policy` has no row for `request_type = 'sick_leave'`. `attachment.service.ts`'s `getDocTypePolicy()` (unchanged) will return `null` for `sick_leave`, which `uploadAttachmentCore` already turns into `throw new DomainError("Loại yêu cầu này không được phép đính kèm tài liệu")` — this is the exact "no upload capability" behavior wanted, achieved with zero service-code changes.

- [ ] **Step 1: Remove the `sick_leave` row from the seed insert**

In `supabase/seed.sql`, find the block (from the earlier repo read):

```sql
-- ── Attachment policy per request type ────────────────────────────────────────
insert into public.doc_type_policy (id, request_type, max_size_bytes, allowed_mime, required) values
  ('40000000-0000-4000-8000-0000000000c1', 'sick_leave', 10485760,
   '{application/pdf,image/png,image/jpeg}', true),
  ('40000000-0000-4000-8000-0000000000c2', 'personal_leave', 10485760,
   '{application/pdf,image/png,image/jpeg}', false)
on conflict (request_type) do nothing;
```

Replace with:

```sql
-- ── Attachment policy per request type ────────────────────────────────────────
-- sick_leave carries no row: a typed reason (schema-required) replaces mandatory documentation for
-- this type; getDocTypePolicy() returning null makes uploadAttachmentCore reject any upload attempt
-- with a clear Vietnamese DomainError, so no upload capability exists for sick_leave at all.
insert into public.doc_type_policy (id, request_type, max_size_bytes, allowed_mime, required) values
  ('40000000-0000-4000-8000-0000000000c2', 'personal_leave', 10485760,
   '{application/pdf,image/png,image/jpeg}', false)
on conflict (request_type) do nothing;
```

- [ ] **Step 2: Reset the local DB to apply the seed change**

Run: `npm run db:reset`
Expected: completes without error; re-applies all migrations and the updated seed.

- [ ] **Step 3: Verify via a live query**

Run: `npx supabase db execute --local --sql "select request_type, required from public.doc_type_policy order by request_type;"` (or use the Supabase Studio SQL editor at the local stack's URL)
Expected: only `personal_leave` appears, `required = false`. No `sick_leave` row.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(hr): drop sick_leave attachment policy from seed — no upload capability"
```

---

### Task 5: Update `LeaveFamilyForm.tsx` — show reason for sick_leave, remove its upload field

**Files:**
- Modify: `src/app/(app)/yeu-cau/LeaveFamilyForm.tsx`

**Interfaces:**
- Consumes: `useSubmitRequest` (unchanged), no longer calls `useUploadAttachment` for the `sick_leave` path (still used for `personal_leave` when `showsDocumentField` is true for that type).
- Produces: form now submits `reason` for `sick_leave` (required, blocked by native HTML `required` + the server-side zod check); no file picker renders for `sick_leave`.

- [ ] **Step 1: Update the reason field visibility (remove the sick_leave exclusion)**

In `src/app/(app)/yeu-cau/LeaveFamilyForm.tsx`, the current block (lines 123-127):

```tsx
      {requestType !== "sick_leave" && (
        <Field label="Lý do">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border px-2 py-1" />
        </Field>
      )}
```

Replace with (reason is now shown for all three leave-family types on this form, and required specifically for `sick_leave`):

```tsx
      <Field label={requestType === "sick_leave" ? "Lý do nghỉ ốm" : "Lý do"}>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required={requestType === "sick_leave"}
          className="rounded border px-2 py-1"
        />
      </Field>
```

- [ ] **Step 2: Update `showsDocumentField` — sick_leave no longer shows the file picker**

The current line 45:

```tsx
  const showsDocumentField = requestType === "sick_leave" || (requestType === "personal_leave" && event !== "other");
```

Replace with:

```tsx
  const showsDocumentField = requestType === "personal_leave" && event !== "other";
```

- [ ] **Step 3: Update the submit call — sick_leave now sends `reason`**

The current submit block (lines 62-70):

```tsx
      const base = { startDate, endDate, dayPart, covers };
      let created;
      if (requestType === "personal_leave") {
        created = await submitRequest.mutateAsync({ requestType, ...base, event, reason: reason || undefined });
      } else if (requestType === "unpaid_leave") {
        created = await submitRequest.mutateAsync({ requestType, ...base, reason: reason || undefined });
      } else {
        created = await submitRequest.mutateAsync({ requestType, ...base });
      }
```

Replace with (the `else` branch, previously only `annual_leave`, is now unreachable for `sick_leave` since it's folded into its own branch — `annual_leave` is handled elsewhere, this component only ever receives `"sick_leave" | "personal_leave" | "unpaid_leave"` per its own prop type):

```tsx
      const base = { startDate, endDate, dayPart, covers };
      let created;
      if (requestType === "personal_leave") {
        created = await submitRequest.mutateAsync({ requestType, ...base, event, reason: reason || undefined });
      } else {
        // sick_leave (schema-required) and unpaid_leave (schema-optional) both take `reason` raw here
        // rather than `reason || undefined`: unpaid_leave's zod field is `z.string().optional()`, so
        // an empty string is a valid parse, and `leaveFamilyPayload`'s `if (input.reason) ...` check
        // is falsy for "" exactly the same as for undefined — payload.reason ends up omitted either
        // way for an unpaid_leave submitted with no reason typed. No behavior change from before.
        created = await submitRequest.mutateAsync({ requestType, ...base, reason });
      }
```

- [ ] **Step 4: Update the stale doc comment at the top of the file**

The current header comment (lines 16-22):

```tsx
/**
 * US5 (T049): shared form for the three non-annual leave-family types (sick/personal/unpaid) — same
 * date-range + day-part + cover-picker shape as AnnualLeaveForm (US1/US4), minus the balance display
 * (none of these draw the annual-leave balance, FR-007/FR-014). `personal_leave` additionally shows
 * the statutory event picker (data-model §10); sick leave's documentation requirement (FR-031) has
 * no upload UI yet — that is US6 — so this form only submits the leave itself.
 */
```

Replace with:

```tsx
/**
 * US5 (T049): shared form for the three non-annual leave-family types (sick/personal/unpaid) — same
 * date-range + day-part + cover-picker shape as AnnualLeaveForm (US1/US4), minus the balance display
 * (none of these draw the annual-leave balance, FR-007/FR-014). `personal_leave` additionally shows
 * the statutory event picker (data-model §10) and its optional attachment upload for the three
 * statutory events. `sick_leave` requires a typed `reason` instead of a document (superseded
 * FR-031) — no upload UI is shown for it.
 */
```

- [ ] **Step 5: Also update the now-stale comment above `showsDocumentField`**

The current comment (lines 39-45):

```tsx
  // US6 (T054): sick_leave always requires documentation (FormDefinition.requiresDocument = true);
  // personal_leave requires it for the three statutory events, not for `other` (FormDefinition's
  // own event-conditioned predicate — this UI mirrors it as a nudge, not a hard submit-time block,
  // per the chicken/egg note in hr-forms.ts/attachment.service.ts: the request row must exist
  // before a document can be attached to it, so the file is uploaded as a FOLLOW-UP call after
  // submission succeeds, never blocking the submit itself).
```

Replace with:

```tsx
  // personal_leave shows the optional attachment picker for the three statutory events (marriage/
  // bereavement), not for `other` (FormDefinition's own event-conditioned predicate — this UI
  // mirrors it as a nudge, not a hard submit-time block, per the chicken/egg note in
  // hr-forms.ts/attachment.service.ts: the request row must exist before a document can be attached
  // to it, so the file is uploaded as a FOLLOW-UP call after submission succeeds). sick_leave has no
  // attachment capability at all — a required typed `reason` replaces documentation for that type.
```

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass clean.

- [ ] **Step 7: Manual smoke test**

Run: `npm run db:start` (if not already running), then `npm run dev`. Navigate to the HR requests page (`/yeu-cau`), select "Nghỉ ốm" (sick leave). Confirm:
- A "Lý do nghỉ ốm" text input appears (not a file picker).
- Submitting with the reason field empty is blocked by the browser (native `required`).
- Submitting with a reason filled in succeeds.
- Switching to "Nghỉ việc riêng" (personal leave) with a statutory event still shows the file picker as before.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/yeu-cau/LeaveFamilyForm.tsx
git commit -m "feat(hr): sick_leave form shows required reason field, drops upload picker"
```

---

### Task 6: Repoint the US6 attachment tests from `sick_leave` to `personal_leave`

**Files:**
- Modify: `tests/integration/hr/us6-upload.test.ts`
- Modify: `tests/integration/hr/us6-confidentiality.test.ts`

**Interfaces:**
- Consumes: `submitRequestCore`, `uploadAttachmentCore`, `getAttachmentSignedUrlCore` (all unchanged signatures). `personal_leave` requires an `event` field (one of `PERSONAL_LEAVE_EVENTS`) that `sick_leave` didn't — tests must supply one of the three statutory events (`marriage_self`, `marriage_child`, `bereavement`) so `doc_type_policy` lookup for `personal_leave` still succeeds (using `other` would still work since the policy row itself isn't event-conditioned, but a statutory event keeps the fixture realistic).
- Produces: both test files keep proving the exact same attachment/confidentiality behaviors (byte-sniffing, size limits, RLS, signed URLs), now exercised via `personal_leave` instead of `sick_leave`. No change to what is being proven — only which request type is used as the vehicle, since `sick_leave` no longer has any attachment capability to test.

- [ ] **Step 1: Update `us6-upload.test.ts`'s header comment and every `submitRequestCore` call**

Replace the full contents of `tests/integration/hr/us6-upload.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { submitRequestCore } from "@/services/hr-request.service";
import { uploadAttachmentCore } from "@/services/attachment.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError, ForbiddenError } from "@/lib/server-action";
import { serviceRoleClient } from "../../helpers/auth";
import { hrClientFor, samplePdfBytes, HR_SEED } from "./_setup";

/**
 * US6 (T051): upload validation. `personal_leave` (statutory event) is the test vehicle for the
 * generic attachment-upload behaviors proven here — `sick_leave` no longer has attachment capability
 * at all (a required typed `reason` replaces it, superseding FR-031); `personal_leave`'s attachment
 * remains optional per its own event-conditioned `requiresDocument` predicate (hr-forms.ts), which is
 * exactly why "submitting without an attachment still succeeds" below is true for it too.
 */
describe("hr US6: attachment upload validation (T051)", () => {
  const svc = serviceRoleClient();
  const createdRequestIds: string[] = [];

  afterEach(async () => {
    for (const id of createdRequestIds.splice(0)) {
      await svc.from("request_attachment").delete().eq("request_id", id);
      await svc.from("hr_request").update({ status: "cancelled" }).eq("id", id);
    }
  });

  it("submitting personal_leave WITHOUT an attachment still succeeds (optional documentation)", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "personal_leave",
      startDate: "2026-11-17", // Tuesday — no class this weekday for teacher.q1 (seed: Mon/Wed)
      endDate: "2026-11-17",
      dayPart: "full",
      event: "marriage_self",
    } as never);
    createdRequestIds.push(request.id);

    expect(request.status).toBe("pending");
    expect(request.hasAttachment).toBe(false);
  });

  it("uploading a valid PDF within the size limit succeeds and creates a request_attachment row", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "personal_leave",
      startDate: "2026-11-24",
      endDate: "2026-11-24",
      dayPart: "full",
      event: "marriage_self",
    } as never);
    createdRequestIds.push(request.id);

    const attachment = await uploadAttachmentCore(client, svc, claims, {
      requestId: request.id,
      fileName: "medical.pdf",
      declaredContentType: "application/pdf",
      bytes: samplePdfBytes(),
    });

    expect(attachment.requestId).toBe(request.id);
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.sizeBytes).toBe(samplePdfBytes().byteLength);

    const { data: row } = await svc
      .from("request_attachment")
      .select("id")
      .eq("request_id", request.id)
      .maybeSingle();
    expect(row).not.toBeNull();
  });

  it("rejects an oversized file with a Vietnamese message (byte-level size check)", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "personal_leave",
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      dayPart: "full",
      event: "marriage_self",
    } as never);
    createdRequestIds.push(request.id);

    // doc_type_policy seeds personal_leave at max_size_bytes = 10485760 (10 MiB) — build an oversized
    // buffer with a valid PDF magic-byte prefix so the failure is genuinely about SIZE, not MIME.
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(samplePdfBytes());

    await expect(
      uploadAttachmentCore(client, svc, claims, {
        requestId: request.id,
        fileName: "too-big.pdf",
        declaredContentType: "application/pdf",
        bytes: oversized,
      }),
    ).rejects.toThrow(/dung lượng/);
  });

  it("rejects a disallowed MIME type via real byte-level sniff, even with a spoofed declared type", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "personal_leave",
      startDate: "2026-12-08",
      endDate: "2026-12-08",
      dayPart: "full",
      event: "marriage_self",
    } as never);
    createdRequestIds.push(request.id);

    // A plain-text buffer, declared (falsely) as a PDF — the real sniff must catch this.
    const bytes = new TextEncoder().encode("this is not a pdf, png, or jpeg");

    await expect(
      uploadAttachmentCore(client, svc, claims, {
        requestId: request.id,
        fileName: "fake.pdf",
        declaredContentType: "application/pdf",
        bytes,
      }),
    ).rejects.toThrow(DomainError);
  });

  it("rejects attaching to a request that is NOT the caller's own", async () => {
    // sale.q1's seeded personal_leave request must exist for this — see Task 6 Step 3 below, which
    // extends HR_SEED with `requestPersonalLeave`. teacher.q1 (same centre, different submitter)
    // must not attach to it. RLS's own restricted-read policy (hr_request_select_scoped) already
    // hides the row from a non-submitter/non-approver peer, so `getVisibleRequest` sees nothing and
    // the service raises a not-found DomainError rather than reaching the "is this your own request"
    // branch — belt-and-suspenders: the row is invisible AND, even if it were visible,
    // uploadAttachmentCore's own submitter_id check would still reject it (ForbiddenError) for
    // anyone who isn't the submitter.
    const teacherClient = await hrClientFor("teacherQ1");
    const claims = await assertPermission(teacherClient, "hrRequest.submit");

    await expect(
      uploadAttachmentCore(teacherClient, svc, claims, {
        requestId: HR_SEED.requestPersonalLeave,
        fileName: "medical.pdf",
        declaredContentType: "application/pdf",
        bytes: samplePdfBytes(),
      }),
    ).rejects.toThrow(DomainError);
  });

  it("rejects a non-submitter who CAN see the row (centre_manager, approver) from uploading to it", async () => {
    // manager.q1 CAN see sale.q1's request via RLS (centre_manager read scope), so this exercises
    // the ForbiddenError branch specifically (getVisibleRequest succeeds; submitter_id check fails).
    const managerClient = await hrClientFor("managerQ1");
    const claims = await assertPermission(managerClient, "hrRequest.submit");

    await expect(
      uploadAttachmentCore(managerClient, svc, claims, {
        requestId: HR_SEED.requestPersonalLeave,
        fileName: "medical.pdf",
        declaredContentType: "application/pdf",
        bytes: samplePdfBytes(),
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Add `requestPersonalLeave` to the `HR_SEED` fixture and seed a row for it**

In `tests/integration/hr/_setup.ts`, the current `HR_SEED` object:

```typescript
export const HR_SEED = {
  leaveYear: 2026,
  policyConfigId: "40000000-0000-4000-8000-000000000001",
  classQ1Foundation: "40000000-0000-4000-8000-0000000000d1", // teacher.q1, Monday 18:00-20:00
  classQ1Intermediate: "40000000-0000-4000-8000-0000000000d2", // teacher.q1, Wednesday 18:00-20:00
  classQ3: "40000000-0000-4000-8000-0000000000d3",
  classQ1Teacher2: "40000000-0000-4000-8000-0000000000d4", // teacher2.q1, Tuesday 18:00-20:00
  balanceTeacherQ1: "40000000-0000-4000-8000-0000000000e1",
  balanceSaleQ1: "40000000-0000-4000-8000-0000000000e2",
  requestAnnualLeave: "40000000-0000-4000-8000-0000000000f1", // teacher.q1, pending
  requestSickLeave: "40000000-0000-4000-8000-0000000000f2", // sale.q1, pending
  requestSalaryAdvance: "40000000-0000-4000-8000-0000000000f3", // sale.q1, pending (amount)
} as const;
```

Add a `requestPersonalLeave` entry (keep `requestSickLeave` — still valid, `sick_leave` requests still exist, they just carry a `reason` now instead of attachment capability; other tests may still reference it):

```typescript
export const HR_SEED = {
  leaveYear: 2026,
  policyConfigId: "40000000-0000-4000-8000-000000000001",
  classQ1Foundation: "40000000-0000-4000-8000-0000000000d1", // teacher.q1, Monday 18:00-20:00
  classQ1Intermediate: "40000000-0000-4000-8000-0000000000d2", // teacher.q1, Wednesday 18:00-20:00
  classQ3: "40000000-0000-4000-8000-0000000000d3",
  classQ1Teacher2: "40000000-0000-4000-8000-0000000000d4", // teacher2.q1, Tuesday 18:00-20:00
  balanceTeacherQ1: "40000000-0000-4000-8000-0000000000e1",
  balanceSaleQ1: "40000000-0000-4000-8000-0000000000e2",
  requestAnnualLeave: "40000000-0000-4000-8000-0000000000f1", // teacher.q1, pending
  requestSickLeave: "40000000-0000-4000-8000-0000000000f2", // sale.q1, pending
  requestSalaryAdvance: "40000000-0000-4000-8000-0000000000f3", // sale.q1, pending (amount)
  requestPersonalLeave: "40000000-0000-4000-8000-0000000000f4", // sale.q1, pending (US6 attachment test vehicle)
} as const;
```

- [ ] **Step 3: Add the seed row for `requestPersonalLeave` in `supabase/seed.sql`**

The existing `hr_request` seed block (around line 172-195) is a `do $$ ... $$` loop over a JSONB array (`v_requests`), where every row is inserted with a hardcoded `payload: '{}'::jsonb` — the loop's record type has no `payload`-carrying fields today. Adding a fourth JSON entry alone is not enough; the loop body must also thread through an `event`/`reason` pair for the new `personal_leave` row while leaving the other three rows' `payload` as `'{}'::jsonb` exactly as before.

Find this exact block:

```sql
-- ── Sample requests (each with its initial from_status=null history row — §V invariant) ──
do $$
declare
  r record;
  v_requests jsonb := '[
    {"id":"40000000-0000-4000-8000-0000000000f1","type":"annual_leave","submitter":"10000000-0000-4000-8000-000000000006","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":"2026-08-10","end":"2026-08-11","day_part":"full","working_days":2,"amount":null},
    {"id":"40000000-0000-4000-8000-0000000000f2","type":"sick_leave","submitter":"10000000-0000-4000-8000-000000000004","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":"2026-07-20","end":"2026-07-20","day_part":"full","working_days":null,"amount":null},
    {"id":"40000000-0000-4000-8000-0000000000f3","type":"salary_advance","submitter":"10000000-0000-4000-8000-000000000004","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":null,"end":null,"day_part":null,"working_days":null,"amount":5000000}
  ]'::jsonb;
begin
  for r in select * from jsonb_to_recordset(v_requests) as x(
    id uuid, type text, submitter uuid, centre uuid, status text,
    start date, "end" date, day_part text, working_days numeric, amount numeric
  )
  loop
    insert into public.hr_request (
      id, request_type, submitter_id, centre_id, status, start_date, end_date, day_part,
      working_days, amount, payload
    ) values (
      r.id, r.type, r.submitter, r.centre, r.status, r.start, r."end", r.day_part,
      r.working_days, r.amount, '{}'::jsonb
    ) on conflict (id) do nothing;

    insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by)
    select r.id, null, r.status, r.submitter
    where not exists (select 1 from public.hr_request_status_history where request_id = r.id);
  end loop;
end $$;
```

Replace it with (adds a `payload` field to the JSON array — defaulting to `{}` for the three existing rows, and a real `event`/`reason` object for the new `personal_leave` row — and threads it through the record type and INSERT):

```sql
-- ── Sample requests (each with its initial from_status=null history row — §V invariant) ──
do $$
declare
  r record;
  v_requests jsonb := '[
    {"id":"40000000-0000-4000-8000-0000000000f1","type":"annual_leave","submitter":"10000000-0000-4000-8000-000000000006","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":"2026-08-10","end":"2026-08-11","day_part":"full","working_days":2,"amount":null,"payload":{}},
    {"id":"40000000-0000-4000-8000-0000000000f2","type":"sick_leave","submitter":"10000000-0000-4000-8000-000000000004","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":"2026-07-20","end":"2026-07-20","day_part":"full","working_days":null,"amount":null,"payload":{}},
    {"id":"40000000-0000-4000-8000-0000000000f3","type":"salary_advance","submitter":"10000000-0000-4000-8000-000000000004","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":null,"end":null,"day_part":null,"working_days":null,"amount":5000000,"payload":{}},
    {"id":"40000000-0000-4000-8000-0000000000f4","type":"personal_leave","submitter":"10000000-0000-4000-8000-000000000004","centre":"00000000-0000-4000-8000-000000000001","status":"pending","start":"2026-07-21","end":"2026-07-21","day_part":"full","working_days":null,"amount":null,"payload":{"event":"marriage_self","reason":"seed fixture"}}
  ]'::jsonb;
begin
  for r in select * from jsonb_to_recordset(v_requests) as x(
    id uuid, type text, submitter uuid, centre uuid, status text,
    start date, "end" date, day_part text, working_days numeric, amount numeric, payload jsonb
  )
  loop
    insert into public.hr_request (
      id, request_type, submitter_id, centre_id, status, start_date, end_date, day_part,
      working_days, amount, payload
    ) values (
      r.id, r.type, r.submitter, r.centre, r.status, r.start, r."end", r.day_part,
      r.working_days, r.amount, r.payload
    ) on conflict (id) do nothing;

    insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by)
    select r.id, null, r.status, r.submitter
    where not exists (select 1 from public.hr_request_status_history where request_id = r.id);
  end loop;
end $$;
```

Note: `submitter 10000000-0000-4000-8000-000000000004` is `sale.q1` (confirmed against the employee-seed block), matching the existing `requestSickLeave`/`requestSalaryAdvance` rows' submitter — consistent with the comment `sale.q1, pending` used for sibling fixture entries in `HR_SEED`.

- [ ] **Step 4: Reset the local DB**

Run: `npm run db:reset`
Expected: completes without error.

- [ ] **Step 5: Update `us6-confidentiality.test.ts` to use `personal_leave`**

Replace every occurrence of `HR_SEED.requestSickLeave` with `HR_SEED.requestPersonalLeave` in `tests/integration/hr/us6-confidentiality.test.ts` (7 occurrences: lines 44, 47, 57, 64, 74, 97, 106, 121 in the original — search-and-replace all). Also update the file's header comment (lines 9-27) to say "attached to `HR_SEED.requestPersonalLeave` (sale.q1's personal_leave request, centre Q1)" instead of "sick_leave request", and update the two per-test comments at lines 12 ("Uploads a REAL medical document...") and the `it` description at line 51 similarly — replace "sick_leave" with "personal_leave" in prose.

- [ ] **Step 6: Run both test files**

Run: `npx vitest run tests/integration/hr/us6-upload.test.ts tests/integration/hr/us6-confidentiality.test.ts`
Expected: all tests PASS (requires local Supabase running: `npm run db:start` first if not already).

- [ ] **Step 7: Commit**

```bash
git add tests/integration/hr/us6-upload.test.ts tests/integration/hr/us6-confidentiality.test.ts tests/integration/hr/_setup.ts supabase/seed.sql
git commit -m "test(hr): repoint US6 attachment tests to personal_leave (sick_leave has no upload capability)"
```

---

### Task 7: Fix `getAttachmentSignedUrlCore`'s RLS-shadowed `ForbiddenError` (found during Task 6)

**Why this task exists:** Task 6's implementer discovered that 2 of 10 tests in `tests/integration/hr/us6-confidentiality.test.ts` fail — not because of anything Task 6 changed, but because of a genuinely pre-existing bug in `src/services/attachment.service.ts` that predates this whole plan (confirmed present, unchanged, in the original commit that introduced this file). `getAttachmentSignedUrlCore` fetches the `request_attachment` row using the CALLER's own RLS-scoped `supabase` client rather than the `serviceClient` used two lines below for the sibling `hr_request` lookup. Because `request_attachment`'s own RLS SELECT policy (`attachment_select_scoped`, `supabase/migrations/20260717130003_hr_rls.sql`) is functionally identical to the app-layer eligibility check that runs after the fetch, an ineligible caller's RLS-scoped query silently returns nothing — so the code takes the generic "not found" `DomainError` branch instead of ever reaching the `ForbiddenError` branch below it. The document itself stays protected either way (no unauthorized caller can view it), but the specific error type is wrong, which is both a real API/contract bug and the reason two tests fail.

**Files:**
- Modify: `src/services/attachment.service.ts:176-183`

**Interfaces:**
- Consumes: `serviceClient` (already a parameter of `getAttachmentSignedUrlCore`, already used two lines below this fix for the `hr_request` lookup — no new parameter needed).
- Produces: no interface change — `getAttachmentSignedUrlCore`'s signature, return type, and error-throwing contract (`DomainError` for genuinely-missing rows, `ForbiddenError` for ineligible-but-existing rows) stay the same; this fix makes the function's actual behavior match its already-documented intent (the function's own docstring already says the app-layer check is "the real security gate," which requires it to actually run against real data, not RLS-filtered data).

- [ ] **Step 1: Confirm the two currently-failing tests reproduce**

Requires the local Supabase stack running (`npm run db:start` if not already up) and the DB reset from Task 6 already applied (it is, as of Task 6's commit). Run: `npx vitest run tests/integration/hr/us6-confidentiality.test.ts`
Expected: FAIL — exactly 2 failures, both `AssertionError: expected error to be instance of ForbiddenError` with a `DomainError` "Không tìm thấy tài liệu đính kèm cho yêu cầu này" received instead, at the two `.rejects.toThrow(ForbiddenError)` assertions (currently around lines 99 and 123 — confirm exact line numbers when you open the file, since Task 6's edits may have shifted them slightly from what's cited here).

- [ ] **Step 2: Fix the fetch to use `serviceClient`**

In `src/services/attachment.service.ts`, the current `getAttachmentSignedUrlCore` function body opens with:

```typescript
export async function getAttachmentSignedUrlCore(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  claims: Claims,
  requestId: string,
): Promise<string> {
  const { data: attachment, error: attachmentError } = await supabase
    .from("request_attachment")
    .select("storage_path, uploaded_by, request_id")
    .eq("request_id", requestId)
    .maybeSingle();
  if (attachmentError) throw attachmentError;

  // Resolve the owning request's centre via the SERVICE-ROLE client (not the caller's RLS-scoped
  // client) — a peer must be told "not eligible", not silently given a false-negative "not found"
  // that would otherwise leak which requests carry an attachment via response-shape differences.
  const { data: request, error: requestError } = await serviceClient
    .from("hr_request")
    .select("centre_id")
    .eq("id", requestId)
    .maybeSingle();
```

Replace the `attachment` fetch to also use `serviceClient` instead of `supabase`, and extend the existing comment (which already explains this exact rationale for the `hr_request` lookup) to cover both queries, since the reasoning is identical for both:

```typescript
export async function getAttachmentSignedUrlCore(
  supabase: SupabaseClient,
  serviceClient: SupabaseClient,
  claims: Claims,
  requestId: string,
): Promise<string> {
  // Resolve BOTH the attachment row and the owning request's centre via the SERVICE-ROLE client (not
  // the caller's RLS-scoped `supabase` client) — a peer must be told "not eligible" (ForbiddenError),
  // not silently given a false-negative "not found" (DomainError) that would otherwise leak which
  // requests carry an attachment via response-shape differences. `request_attachment`'s own RLS SELECT
  // policy is functionally identical to the eligibility check below, so fetching it through the
  // caller's RLS-scoped client would make the ForbiddenError branch below unreachable for any
  // ineligible-but-RLS-blind caller — this is exactly the bug this comment/fix addresses.
  const { data: attachment, error: attachmentError } = await serviceClient
    .from("request_attachment")
    .select("storage_path, uploaded_by, request_id")
    .eq("request_id", requestId)
    .maybeSingle();
  if (attachmentError) throw attachmentError;

  const { data: request, error: requestError } = await serviceClient
    .from("hr_request")
    .select("centre_id")
    .eq("id", requestId)
    .maybeSingle();
```

The `supabase` parameter is still used elsewhere in this file (other exported functions in `attachment.service.ts` take it too) — do not remove it from the function signature even though this particular function body no longer reads from it directly; removing an unused parameter from one function in a multi-function file is out of scope here (and TypeScript won't error on an unused function parameter by default in this codebase's tsconfig — confirm this by running typecheck in Step 4 below, not by assuming).

- [ ] **Step 3: Re-run the previously-failing tests**

Run: `npx vitest run tests/integration/hr/us6-confidentiality.test.ts`
Expected: PASS — all 10 tests, including the two that failed in Step 1.

- [ ] **Step 4: Run the full HR test suite + typecheck to confirm no regression**

Run: `npx vitest run tests/integration/hr/ tests/unit/hr/` then `npx tsc --noEmit`
Expected: all HR tests pass (the RLS-tightening in Step 2 should not affect any OTHER test — the eligible-caller paths, i.e. uploader/approver/super_admin, were already using RLS-visible rows and are unaffected by switching to the service-role client, since the service-role client can see everything the RLS-scoped client could plus more). Typecheck should show zero errors related to this file (the pre-existing unrelated `resolveEmployeeId` import error was already fixed in Task 6, so at this point typecheck should be fully clean with no remaining known errors at all).

- [ ] **Step 5: Commit**

```bash
git add src/services/attachment.service.ts
git commit -m "fix(hr): getAttachmentSignedUrlCore reads request_attachment via service-role client, not RLS-scoped — restores unreachable ForbiddenError branch"
```

---

### Task 8: Update spec docs — FR-031 and data-model §10

**Files:**
- Modify: `specs/004-hr-requests/spec.md`
- Modify: `specs/004-hr-requests/data-model.md`

**Interfaces:** None — documentation only, no code interfaces affected.

- [ ] **Step 1: Update FR-031 in `spec.md`**

Current text (lines 413-414):

```markdown
- **FR-031**: The system MUST support a documentation attachment on sick leave and on personal-leave
  categories that require it, restricting accepted file types and enforcing a size limit.
```

Replace with:

```markdown
- **FR-031**: The system MUST support a documentation attachment on personal-leave categories that
  require it, restricting accepted file types and enforcing a size limit. Sick leave requires a
  free-text reason instead of a document attachment (superseded from the original "sick leave
  requires documentation" requirement — a typed explanation is the simplification adopted here).
```

- [ ] **Step 2: Update the data-model §10 table row for `sick_leave`**

Current row (line 275):

```markdown
| sick_leave | start/end/day_part | — | **required** (medical) | yes | none |
```

Replace with:

```markdown
| sick_leave | start/end/day_part | `reason` | no | yes | none |
```

- [ ] **Step 3: Commit**

```bash
git add specs/004-hr-requests/spec.md specs/004-hr-requests/data-model.md
git commit -m "docs(hr): update FR-031 and data-model §10 — sick_leave uses text reason, not documentation"
```

---

### Task 9: Full verification pass

**Files:** None modified — verification only.

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: no new errors (pre-existing warnings in unrelated files — `TargetEditor.tsx`, `RoadmapDocument.tsx`, `SummitDocument.tsx` — are not this task's concern).

- [ ] **Step 3: Full test suite**

Run: `npm run test`
Expected: all tests pass, including the full `tests/integration/hr/` and `tests/unit/hr/` directories.

- [ ] **Step 4: Manual smoke test recap**

Confirm via `npm run dev` (documented already in Task 5 Step 7): sick leave shows a required text reason and no file picker; personal leave's optional attachment flow is unchanged.
