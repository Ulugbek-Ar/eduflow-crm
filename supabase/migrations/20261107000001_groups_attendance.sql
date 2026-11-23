-- EduFlow CRM v1.1 (ma'lumot sxemasi v11): o'qituvchilar, guruhlar, o'qish (enrollment), davomat, bekor qilingan darslar.
-- Uslub — 20261106000001_init.sql bilan bir xil: har jadvalda organization_id, matnli id (lokal ma'lumot va JSON zaxira
-- shu holicha import qilinadi), soft delete (deleted_at) — savatcha, server triggerlari bilan amallar jurnali, RLS.

-- ===== Ruxsatlar jadvali: src/auth/permissions.ts dagi ROLE_PERMISSIONS bilan aynan bir xil =====
-- (src/auth/permissions.test.ts migratsiyalardagi oxirgi role_has_permission() ni TS jadval bilan solishtiradi)
create or replace function public.role_has_permission(r public.app_role, p text) returns boolean
language sql immutable as $$
  select case r
    when 'admin' then true
    when 'manager' then p = any (array['customers.view', 'customers.edit', 'customers.delete', 'payments.view', 'payments.create', 'courses.view', 'groups.view', 'groups.edit', 'attendance.view', 'attendance.mark'])
    when 'cashier' then p = any (array['customers.view', 'payments.view', 'payments.create', 'payments.manage', 'courses.view', 'analytics.view', 'reports.export', 'groups.view', 'attendance.view', 'payroll.view', 'payroll.manage'])
    when 'viewer' then p = any (array['customers.view', 'payments.view', 'courses.view', 'analytics.view', 'groups.view', 'attendance.view', 'payroll.view'])
    when 'teacher' then p = any (array['groups.view', 'attendance.view', 'attendance.mark'])
    else false
  end
$$;

-- ===== Jadvallar =====
create table public.teachers (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null default '',
  subjects text[] not null default '{}',
  -- {"type":"fixed","amount":N} | {"type":"percent","percent":N} | {"type":"perStudent","amount":N}
  pay_rule jsonb not null default '{"type": "fixed", "amount": 0}'::jsonb check (pay_rule ->> 'type' in ('fixed', 'percent', 'perStudent')),
  -- Tizimga kirishi bo'lsa — "o'z guruhlari" shu orqali aniqlanadi
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  primary key (organization_id, id)
);
create unique index teachers_user_idx on public.teachers (organization_id, user_id) where user_id is not null and deleted_at is null;

create table public.groups (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 2 and 80),
  course_id text not null,
  teacher_id text,
  -- '' — xona ko'rsatilmagan
  room text not null default '' check (char_length(room) <= 40),
  days text[] not null check (cardinality(days) between 1 and 7 and days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  start_time time not null,
  end_time time not null,
  capacity integer not null check (capacity between 1 and 500),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'finished', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  primary key (organization_id, id),
  check (end_time > start_time),
  check (end_date is null or end_date >= start_date),
  foreign key (organization_id, course_id) references public.courses (organization_id, id),
  -- O'qituvchi butunlay o'chirilsa guruh o'qituvchisiz qoladi (PostgreSQL 15+: faqat shu ustun null bo'ladi)
  foreign key (organization_id, teacher_id) references public.teachers (organization_id, id) on delete set null (teacher_id)
);
create index groups_org_course_idx on public.groups (organization_id, course_id) where deleted_at is null;
create index groups_org_teacher_idx on public.groups (organization_id, teacher_id) where deleted_at is null;

create table public.enrollments (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  customer_id text not null,
  group_id text not null,
  start_date date not null,
  end_date date,
  price_override bigint check (price_override is null or price_override between 0 and 1000000000000),
  discount_percent numeric(5, 2) check (discount_percent is null or discount_percent between 0 and 100),
  status text not null default 'active' check (status in ('active', 'paused', 'finished', 'left')),
  paused_from date,
  paused_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  primary key (organization_id, id),
  check (end_date is null or end_date >= start_date),
  check (paused_to is null or paused_from is null or paused_to >= paused_from),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete cascade,
  foreign key (organization_id, group_id) references public.groups (organization_id, id) on delete cascade
);
create index enrollments_org_group_idx on public.enrollments (organization_id, group_id) where deleted_at is null;
create index enrollments_org_customer_idx on public.enrollments (organization_id, customer_id) where deleted_at is null;

-- Davomat: (guruh, o'quvchi, sana) noyob; savatchasiz (holat o'zgartiriladi)
create table public.attendance (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  group_id text not null,
  customer_id text not null,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  note text check (note is null or char_length(note) <= 200),
  marked_by text,
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, group_id, customer_id, date),
  foreign key (organization_id, group_id) references public.groups (organization_id, id) on delete cascade,
  foreign key (organization_id, customer_id) references public.customers (organization_id, id) on delete cascade
);
create index attendance_org_date_idx on public.attendance (organization_id, date desc);

-- Bekor qilingan dars (bayram, o'qituvchi kasal): shu kun dars sanalaridan chiqariladi
create table public.lesson_exceptions (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  group_id text not null,
  date date not null,
  reason text not null default '' check (char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, group_id, date),
  foreign key (organization_id, group_id) references public.groups (organization_id, id) on delete cascade
);

-- To'lov: qaysi guruhdagi o'qish uchun, qaysi oy uchun; maosh — qaysi o'qituvchiga
alter table public.transactions
  add column enrollment_id text,
  add column teacher_id text,
  add column period text check (period is null or period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
create index transactions_org_enrollment_idx on public.transactions (organization_id, enrollment_id) where enrollment_id is not null;

-- Faol guruhlar soni endi guruhlardan hisoblanadi
alter table public.courses drop column if exists active_groups;

-- ===== updated_at triggerlari (yangi jadvallar) =====
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger teachers_touch before update on public.teachers for each row execute function public.touch_updated_at();
create trigger groups_touch before update on public.groups for each row execute function public.touch_updated_at();
create trigger enrollments_touch before update on public.enrollments for each row execute function public.touch_updated_at();
create trigger attendance_touch before insert or update on public.attendance for each row execute function public.touch_updated_at();

-- ===== Yordamchi funksiyalar (RLS ichida) =====
-- O'qituvchi sifatida kirgan xodim shu guruhning o'qituvchisimi
create or replace function public.teacher_owns_group(p_group text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groups g
    join public.teachers t on t.organization_id = g.organization_id and t.id = g.teacher_id
    where g.organization_id = public.current_org_id() and g.id = p_group and g.deleted_at is null
      and t.user_id = auth.uid() and t.deleted_at is null and t.status = 'active'
  )
$$;

-- O'qituvchi faqat o'z guruhlarini, boshqa rollar — markazning barcha guruhlarini ko'radi
create or replace function public.sees_group(p_group text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() <> 'teacher', false) or public.teacher_owns_group(p_group)
$$;

-- O'qituvchi davomatni bugun va oxirgi N kun uchun tahrirlaydi (Sozlamalar: attendanceEditDays, standart 3)
create or replace function public.attendance_edit_days() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(least(greatest((o.settings ->> 'attendanceEditDays')::integer, 0), 60), 3)
  from public.organizations o where o.id = public.current_org_id()
$$;

-- Shu kunga davomat yozish mumkinmi: kelajak — yo'q; guruhlarni boshqaruvchi (administrator, menejer) — istalgan kun;
-- o'qituvchi — faqat o'z guruhi, bugun va oxirgi N kun
create or replace function public.attendance_day_allowed(p_group text, p_date date) returns boolean
language sql stable security definer set search_path = public as $$
  select p_date <= current_date and (
    public.has_permission('groups.edit')
    or (public.teacher_owns_group(p_group) and p_date >= current_date - coalesce(public.attendance_edit_days(), 3))
  )
$$;

-- ===== Jurnal: yangi jadvallar ham server triggerlari bilan =====
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := case tg_table_name
    when 'customers' then 'customer' when 'transactions' then 'payment' when 'courses' then 'course'
    when 'teachers' then 'teacher' when 'groups' then 'group' when 'enrollments' then 'enrollment' end;
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_summary text := coalesce(v_row ->> 'name', (v_row ->> 'amount') || ' · ' || coalesce(v_row ->> 'customer_name', v_row ->> 'category'));
  v_action text;
begin
  if v_kind = 'enrollment' then
    select coalesce((select c.name from public.customers c where c.organization_id = (v_row ->> 'organization_id')::uuid and c.id = v_row ->> 'customer_id'), v_row ->> 'customer_id')
      || ' — ' || coalesce((select g.name from public.groups g where g.organization_id = (v_row ->> 'organization_id')::uuid and g.id = v_row ->> 'group_id'), v_row ->> 'group_id')
    into v_summary;
  end if;
  if tg_op = 'INSERT' then
    v_action := v_kind || '.create';
  elsif tg_op = 'DELETE' then
    v_action := 'trash.purge';
  elsif old.deleted_at is null and new.deleted_at is not null then
    v_action := v_kind || '.delete';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := v_kind || '.restore';
  elsif v_kind = 'customer' and old.status is distinct from new.status then
    v_action := 'customer.status';
    v_summary := new.name || ': ' || old.status || ' → ' || new.status;
  elsif v_kind = 'payment' and old.status is distinct from new.status then
    v_action := 'payment.status';
  elsif v_kind in ('course', 'group', 'teacher') and old.status = 'active' and new.status = 'archived' then
    v_action := v_kind || '.archive';
  elsif v_kind = 'enrollment' and (v_row ->> 'group_id') is distinct from (to_jsonb(old) ->> 'group_id') then
    v_action := 'enrollment.transfer';
  else
    v_action := v_kind || '.update';
  end if;
  perform public.write_audit((v_row ->> 'organization_id')::uuid, v_action, v_summary, v_row ->> 'id');
  return coalesce(new, old);
end $$;

create trigger teachers_audit after insert or update or delete on public.teachers for each row execute function public.audit_row();
create trigger groups_audit after insert or update or delete on public.groups for each row execute function public.audit_row();
create trigger enrollments_audit after insert or update or delete on public.enrollments for each row execute function public.audit_row();

-- Davomat: bitta so'rov (masalan, "Hammasi keldi") — guruh va sana bo'yicha bitta jurnal yozuvi
create or replace function public.audit_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select n.organization_id, n.group_id, n.date, count(*) as cnt,
           (select g.name from public.groups g where g.organization_id = n.organization_id and g.id = n.group_id) as group_name
    from new_rows n group by n.organization_id, n.group_id, n.date
  loop
    perform public.write_audit(r.organization_id, 'attendance.mark', coalesce(r.group_name, r.group_id) || ' · ' || r.date || ': ' || r.cnt || ' ta', r.group_id);
  end loop;
  return null;
end $$;

-- Transition table bitta hodisa uchun — insert va update alohida trigger
create trigger attendance_audit_insert after insert on public.attendance referencing new table as new_rows for each statement execute function public.audit_attendance();
create trigger attendance_audit_update after update on public.attendance referencing new table as new_rows for each statement execute function public.audit_attendance();

create or replace function public.audit_lesson_exception() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row public.lesson_exceptions := coalesce(new, old);
  v_group text := coalesce((select g.name from public.groups g where g.organization_id = v_row.organization_id and g.id = v_row.group_id), v_row.group_id);
begin
  perform public.write_audit(v_row.organization_id, case when tg_op = 'DELETE' then 'lesson.restore' else 'lesson.cancel' end,
    v_group || ' · ' || v_row.date || case when v_row.reason <> '' then ' — ' || v_row.reason else '' end, v_row.group_id);
  return coalesce(new, old);
end $$;

create trigger lesson_exceptions_audit after insert or delete on public.lesson_exceptions for each row execute function public.audit_lesson_exception();

-- Savatcha: deleted_at faqat trash_move / trash_restore orqali
create trigger teachers_guard before update on public.teachers for each row execute function public.guard_soft_delete();
create trigger groups_guard before update on public.groups for each row execute function public.guard_soft_delete();
create trigger enrollments_guard before update on public.enrollments for each row execute function public.guard_soft_delete();

create or replace function public.trash_permission(p_table text) returns text
language sql immutable as $$
  select case p_table
    when 'customers' then 'customers.delete'
    when 'transactions' then 'payments.manage'
    when 'courses' then 'courses.edit'
    when 'teachers' then 'teachers.manage'
    when 'groups' then 'groups.edit'
    when 'enrollments' then 'groups.edit'
  end
$$;

-- 30 kundan eski o'chirilganlar: guruhlari bor kurs o'chirilmaydi (FK), o'qituvchi o'chirilsa guruh o'qituvchisiz qoladi
create or replace function public.purge_trash() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_total integer := 0;
  v_count integer;
begin
  delete from public.enrollments where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.customers where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.transactions where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.groups where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.teachers where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.courses c where c.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.groups g where g.organization_id = c.organization_id and g.course_id = c.id);
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.audit_log where at < now() - interval '1 year';
  return v_total;
end $$;
revoke execute on function public.purge_trash() from public, anon, authenticated;

-- Ilova yuboradigan hodisalar: eslatma yuborildi, Excel/CSV import va uni bekor qilish qo'shildi
create or replace function public.log_event(p_action text, p_summary text default '', p_entity text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_org_id() is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if p_action not in ('auth.login', 'auth.logout', 'auth.password', 'data.export', 'data.backup', 'data.import', 'session.revoke',
                      'settings.update', 'reminder.sent', 'import.run', 'import.undo') then
    raise exception 'action not allowed: %', p_action using errcode = '22023';
  end if;
  perform public.write_audit(public.current_org_id(), p_action, p_summary, p_entity);
end $$;

-- ===== RLS =====
alter table public.teachers enable row level security;
alter table public.groups enable row level security;
alter table public.enrollments enable row level security;
alter table public.attendance enable row level security;
alter table public.lesson_exceptions enable row level security;

-- O'qituvchilar: maosh qoidasi bilan to'liq yozuvni faqat teachers.manage / payroll.view ko'radi; o'qituvchi — o'zini.
-- Boshqalar ism va fanlarni teacher_directory() dan oladi
create policy teachers_select on public.teachers for select
  using (organization_id = public.current_org_id()
         and (public.has_permission('teachers.manage') or public.has_permission('payroll.view') or user_id = auth.uid())
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy teachers_insert on public.teachers for insert
  with check (organization_id = public.current_org_id() and public.has_permission('teachers.manage') and public.org_writable());
create policy teachers_update on public.teachers for update
  using (organization_id = public.current_org_id() and public.has_permission('teachers.manage') and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy teachers_delete on public.teachers for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null);

-- Guruhlar: o'qituvchi — faqat teachers.user_id = auth.uid() bo'lgan guruhlar
create policy groups_select on public.groups for select
  using (organization_id = public.current_org_id() and public.has_permission('groups.view') and public.sees_group(id)
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy groups_insert on public.groups for insert
  with check (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable());
create policy groups_update on public.groups for update
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy groups_delete on public.groups for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null);

create policy enrollments_select on public.enrollments for select
  using (organization_id = public.current_org_id() and public.has_permission('groups.view') and public.sees_group(group_id)
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy enrollments_insert on public.enrollments for insert
  with check (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable());
create policy enrollments_update on public.enrollments for update
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy enrollments_delete on public.enrollments for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null);

-- Davomat: ko'rish — attendance.view (o'qituvchi faqat o'z guruhi); yozish — attendance.mark va kun cheklovi
create policy attendance_select on public.attendance for select
  using (organization_id = public.current_org_id() and public.has_permission('attendance.view') and public.sees_group(group_id));
create policy attendance_insert on public.attendance for insert
  with check (organization_id = public.current_org_id() and public.has_permission('attendance.mark') and public.org_writable()
              and public.attendance_day_allowed(group_id, date));
create policy attendance_update on public.attendance for update
  using (organization_id = public.current_org_id() and public.has_permission('attendance.mark') and public.org_writable()
         and public.attendance_day_allowed(group_id, date))
  with check (organization_id = public.current_org_id() and public.attendance_day_allowed(group_id, date));
create policy attendance_delete on public.attendance for delete
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable());

create policy lesson_exceptions_select on public.lesson_exceptions for select
  using (organization_id = public.current_org_id() and public.has_permission('groups.view') and public.sees_group(group_id));
create policy lesson_exceptions_insert on public.lesson_exceptions for insert
  with check (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable());
create policy lesson_exceptions_update on public.lesson_exceptions for update
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy lesson_exceptions_delete on public.lesson_exceptions for delete
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable());

-- ===== RPC =====
-- O'qituvchi: o'z guruhlaridagi o'quvchilar ismi (telefon raqami yashirin — customers jadvalini ko'rmaydi)
create or replace function public.teacher_roster()
returns table (id text, name text, phone text, course text, status text, source text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, ''::text, c.course, c.status, c.source, c.created_at
  from public.customers c
  where c.organization_id = public.current_org_id() and c.deleted_at is null
    and exists (select 1 from public.enrollments e
                where e.organization_id = c.organization_id and e.customer_id = c.id and e.deleted_at is null
                  and public.teacher_owns_group(e.group_id))
$$;

-- Guruhlarni ko'radiganlar uchun o'qituvchilar ro'yxati — maosh qoidasi va telefonsiz
create or replace function public.teacher_directory()
returns table (id text, name text, phone text, subjects text[], pay_rule jsonb, user_id uuid, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, ''::text, t.subjects, '{"type": "fixed", "amount": 0}'::jsonb, null::uuid, t.status, t.created_at
  from public.teachers t
  where t.organization_id = public.current_org_id() and t.deleted_at is null and public.has_permission('groups.view')
$$;

-- Lokal ma'lumot yoki JSON zaxirani bulutga ko'chirish (v11 ro'yxatlari bilan; mavjud yozuvlar yangilanadi).
-- O'qituvchining lokal xodim id'si bulutdagi foydalanuvchi emas — user_id ko'chirilmaydi
create or replace function public.import_backup(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_customers integer;
  v_transactions integer;
  v_courses integer;
  v_groups integer;
  v_enrollments integer;
begin
  if not public.has_permission('data.manage') or not public.org_writable() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.courses (organization_id, id, name, type, duration_months, monthly_price, status, created_at, updated_at)
  select v_org, c.id, c.name, c.type, c."durationMonths", c."monthlyPrice", c.status, c."createdAt", c."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'courses', '[]')) as c(id text, name text, type text, "durationMonths" int, "monthlyPrice" bigint,
       status text, "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, type = excluded.type, duration_months = excluded.duration_months,
    monthly_price = excluded.monthly_price, status = excluded.status, updated_at = excluded.updated_at;
  get diagnostics v_courses = row_count;

  insert into public.teachers (organization_id, id, name, phone, subjects, pay_rule, status, created_at, updated_at)
  select v_org, t.id, t.name, coalesce(t.phone, ''), coalesce(t.subjects, '{}'), coalesce(t."payRule", '{"type": "fixed", "amount": 0}'), t.status, t."createdAt", t."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'teachers', '[]')) as t(id text, name text, phone text, subjects text[], "payRule" jsonb, status text,
       "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, phone = excluded.phone, subjects = excluded.subjects,
    pay_rule = excluded.pay_rule, status = excluded.status;

  insert into public.customers (organization_id, id, name, phone, email, course, status, source, note, created_at, updated_at, paid_at)
  select v_org, c.id, c.name, c.phone, c.email, c.course, c.status, c.source, c.note, c."createdAt", c."updatedAt", c."paidAt"
  from jsonb_to_recordset(coalesce(p_data -> 'customers', '[]')) as c(id text, name text, phone text, email text, course text, status text,
       source text, note text, "createdAt" timestamptz, "updatedAt" timestamptz, "paidAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email, course = excluded.course,
    status = excluded.status, source = excluded.source, note = excluded.note, updated_at = excluded.updated_at, paid_at = excluded.paid_at;
  get diagnostics v_customers = row_count;

  insert into public.groups (organization_id, id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, start_date, end_date, status, created_at)
  select v_org, g.id, g.name, g."courseId", g."teacherId", coalesce(g.room, ''), g.days, g."startTime"::time, g."endTime"::time, g.capacity,
         g."startDate", g."endDate", g.status, g."createdAt"
  from jsonb_to_recordset(coalesce(p_data -> 'groups', '[]')) as g(id text, name text, "courseId" text, "teacherId" text, room text, days text[],
       "startTime" text, "endTime" text, capacity int, "startDate" date, "endDate" date, status text, "createdAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, course_id = excluded.course_id, teacher_id = excluded.teacher_id,
    room = excluded.room, days = excluded.days, start_time = excluded.start_time, end_time = excluded.end_time, capacity = excluded.capacity,
    start_date = excluded.start_date, end_date = excluded.end_date, status = excluded.status;
  get diagnostics v_groups = row_count;

  insert into public.enrollments (organization_id, id, customer_id, group_id, start_date, end_date, price_override, discount_percent, status,
                                  paused_from, paused_to, created_at)
  select v_org, e.id, e."customerId", e."groupId", e."startDate", e."endDate", e."priceOverride", e."discountPercent", e.status,
         e."pausedFrom", e."pausedTo", e."createdAt"
  from jsonb_to_recordset(coalesce(p_data -> 'enrollments', '[]')) as e(id text, "customerId" text, "groupId" text, "startDate" date, "endDate" date,
       "priceOverride" bigint, "discountPercent" numeric, status text, "pausedFrom" date, "pausedTo" date, "createdAt" timestamptz)
  on conflict (organization_id, id) do update set group_id = excluded.group_id, start_date = excluded.start_date, end_date = excluded.end_date,
    price_override = excluded.price_override, discount_percent = excluded.discount_percent, status = excluded.status,
    paused_from = excluded.paused_from, paused_to = excluded.paused_to;
  get diagnostics v_enrollments = row_count;

  insert into public.transactions (organization_id, id, type, amount, method, category, note, customer_id, customer_name, status, source, date, updated_at,
                                   enrollment_id, teacher_id, period)
  select v_org, t.id, t.type, t.amount, t.method, t.category, coalesce(t.note, ''), t."customerId", t."customerName", t.status, t.source, t.date, t."updatedAt",
         t."enrollmentId", t."teacherId", t.period
  from jsonb_to_recordset(coalesce(p_data -> 'transactions', '[]')) as t(id text, type text, amount bigint, method text, category text, note text,
       "customerId" text, "customerName" text, status text, source text, date timestamptz, "updatedAt" timestamptz,
       "enrollmentId" text, "teacherId" text, period text)
  on conflict (organization_id, id) do update set type = excluded.type, amount = excluded.amount, method = excluded.method,
    category = excluded.category, note = excluded.note, customer_id = excluded.customer_id, customer_name = excluded.customer_name,
    status = excluded.status, source = excluded.source, date = excluded.date, updated_at = excluded.updated_at,
    enrollment_id = excluded.enrollment_id, teacher_id = excluded.teacher_id, period = excluded.period;
  get diagnostics v_transactions = row_count;

  insert into public.attendance (organization_id, id, group_id, customer_id, date, status, note, marked_by)
  select v_org, a.id, a."groupId", a."customerId", a.date, a.status, a.note, a."markedBy"
  from jsonb_to_recordset(coalesce(p_data -> 'attendance', '[]')) as a(id text, "groupId" text, "customerId" text, date date, status text, note text, "markedBy" text)
  on conflict (organization_id, group_id, customer_id, date) do update set status = excluded.status, note = excluded.note, marked_by = excluded.marked_by;

  insert into public.lesson_exceptions (organization_id, id, group_id, date, reason)
  select v_org, x.id, x."groupId", x.date, coalesce(x.reason, '')
  from jsonb_to_recordset(coalesce(p_data -> 'lessonExceptions', '[]')) as x(id text, "groupId" text, date date, reason text)
  on conflict (organization_id, group_id, date) do update set reason = excluded.reason;

  if p_data ? 'settings' then
    update public.organizations set settings = p_data -> 'settings', name = coalesce(nullif(p_data -> 'settings' ->> 'orgName', ''), name)
    where id = v_org;
  end if;
  perform public.write_audit(v_org, 'data.import', v_customers || ' mijoz, ' || v_transactions || ' tranzaksiya, ' || v_courses || ' kurs, '
    || v_groups || ' guruh', null);
  return jsonb_build_object('customers', v_customers, 'transactions', v_transactions, 'courses', v_courses, 'groups', v_groups, 'enrollments', v_enrollments);
end $$;

-- ===== Huquqlar =====
revoke execute on function public.teacher_owns_group(text), public.sees_group(text), public.attendance_edit_days(),
  public.attendance_day_allowed(text, date), public.teacher_roster(), public.teacher_directory(), public.touch_updated_at(),
  public.audit_attendance(), public.audit_lesson_exception() from public, anon;
grant execute on function public.teacher_owns_group(text), public.sees_group(text), public.attendance_edit_days(),
  public.attendance_day_allowed(text, date), public.teacher_roster(), public.teacher_directory() to authenticated;
grant select, insert, update, delete on public.teachers, public.groups, public.enrollments, public.attendance, public.lesson_exceptions to authenticated;
