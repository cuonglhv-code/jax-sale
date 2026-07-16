# Contract: Notifications & Scheduled Jobs (R6, R7)

Net-new seams — none exist in the foundation. Built to reuse the existing service pattern; **never**
fork it.

## Email (transactional, Vietnamese) — `notification.service.ts` via Resend + React Email

Sent from inside the `*Core` service, **after** the mutation + `write_audit_log`, in a `try/catch` that
logs and **never rethrows** — a failed email must not fail the business decision (mirrors the existing
non-fatal audit call). Synchronous `await`, no queue (low volume; R6).

| Trigger (FR-035/036) | Recipient | Template props (narrow — NO attachment/content) |
|---|---|---|
| Request submitted | Approver(s) = centre_manager(s) of the centre | `{ approverName, submitterName, formTypeLabel, startDate?, viewUrl }` |
| Decision (approve/reject) | Submitter | `{ submitterName, formTypeLabel, decision, reason?, viewUrl }` |
| Cover nominated | Nominee | `{ nomineeName, submitterName, sessionSummary, respondUrl }` |
| Money form approved | Accounting (super_admin) | `{ formTypeLabel, submitterName, amount, viewUrl }` |
| Pending reminder (cron) | Approver(s) with a non-empty queue | `{ approverName, pendingCount, queueUrl }` |

**Confidentiality (FR-037)**: template prop **types** have no `content`/`buffer`/`attachment` field, so
no code path can place a medical doc in an email body. Emails link to the authenticated in-app record;
the doc is fetched only through the signed-URL view flow (storage-policies.md).

**Env**: `RESEND_API_KEY` added to startup env validation (fail fast). Domain SPF/DKIM is a DNS step
(R6 ⚠).

## Scheduled jobs — Vercel Cron → secured Next.js route handlers (R7)

Declared in `vercel.json`/`vercel.ts` `crons`; each route validates
`Authorization: Bearer ${CRON_SECRET}` before doing work; calls the same TS service layer. Neither fires
under local `next dev` — document a manual `curl -H "authorization: Bearer $CRON_SECRET"` trigger for the
live-local tests.

| Job | Route | Schedule (config) | Work |
|---|---|---|---|
| Pending reminders (FR-036) | `/api/cron/pending-reminders` | e.g. `0 8 * * *` (cadence config) | For each centre with `pending`/`awaiting_cover` requests, email its manager(s) a digest. |
| Medical-doc auto-purge (FR-033a) | `/api/cron/purge-documents` | e.g. `0 3 * * *` | Sweep `request_attachment where purge_after < today`; delete storage object then metadata row; audit. |

**Env**: `CRON_SECRET` added to startup env validation. `purge_after` is stamped from
`leave_policy_config.medical_doc_retention_days` when a request record becomes non-live (approved-and-
elapsed / rejected / cancelled).

⚠ VERIFY-AT-IMPLEMENTATION (R12): Vercel Cron plan limits + current cron→route auth convention; Resend
SDK signature + diacritics; `.storage.remove()`/`.createSignedUrl()` signatures; Next.js 16 `after()` if
email is later moved off the response path.
