-- Idempotent seed (upsert on natural unique keys — spec §9). Exercises the REAL code paths: auth
-- users are inserted directly into auth.users/auth.identities (spec §Assumptions: "Local-dev auth
-- users may be inserted directly; production accounts must go through the real create-login admin
-- action"). All seed passwords are "Password123!" for local dev only.

-- ── Centres (>=2, for isolation tests) ────────────────────────────────────────
insert into public.centres (id, name, code, is_functional) values
  ('00000000-0000-4000-8000-000000000001', 'Trung tâm Quận 1', 'Q1', false),
  ('00000000-0000-4000-8000-000000000002', 'Trung tâm Quận 3', 'Q3', false)
on conflict (name) do nothing;

-- ── Departments (flat, network-wide) ──────────────────────────────────────────
insert into public.departments (id, name) values
  ('00000000-0000-4000-8000-0000000000d1', 'Quản lý'),
  ('00000000-0000-4000-8000-0000000000d2', 'Tuyển sinh'),
  ('00000000-0000-4000-8000-0000000000d3', 'Vận hành'),
  ('00000000-0000-4000-8000-0000000000d4', 'Giáo viên')
on conflict (name) do nothing;

-- ── Auth users + identities (direct insert — local dev only) + Employees ─────
-- One seeded user per role, cross-centre coverage, plus one deactivated employee.
do $$
declare
  v_password text := crypt('Password123!', gen_salt('bf'));
  v_users jsonb := '[
    {"id":"10000000-0000-4000-8000-000000000001","email":"admin@jaxtina.test","name":"Quản trị Hệ thống","role":"super_admin","centre":"00000000-0000-4000-8000-000000000001","dept":"00000000-0000-4000-8000-0000000000d1","active":true},
    {"id":"10000000-0000-4000-8000-000000000002","email":"manager.q1@jaxtina.test","name":"Quản lý Q1","role":"centre_manager","centre":"00000000-0000-4000-8000-000000000001","dept":"00000000-0000-4000-8000-0000000000d1","active":true},
    {"id":"10000000-0000-4000-8000-000000000003","email":"admin.q3@jaxtina.test","name":"Quản trị viên Q3","role":"centre_admin","centre":"00000000-0000-4000-8000-000000000002","dept":"00000000-0000-4000-8000-0000000000d1","active":true},
    {"id":"10000000-0000-4000-8000-000000000004","email":"sale.q1@jaxtina.test","name":"Tư vấn Q1","role":"sale_consultant","centre":"00000000-0000-4000-8000-000000000001","dept":"00000000-0000-4000-8000-0000000000d2","active":true},
    {"id":"10000000-0000-4000-8000-000000000005","email":"sale.q3@jaxtina.test","name":"Tư vấn Q3","role":"sale_consultant","centre":"00000000-0000-4000-8000-000000000002","dept":"00000000-0000-4000-8000-0000000000d2","active":true},
    {"id":"10000000-0000-4000-8000-000000000006","email":"teacher.q1@jaxtina.test","name":"Giáo viên Q1","role":"teacher","centre":"00000000-0000-4000-8000-000000000001","dept":"00000000-0000-4000-8000-0000000000d4","active":true},
    {"id":"10000000-0000-4000-8000-000000000007","email":"deactivated.q1@jaxtina.test","name":"Nhân viên Vô hiệu hóa","role":"sale_consultant","centre":"00000000-0000-4000-8000-000000000001","dept":"00000000-0000-4000-8000-0000000000d2","active":false}
  ]'::jsonb;
  u record;
begin
  for u in select * from jsonb_to_recordset(v_users) as x(
    id uuid, email text, name text, role text, centre uuid, dept uuid, active boolean
  )
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      v_password, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      u.id, u.id::text, u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email),
      'email', now(), now()
    )
    on conflict (provider_id, provider) do nothing;

    insert into public.employees (
      id, auth_user_id, full_name, email, app_role, centre_id, department_id, is_active, avatar_color
    ) values (
      u.id, u.id, u.name, u.email, u.role, u.centre, u.dept, u.active, '#5B8DEF'
    )
    on conflict (auth_user_id) do update set is_active = excluded.is_active;
  end loop;
end $$;

-- ── Sample tasks across statuses (real path: direct insert here is acceptable for seed data;
--    status history for these is backfilled below to keep the "complete from creation" invariant) ──
do $$
declare
  v_manager uuid := '10000000-0000-4000-8000-000000000002';
  v_teacher uuid := '10000000-0000-4000-8000-000000000006';
  v_centre uuid := '00000000-0000-4000-8000-000000000001';
  v_dept uuid := '00000000-0000-4000-8000-0000000000d4';
  t record;
  v_tasks jsonb := '[
    {"id":"20000000-0000-4000-8000-000000000001","description":"Chuẩn bị giáo án tuần 1","status":"TODO","group":"GIANG_DAY","priority":"HIGH"},
    {"id":"20000000-0000-4000-8000-000000000002","description":"Chấm bài kiểm tra giữa kỳ","status":"DOING","group":"GIANG_DAY","priority":"MID"},
    {"id":"20000000-0000-4000-8000-000000000003","description":"Gửi báo cáo học viên","status":"DONE","group":"CHAM_SOC_HV","priority":"LOW"},
    {"id":"20000000-0000-4000-8000-000000000004","description":"Họp phụ huynh học viên A","status":"BLOCK","group":"HOP","priority":"MID"}
  ]'::jsonb;
begin
  for t in select * from jsonb_to_recordset(v_tasks) as x(id uuid, description text, status text, "group" text, priority text)
  loop
    insert into public.tasks (
      id, centre_id, assignee_id, department_id, description, "group", priority,
      deadline, status, source, created_by
    ) values (
      t.id, v_centre, v_teacher, v_dept, t.description, t."group", t.priority,
      current_date + 7, t.status, 'ASSIGNED', v_manager
    )
    on conflict (id) do nothing;

    insert into public.task_status_logs (task_id, centre_id, from_status, to_status, changed_by_id)
    select t.id, v_centre, null, t.status, v_manager
    where not exists (select 1 from public.task_status_logs where task_id = t.id);
  end loop;
end $$;

-- ══ HR Requests seed (slice #004; idempotent) ═════════════════════════════════
-- RFC-4122-shaped UUIDs (version-4 / variant-8 nibbles so Zod v4 .uuid() accepts them). Seed runs as
-- the postgres/service role and bypasses RLS. STATUTORY FIGURES BELOW ARE PLACEHOLDERS requiring
-- HR/legal sign-off before launch (FR-030).

-- ── Leave policy config for the current leave year ────────────────────────────
insert into public.leave_policy_config (
  id, leave_year, annual_baseline_days, seniority_extra_days_per_years, seniority_years_step,
  leave_year_start, working_week, notice_days, carryover_enabled, medical_doc_retention_days,
  part_time_prorate
) values (
  '40000000-0000-4000-8000-000000000001', 2026, 12.0, 1.0, 5,
  'calendar', '{1,2,3,4,5}', 3, false, 365, true
) on conflict (leave_year) do nothing;

-- ── Statutory paid-personal-leave allowances (placeholders) ───────────────────
insert into public.leave_event_allowance (id, event, allowance_days, paid) values
  ('40000000-0000-4000-8000-0000000000a1', 'marriage_self', 3.0, true),
  ('40000000-0000-4000-8000-0000000000a2', 'marriage_child', 1.0, true),
  ('40000000-0000-4000-8000-0000000000a3', 'bereavement', 3.0, true),
  ('40000000-0000-4000-8000-0000000000a4', 'other', 0.0, false)
on conflict (event) do nothing;

-- ── Public holidays (a few 2026 Vietnamese holidays) ──────────────────────────
insert into public.public_holiday (id, holiday_date, name) values
  ('40000000-0000-4000-8000-0000000000b1', '2026-01-01', 'Tết Dương lịch'),
  ('40000000-0000-4000-8000-0000000000b2', '2026-04-30', 'Ngày Giải phóng miền Nam'),
  ('40000000-0000-4000-8000-0000000000b3', '2026-05-01', 'Ngày Quốc tế Lao động'),
  ('40000000-0000-4000-8000-0000000000b4', '2026-09-02', 'Quốc khánh')
on conflict (holiday_date) do nothing;

-- ── Attachment policy per request type ────────────────────────────────────────
insert into public.doc_type_policy (id, request_type, max_size_bytes, allowed_mime, required) values
  ('40000000-0000-4000-8000-0000000000c1', 'sick_leave', 10485760,
   '{application/pdf,image/png,image/jpeg}', true),
  ('40000000-0000-4000-8000-0000000000c2', 'personal_leave', 10485760,
   '{application/pdf,image/png,image/jpeg}', false)
on conflict (request_type) do nothing;

-- ── HR attributes for seeded employees (idempotent update) ────────────────────
update public.employees set hire_date = '2020-03-01', employment_type = 'full_time', contract_type = 'indefinite'
  where id = '10000000-0000-4000-8000-000000000002';   -- manager.q1
update public.employees set hire_date = '2023-09-01', employment_type = 'full_time', contract_type = 'indefinite'
  where id = '10000000-0000-4000-8000-000000000006';   -- teacher.q1
update public.employees set hire_date = '2024-01-15', employment_type = 'full_time', contract_type = 'fixed_term'
  where id = '10000000-0000-4000-8000-000000000004';   -- sale.q1
update public.employees set hire_date = '2024-06-01', employment_type = 'part_time', contract_type = 'fixed_term'
  where id = '10000000-0000-4000-8000-000000000005';   -- sale.q3

-- ── Classes per centre (Q1 taught by teacher.q1; Q3 stand-in teacher for isolation coverage) ──
insert into public.class (
  id, centre_id, course_label, teacher_id, weekday, start_time, end_time, start_date, end_date, is_active
) values
  ('40000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001',
   'IELTS Foundation A', '10000000-0000-4000-8000-000000000006', 1, '18:00', '20:00',
   '2026-01-05', '2026-12-20', true),
  ('40000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000001',
   'IELTS Intermediate B', '10000000-0000-4000-8000-000000000006', 3, '18:00', '20:00',
   '2026-01-07', '2026-12-20', true),
  ('40000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000000002',
   'IELTS Foundation Q3', '10000000-0000-4000-8000-000000000005', 2, '18:00', '20:00',
   '2026-01-06', '2026-12-20', true)
on conflict (id) do nothing;

-- ── Annual-leave balances for the current year ────────────────────────────────
insert into public.leave_balance (id, employee_id, leave_year, entitlement_days, consumed_days, opening_adjustment_days) values
  ('40000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-000000000006', 2026, 12.0, 0, 0),
  ('40000000-0000-4000-8000-0000000000e2', '10000000-0000-4000-8000-000000000004', 2026, 12.0, 0, 0)
on conflict (employee_id, leave_year) do nothing;

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

-- ── US2 (T031): a second centre_manager, scoped to centre Q3, so the centre-isolation test has a
-- REAL cross-centre manager to sign in as (the base seed only had one centre_manager, manager.q1).
-- Additive-only; does not touch the shared employee-seeding loop above.
do $$
declare
  v_password text := crypt('Password123!', gen_salt('bf'));
  v_id uuid := '10000000-0000-4000-8000-000000000008';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'manager.q3@jaxtina.test', v_password, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (
    v_id, v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', 'manager.q3@jaxtina.test'),
    'email', now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  insert into public.employees (
    id, auth_user_id, full_name, email, app_role, centre_id, department_id, is_active, avatar_color
  ) values (
    v_id, v_id, 'Quản lý Q3', 'manager.q3@jaxtina.test', 'centre_manager',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000d1', true, '#5B8DEF'
  )
  on conflict (auth_user_id) do update set is_active = excluded.is_active;
end $$;

-- ── US4 (T039): a second Q1 teacher so the cover-nomination tests have a REAL same-centre
-- alternative teacher to nominate (the base seed only had one teacher, teacher.q1) — and a class
-- taught by THIS teacher, so a "nominee already teaching at that time" hard-conflict scenario is
-- provable against real data (FR-020). Additive-only; does not touch the shared seeding loop above.
do $$
declare
  v_password text := crypt('Password123!', gen_salt('bf'));
  v_id uuid := '10000000-0000-4000-8000-000000000009';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'teacher2.q1@jaxtina.test', v_password, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (
    v_id, v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', 'teacher2.q1@jaxtina.test'),
    'email', now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  insert into public.employees (
    id, auth_user_id, full_name, email, app_role, centre_id, department_id, is_active, avatar_color
  ) values (
    v_id, v_id, 'Giáo viên Q1 (2)', 'teacher2.q1@jaxtina.test', 'teacher',
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d4', true, '#5B8DEF'
  )
  on conflict (auth_user_id) do update set is_active = excluded.is_active;

  update public.employees set hire_date = '2022-02-01', employment_type = 'full_time', contract_type = 'indefinite'
    where id = v_id;
end $$;

-- Class taught by teacher2.q1 — every Tuesday 18:00-20:00, so tests can nominate this teacher as a
-- cover for a Monday/Wednesday session (free) OR prove the hard-block when a leave/nomination
-- targets a Tuesday session this teacher already teaches (FR-020).
insert into public.class (
  id, centre_id, course_label, teacher_id, weekday, start_time, end_time, start_date, end_date, is_active
) values (
  '40000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-000000000001',
  'IELTS Advanced C', '10000000-0000-4000-8000-000000000009', 2, '18:00', '20:00',
  '2026-01-06', '2026-12-20', true
)
on conflict (id) do nothing;
