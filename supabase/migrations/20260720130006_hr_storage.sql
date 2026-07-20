-- HR module (slice 004), US6 (T052) — storage.objects RLS for the private `medical-documents`
-- bucket (contracts/storage-policies.md). The bucket itself was already declared in
-- supabase/config.toml back in T003 (Phase 1); this migration only adds the RLS policies that gate
-- direct/authenticated access to it. `request_attachment` metadata-table RLS ALREADY EXISTS from
-- the foundation `hr_rls` migration (20260717130003_hr_rls.sql, "attachment_select_scoped" policy)
-- — checked first, nothing duplicated here.
--
-- Upload/delete/purge happen ONLY via the service-role client (attachment.service.ts), which
-- bypasses RLS entirely — so no INSERT/UPDATE/DELETE policy is added for `authenticated` here,
-- matching storage-policies.md's "INSERT/DELETE via service-role only; no broad/centre read" note.
-- The SELECT policy below is defense-in-depth for any hypothetical non-service-role read path
-- (e.g. a future client-side `getPublicUrl`/direct download attempt) — signed URLs minted by
-- attachment.service.ts bypass this policy by design (service-role), so the REAL gate for the
-- signed-URL flow is the app-layer check inside `getAttachmentSignedUrlCore`, not this policy.
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
          or (
            (select auth.jwt() ->> 'app_role') = 'centre_manager'              -- approver role
            and r.centre_id::text = (select auth.jwt() ->> 'centre_id')
          )
        )
    )
  )
);
