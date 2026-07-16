# Contract: Delivery & Archive

The only network-touching surface in the feature (Constitution V). One server action performs
email + archive; the presentation path never imports anything from this contract.

## Server action: sendSummitRoadmap

Canonical mutation pipeline (house pattern): `withError(assertPermission → schema.parse →
service)`. Permission key: `roadmap.send`. Centre resolved from verified session claims —
never from the client.

```ts
// input (Zod-validated at the boundary — schemas/summit.ts)
{
  generationKey: string,        // idempotency: retry never duplicates archive or send
  capture: Capture,             // student/consultant contact details
  summitRoadmap: SummitRoadmap, // the single source, as reviewed
  pdfBytes: Base64,             // client-generated PDF — the exact reviewed document
}
// result (discriminated)
{ data: { sendId: string; deliveredTo: string } } | { error: string /* Vietnamese */ }
```

### Behaviour

1. Verify permission + claims; parse input.
2. Upload `pdfBytes` to Storage `roadmap-archive/<centre_id>/<sendId>.pdf` (private).
3. Insert `summit_sends` row (data-model schema) — on `generation_key` conflict, do nothing
   and return the existing send (idempotent retry).
4. Email the PDF to `capture.studentEmail` via the configured provider (env-validated at
   startup: provider key, sender address). Subject/body Vietnamese templates from content data.
5. Any step failing → the whole action returns `{ error }`; nothing partial is reported as
   success; the client keeps blob + state and offers retry (loud failure, work preserved).

### Provider seam

The client uses the 002 `DeliveryAdapter` interface. `EmailSendAdapter.deliver()` calls this
action; `DownloadMaildraftAdapter` (002) remains selectable as the failure fallback. Swapping
providers (Resend ↔ SMTP) is a server-side change only.

## Server action: listSentRoadmaps (academic audit)

`withError(assertPermission("roadmap.audit") → parse → service)`. Returns `Paginated<`row of
`summit_sends` + signed short-lived URL for `pdf_path`. Filters: centre, date range, placement
kind, ladder_edited. Read-only; no mutation surface.

## RLS (authoritative)

- `summit_sends`: INSERT — `centre_id = claims.centre_id`; SELECT — holders of the audit
  permission (network-wide read per house model); UPDATE/DELETE — none (immutable audit log).
- Storage `roadmap-archive`: write via service path only; read via audit permission (signed
  URLs); objects immutable.

## Tests (required)

- Permission gate rejects an unauthorized caller (both actions).
- Centre isolation: consultant of centre A cannot insert a row or object for centre B (real
  local DB, not mocked — house rule).
- Idempotency: same `generationKey` twice → one row, one object.
- Failure injection: provider error → `{ error }`, no `summit_sends` row marked delivered.
- Archive byte-identity: stored object equals the input `pdfBytes` (SC-003).
