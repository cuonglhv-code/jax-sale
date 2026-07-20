-- Jaxtina IELTS Summit (slice #005) send archive — contracts/delivery-archive.md, data-model.md.
-- Every sent roadmap is archived: the exact PDF (Storage) + metadata (this table), reviewable by
-- the academic team (roadmap.audit permission). Immutable audit log — no UPDATE/DELETE policy.
-- Idempotent on generation_key (retry never duplicates the row or the archived object).

create table public.summit_sends (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id),
  consultant_id uuid not null references public.employees (id),
  student_name text not null,
  student_email text not null,
  placement_kind text not null check (placement_kind in ('measured', 'estimated')),
  placement_test_date date,                      -- optional Mode A test date (clarified 2026-07-17)
  current_band text not null,
  target_band text not null,
  course_sequence text[] not null,
  total_price bigint not null,
  ladder_edited boolean not null default false,
  pdf_path text not null unique,                 -- Storage object path: <centre_id>/<id>.pdf
  delivery_status text not null check (delivery_status in ('delivered', 'failed')),
  generation_key text not null unique,
  created_at timestamptz not null default now()
);

create index idx_summit_sends_centre on public.summit_sends (centre_id);
create index idx_summit_sends_consultant on public.summit_sends (consultant_id);
create index idx_summit_sends_created on public.summit_sends (created_at);

-- Grants: INSERT-only for the app role (no UPDATE/DELETE — immutable); service_role for admin/seed.
grant select, insert on public.summit_sends to authenticated;
grant all on public.summit_sends to service_role;

alter table public.summit_sends enable row level security;

-- Broad SELECT to authenticated (Pattern A, matching roadmap_records); the real gate is the
-- app-layer `assertPermission("roadmap.audit")` in the list action — RLS is defense-in-depth.
create policy "summit_sends_select_all" on public.summit_sends
  for select to authenticated using ( true );

create policy "summit_sends_insert_own_centre" on public.summit_sends
  for insert to authenticated
  with check ( centre_id::text = (select auth.jwt() ->> 'centre_id') );

-- No UPDATE/DELETE policy for authenticated: the archive is immutable (data-model.md).

-- ── Private storage bucket for the archived PDFs ──────────────────────────────
-- Local dev also needs the matching [storage.buckets.roadmap-archive] block in config.toml
-- (bucket config does not hot-reload; requires `supabase stop && start` then `db reset`).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roadmap-archive', 'roadmap-archive', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- storage.objects RLS: write via service-role only (the send action uses a service-role client
-- for the atomic upload+insert, mirroring the medical-documents pattern); SELECT scoped to the
-- audit permission for any non-service-role path (defense-in-depth — the real gate mints signed
-- URLs only after an app-layer `assertPermission("roadmap.audit")` check).
create policy "roadmap_archive_select_audit" on storage.objects for select to authenticated
using (
  bucket_id = 'roadmap-archive'
  and (select auth.jwt() ->> 'app_role') in ('super_admin', 'centre_manager', 'centre_admin')
);
-- INSERT/UPDATE/DELETE via service-role only; no authenticated write policy.
