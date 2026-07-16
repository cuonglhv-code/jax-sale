# Contract: Private Storage for Medical Documents (R8)

Enforces medical-doc confidentiality at the **storage/DB layer**, not UI (FR-032/033, SC-006).

## Bucket

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-documents', 'medical-documents', false, 10485760,   -- 10 MiB (config: doc_type_policy)
        array['application/pdf','image/png','image/jpeg']);
```
Private (`public=false`). Size/MIME are also enforced in-app (byte-level sniff) because bucket checks may
only validate the declared `Content-Type` (R8 ⚠). The authoritative object→request link is the
`request_attachment` metadata table (data-model §7), not path-parsing; path convention encodes the
request id for traceability: `medical-documents/{request_id}/{uuid}.{ext}`.

## storage.objects RLS (defense-in-depth for any non-service-role path)

```sql
create policy "medical_docs_select_approver_or_admin" on storage.objects for select to authenticated
using (
  bucket_id = 'medical-documents'
  and (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or exists (
      select 1
      from public.request_attachment a
      join public.hr_request r on r.id = a.request_id
      where a.storage_path = storage.objects.name
        and (
          a.uploaded_by::text = (select auth.jwt() ->> 'employee_id')          -- uploader (self)
          or ( (select auth.jwt() ->> 'app_role') = 'centre_manager'           -- approver role
               and r.centre_id::text = (select auth.jwt() ->> 'centre_id') )
        )
    )
  )
);
-- INSERT/DELETE via service-role only (below); no broad/centre read. Peers are never matched.
```

Because approval is **centre-derived** (no stored approver id until decided), "is approver" = a
`centre_manager` of the request's centre — a role+centre check, not a person id (adapted from research).

## Flows (Server Action, `attachment.service.ts`)

**Upload** (service-role client — deliberately bypasses RLS for the atomic write):
```
1. assertPermission(hrRequest.submit) + app-check: caller may attach to THIS request (own, same centre)
2. read bytes; sniff real MIME; enforce size + allowed types (doc_type_policy)
3. serviceRole.storage.from('medical-documents').upload(path, bytes, { contentType })
4. insert request_attachment { request_id, storage_path, mime_type, size_bytes, is_medical:true, uploaded_by }
   (same action, same txn-intent → no orphan)
```

**View** (app-layer gate FIRST, then mint — signed URLs bypass RLS, so the check is the real gate):
```
1. app-check: my_role == super_admin OR (centre_manager AND request.centre_id == my_centre) OR uploader==me
   → else ForbiddenError
2. serviceRole.storage.from('medical-documents').createSignedUrl(path, 120)   // ~2 min TTL
3. return url; never cache/reuse beyond TTL; never embed in email (FR-037)
```

**Purge** (cron — R7): for `request_attachment` rows with `purge_after < today`:
```
1. serviceRole.storage.remove([paths])          // delete object FIRST
2. on success → delete metadata row + write_audit_log("attachment.purge", …)
3. on mismatch → log for reconciliation, retry next run (idempotent)
```

## Confidentiality proof (test — Principle IV, SC-006)

Live-local test: upload a medical doc to a request in centre A; assert (a) a same-centre **peer**
`teacher` gets denied both the metadata row (RLS) and any direct object read; (b) the `centre_manager`
of centre A can mint a signed URL; (c) a `centre_manager` of centre B cannot; (d) no list/report/email
projection ever contains the object — only `hasAttachment`. Requires explicit storage fixture
setup/teardown (seed.sql seeds Postgres only — R8 ⚠).
