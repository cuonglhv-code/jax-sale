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
