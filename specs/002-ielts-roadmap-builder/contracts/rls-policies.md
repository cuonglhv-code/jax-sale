# Contract: RLS for `roadmap_records`

Follows slice #001's Pattern A (broad read, centre-narrow write), `TO authenticated`, claim wrapped
in a subquery for per-statement caching. RLS enabled; `authenticated` gets table grants;
`service_role` retained for admin/seed.

```sql
alter table public.roadmap_records enable row level security;

-- SELECT: broad network-wide read (oversight / academic-team audit)
create policy "roadmap_records_select_all" on public.roadmap_records
  for select to authenticated using ( true );

-- INSERT: only into caller's own centre
create policy "roadmap_records_insert_own_centre" on public.roadmap_records
  for insert to authenticated
  with check ( (select auth.jwt() ->> 'centre_id') = centre_id::text );

-- UPDATE: own centre only (rarely used — e.g. flipping `sent`)
create policy "roadmap_records_update_own_centre" on public.roadmap_records
  for update to authenticated
  using ( (select auth.jwt() ->> 'centre_id') = centre_id::text )
  with check ( (select auth.jwt() ->> 'centre_id') = centre_id::text );

-- DELETE: own centre only
create policy "roadmap_records_delete_own_centre" on public.roadmap_records
  for delete to authenticated
  using ( (select auth.jwt() ->> 'centre_id') = centre_id::text );
```

Indexes: `centre_id`, `consultant_id`, `created_at`, unique `generation_key`.

**Isolation contract (SC-008 / constitution Principle IV)**: a centre-A user cannot INSERT/UPDATE/
DELETE a centre-B `roadmap_records` row — proven by test against the live local DB, **including a raw
INSERT that bypasses the service layer** (RLS `WITH CHECK` is the authoritative backstop, not the app
gate). Broad SELECT is intentional (audit oversight), consistent with FR-LOG-02.

No `SECURITY DEFINER` function is required (no cross-centre write in this slice).
