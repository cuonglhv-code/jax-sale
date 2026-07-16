# Contract: DeliveryAdapter interface

The single injectable seam for delivering the roadmap PDF (spec FR-DELIVERY-01/02, AC-7.3). The
engine and UI depend ONLY on this interface — never on a concrete delivery mechanism. Swapping the
implementation (download+draft → server email) requires no engine or UI change.

```ts
export interface DeliveryPayload {
  studentName: string;
  studentEmail: string;
  pdf: Blob;                 // the rendered branded PDF
  bodyVi: string;            // Vietnamese-language accompanying message
  subjectVi: string;         // Vietnamese subject line
}

export type DeliveryResult =
  | { status: "delivered"; detail?: string }   // confirmed sent (future server adapter)
  | { status: "drafted"; detail?: string }     // PDF downloaded + mail draft opened (default)
  | { status: "failed"; detail: string };      // surfaced to the consultant in Vietnamese

export interface DeliveryAdapter {
  deliver(payload: DeliveryPayload): Promise<DeliveryResult>;
}
```

## Default implementation — `DownloadMailDraftAdapter` (this slice)

- Triggers a browser download of `payload.pdf` (filename derived from student name + date).
- Opens a pre-filled `mailto:` draft: `to = studentEmail`, `subject = subjectVi`, `body = bodyVi`
  (the body instructs the consultant to attach the just-downloaded PDF — `mailto:` cannot attach).
- Returns `{ status: "drafted" }`. Never claims a confirmed send.

## Future implementation — `ServerEmailAdapter` (deferred, same interface)

- Runs server-side; renders (or receives) the PDF, sends via a mail provider with the Vietnamese
  body, returns `{ status: "delivered" }` on provider success. Drops in with zero engine/UI change.

## Consumer contract

- The UI calls `adapter.deliver(...)` on approve; maps `DeliveryResult.status` → `RoadmapRecord.sent`
  (`delivered` ⇒ true; else false).
- `payload.bodyVi`/`subjectVi` come from the Vietnamese vocabulary/content store — never inline.
