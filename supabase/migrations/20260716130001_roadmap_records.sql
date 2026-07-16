-- IELTS Roadmap Builder audit log (slice #002). Tenant-scoped; Pattern A from slice #001
-- (broad network-wide SELECT, centre-narrow write). Every generated roadmap is logged here
-- (FR-LOG-01/02); the write also emits a general audit-log entry via write_audit_log.

create table public.roadmap_records (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id),
  consultant_id uuid not null references public.employees (id),
  student_name text not null,
  student_email text not null,
  student_phone text,
  audience text not null check (
    audience in ('THCS', 'THPT', 'SINH_VIEN', 'NGUOI_DI_LAM', 'MAT_GOC')
  ),
  current_band text not null,
  target_band text not null,
  course_sequence text[] not null,
  manual_edited boolean not null default false,
  sent boolean not null default false,
  generation_key text not null unique,
  created_at timestamptz not null default now()
);

create index idx_roadmap_records_centre on public.roadmap_records (centre_id);
create index idx_roadmap_records_consultant on public.roadmap_records (consultant_id);
create index idx_roadmap_records_created on public.roadmap_records (created_at);

-- Grants + RLS (Pattern A). authenticated is the app role; service_role bypasses for admin/seed.
grant select, insert, update, delete on public.roadmap_records to authenticated;
grant all on public.roadmap_records to service_role;

alter table public.roadmap_records enable row level security;

create policy "roadmap_records_select_all" on public.roadmap_records
  for select to authenticated using ( true );

create policy "roadmap_records_insert_own_centre" on public.roadmap_records
  for insert to authenticated
  with check ( centre_id::text = (select auth.jwt() ->> 'centre_id') );

create policy "roadmap_records_update_own_centre" on public.roadmap_records
  for update to authenticated
  using ( centre_id::text = (select auth.jwt() ->> 'centre_id') )
  with check ( centre_id::text = (select auth.jwt() ->> 'centre_id') );

create policy "roadmap_records_delete_own_centre" on public.roadmap_records
  for delete to authenticated
  using ( centre_id::text = (select auth.jwt() ->> 'centre_id') );
