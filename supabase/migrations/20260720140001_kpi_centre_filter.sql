-- Design-system shell centre switcher (design_handoff_jax_sales, step 4): kpi_dashboard/
-- kpi_leaderboard gain an optional p_centre_id filter so a network-wide caller (super_admin, the
-- only role that sees the switcher — vocabulary.isNetworkWideRole) can narrow the tiered dashboard/
-- leaderboard to one centre. SECURITY INVOKER is unchanged — RLS on personal_kpis still auto-scopes
-- the underlying rows to the caller's tier regardless of this param, so a non-network-wide caller
-- passing any centre_id still only ever sees their own centre's rows; this param can only NARROW
-- what RLS already permits, never broaden it.
--
-- `create or replace function` does NOT replace a function whose parameter list shape changed — it
-- creates a second overload instead, which PostgREST's RPC resolver then can't disambiguate
-- (PGRST203, confirmed live: adding p_centre_id without dropping the old 3-arg signature broke
-- every existing kpi_dashboard/kpi_leaderboard caller). The old signatures MUST be dropped first.
drop function if exists public.kpi_dashboard(text, int, int);
drop function if exists public.kpi_leaderboard(text, text, int, int);

create or replace function public.kpi_dashboard(
  p_period text, p_limit int default null, p_offset int default 0, p_centre_id uuid default null
)
returns table (consultant_id uuid, consultant_name text, centre_id uuid, department_id uuid,
               metric_key text, approved_actual bigint, target bigint)
language sql stable security invoker as $$
  select k.consultant_id, e.full_name, k.centre_id, e.department_id, k.metric_key,
         coalesce(sum(k.actual) filter (where k.approval_status = 'approved'), 0)::bigint as approved_actual,
         max(k.target) as target
  from public.personal_kpis k
  join public.employees e on e.id = k.consultant_id
  where k.period = p_period
    and (p_centre_id is null or k.centre_id = p_centre_id)
  group by k.consultant_id, e.full_name, k.centre_id, e.department_id, k.metric_key
  order by e.full_name asc
  limit coalesce(p_limit, 2147483647) offset p_offset;
$$;

create or replace function public.kpi_leaderboard(
  p_period text, p_metric text, p_limit int default null, p_offset int default 0, p_centre_id uuid default null
)
returns table (consultant_id uuid, consultant_name text, centre_id uuid,
               approved_actual bigint, rank bigint)
language sql stable security invoker as $$
  select consultant_id, full_name, centre_id, approved_actual,
         row_number() over (order by approved_actual desc, full_name asc) as rank
  from (
    select k.consultant_id, e.full_name, k.centre_id,
           coalesce(sum(k.actual) filter (where k.approval_status = 'approved'), 0)::bigint as approved_actual
    from public.personal_kpis k
    join public.employees e on e.id = k.consultant_id
    where k.period = p_period and k.metric_key = p_metric
      and (p_centre_id is null or k.centre_id = p_centre_id)
    group by k.consultant_id, e.full_name, k.centre_id
  ) s
  order by approved_actual desc, full_name asc
  limit coalesce(p_limit, 2147483647) offset p_offset;
$$;
