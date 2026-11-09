-- EduFlow v1.2: filiallar. Guruh, o'quvchi va to'lov filialga biriktiriladi. Xodimni bitta filialga cheklash mumkin —
-- u faqat shu filial guruhlari, o'quvchilari (shu filialniki yoki shu filial guruhida o'qiydigan) va to'lovlarini ko'radi
-- va yozadi. Filialsiz xodim (profiles.branch_id null) — butun markazni. Filialsiz yozuvlarni (masalan, umumiy xarajat)
-- faqat filialsiz xodim ko'radi. Ilovadagi aynan shu qoida: src/context/DashboardContext.tsx (branchScope).

-- ===== Filiallar =====
create table public.branches (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 2 and 60),
  address text not null default '' check (char_length(address) <= 120),
  phone text not null default '' check (char_length(phone) <= 20),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (organization_id, id)
);
alter table public.branches enable row level security;

-- Filial o'chirilsa yozuvlar filialsiz qoladi (ilova faqat ishlatilmagan filialni o'chiradi);
-- xodim biriktirilgan filial o'chirilmaydi — aks holda u butun markazni ko'rib qolardi
alter table public.customers add column branch_id text;
alter table public.groups add column branch_id text;
alter table public.transactions add column branch_id text;
alter table public.profiles add column branch_id text;
alter table public.customers add constraint customers_branch_fk foreign key (organization_id, branch_id)
  references public.branches (organization_id, id) on delete set null (branch_id);
alter table public.groups add constraint groups_branch_fk foreign key (organization_id, branch_id)
  references public.branches (organization_id, id) on delete set null (branch_id);
alter table public.transactions add constraint transactions_branch_fk foreign key (organization_id, branch_id)
  references public.branches (organization_id, id) on delete set null (branch_id);
alter table public.profiles add constraint profiles_branch_fk foreign key (organization_id, branch_id)
  references public.branches (organization_id, id) on delete restrict;
create index customers_branch_idx on public.customers (organization_id, branch_id);
create index groups_branch_idx on public.groups (organization_id, branch_id);
create index transactions_branch_idx on public.transactions (organization_id, branch_id);

-- ===== Yordamchi funksiyalar (RLS ichida) =====
create or replace function public.current_branch_id() returns text
language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid() and status = 'active'
$$;

-- Filialsiz xodim — hammasi; filialli — faqat o'z filiali (filialsiz yozuv emas)
create or replace function public.branch_allowed(p_branch text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_branch_id() is null or p_branch = public.current_branch_id()
$$;

-- O'quvchi: o'z filialiniki yoki shu filial guruhida o'qiydi (boshqa filialda ro'yxatdan o'tgan bo'lsa ham)
create or replace function public.customer_visible(p_customer text, p_branch text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_branch_id() is null or p_branch = public.current_branch_id() or exists (
    select 1 from public.enrollments e
    join public.groups g on g.organization_id = e.organization_id and g.id = e.group_id
    where e.organization_id = public.current_org_id() and e.customer_id = p_customer and g.branch_id = public.current_branch_id()
  )
$$;

-- Faqat id bo'yicha (telegram_links, sms_log, payment_transactions)
create or replace function public.customer_id_visible(p_customer text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_branch_id() is null or exists (
    select 1 from public.customers c
    where c.organization_id = public.current_org_id() and c.id = p_customer and public.customer_visible(c.id, c.branch_id)
  )
$$;

-- O'qituvchi faqat o'z guruhlarini, boshqa rollar — markazning (filialga cheklangan bo'lsa — shu filialning) guruhlarini.
-- groups, enrollments, attendance, lesson_exceptions SELECT siyosatlari shu funksiya orqali filialni ham hisobga oladi
create or replace function public.sees_group(p_group text) returns boolean
language sql stable security definer set search_path = public as $$
  select (coalesce(public.current_app_role() <> 'teacher', false) or public.teacher_owns_group(p_group))
    and (public.current_branch_id() is null or exists (
      select 1 from public.groups g
      where g.organization_id = public.current_org_id() and g.id = p_group and g.branch_id = public.current_branch_id()
    ))
$$;

-- Mijoz to'lovi filialsiz kelsa (Payme/Click, eski ilova): o'qish guruhining, bo'lmasa o'quvchining filiali
create or replace function public.transactions_fill_branch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.branch_id is null and new.customer_id is not null then
    if new.enrollment_id is not null then
      select g.branch_id into new.branch_id
      from public.enrollments e join public.groups g on g.organization_id = e.organization_id and g.id = e.group_id
      where e.organization_id = new.organization_id and e.id = new.enrollment_id;
    end if;
    if new.branch_id is null then
      select c.branch_id into new.branch_id from public.customers c where c.organization_id = new.organization_id and c.id = new.customer_id;
    end if;
  end if;
  return new;
end $$;
create trigger transactions_branch before insert on public.transactions for each row execute function public.transactions_fill_branch();

-- Jurnal: filial qo'shildi / o'zgartirildi / arxivlandi / o'chirildi
create or replace function public.audit_branch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_row public.branches := coalesce(new, old);
begin
  if tg_op = 'INSERT' then
    v_action := 'branch.create';
  elsif tg_op = 'DELETE' then
    v_action := 'branch.delete';
  elsif old.status = 'active' and new.status = 'archived' then
    v_action := 'branch.archive';
  else
    v_action := 'branch.update';
  end if;
  perform public.write_audit(v_row.organization_id, v_action, v_row.name, v_row.id);
  return v_row;
end $$;
create trigger branches_audit after insert or update or delete on public.branches for each row execute function public.audit_branch();
create trigger branches_touch before update on public.branches for each row execute function public.touch_updated_at();

-- ===== RLS =====
-- Filiallar: ro'yxatni hamma xodim ko'radi (filialli — faqat o'zinikini); boshqarish — filialsiz administrator
create policy branches_select on public.branches for select
  using (organization_id = public.current_org_id() and public.branch_allowed(id));
create policy branches_insert on public.branches for insert
  with check (organization_id = public.current_org_id() and public.has_permission('settings.manage') and public.current_branch_id() is null
              and public.org_writable());
create policy branches_update on public.branches for update
  using (organization_id = public.current_org_id() and public.has_permission('settings.manage') and public.current_branch_id() is null
         and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy branches_delete on public.branches for delete
  using (organization_id = public.current_org_id() and public.has_permission('settings.manage') and public.current_branch_id() is null
         and public.org_writable());
grant select, insert, update, delete on public.branches to authenticated;

-- Mijozlar
drop policy customers_select on public.customers;
drop policy customers_insert on public.customers;
drop policy customers_update on public.customers;
drop policy customers_delete on public.customers;
create policy customers_select on public.customers for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view') and public.customer_visible(id, branch_id)
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy customers_insert on public.customers for insert
  with check (organization_id = public.current_org_id() and public.has_permission('customers.edit') and public.org_writable()
              and public.branch_allowed(branch_id));
create policy customers_update on public.customers for update
  using (organization_id = public.current_org_id() and public.org_writable() and public.customer_visible(id, branch_id)
         and (public.has_permission('customers.edit') or public.has_permission('customers.delete')))
  with check (organization_id = public.current_org_id() and public.customer_visible(id, branch_id));
create policy customers_delete on public.customers for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null
         and public.customer_visible(id, branch_id));

-- To'lovlar
drop policy transactions_select on public.transactions;
drop policy transactions_insert on public.transactions;
drop policy transactions_update on public.transactions;
drop policy transactions_delete on public.transactions;
create policy transactions_select on public.transactions for select
  using (organization_id = public.current_org_id() and public.has_permission('payments.view') and public.branch_allowed(branch_id)
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy transactions_insert on public.transactions for insert
  with check (organization_id = public.current_org_id() and public.org_writable() and public.branch_allowed(branch_id)
              and (public.has_permission('payments.manage') or (type = 'income' and public.has_permission('payments.create'))));
create policy transactions_update on public.transactions for update
  using (organization_id = public.current_org_id() and public.has_permission('payments.manage') and public.org_writable()
         and public.branch_allowed(branch_id))
  with check (organization_id = public.current_org_id() and public.branch_allowed(branch_id));
create policy transactions_delete on public.transactions for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null
         and public.branch_allowed(branch_id));

-- Guruhlar (ko'rish — sees_group orqali)
drop policy groups_insert on public.groups;
drop policy groups_update on public.groups;
drop policy groups_delete on public.groups;
create policy groups_insert on public.groups for insert
  with check (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
              and public.branch_allowed(branch_id));
create policy groups_update on public.groups for update
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
         and public.branch_allowed(branch_id))
  with check (organization_id = public.current_org_id() and public.branch_allowed(branch_id));
create policy groups_delete on public.groups for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null
         and public.branch_allowed(branch_id));

-- O'qish, davomat, bekor qilingan darslar: yozish ham faqat ko'rinadigan guruhda
drop policy enrollments_insert on public.enrollments;
drop policy enrollments_update on public.enrollments;
drop policy enrollments_delete on public.enrollments;
create policy enrollments_insert on public.enrollments for insert
  with check (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
              and public.sees_group(group_id));
create policy enrollments_update on public.enrollments for update
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
         and public.sees_group(group_id))
  with check (organization_id = public.current_org_id() and public.sees_group(group_id));
create policy enrollments_delete on public.enrollments for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null
         and public.sees_group(group_id));

drop policy attendance_insert on public.attendance;
drop policy attendance_update on public.attendance;
drop policy attendance_delete on public.attendance;
create policy attendance_insert on public.attendance for insert
  with check (organization_id = public.current_org_id() and public.has_permission('attendance.mark') and public.org_writable()
              and public.attendance_day_allowed(group_id, date) and public.sees_group(group_id));
create policy attendance_update on public.attendance for update
  using (organization_id = public.current_org_id() and public.has_permission('attendance.mark') and public.org_writable()
         and public.attendance_day_allowed(group_id, date) and public.sees_group(group_id))
  with check (organization_id = public.current_org_id() and public.attendance_day_allowed(group_id, date) and public.sees_group(group_id));
create policy attendance_delete on public.attendance for delete
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
         and public.sees_group(group_id));

drop policy lesson_exceptions_insert on public.lesson_exceptions;
drop policy lesson_exceptions_update on public.lesson_exceptions;
drop policy lesson_exceptions_delete on public.lesson_exceptions;
create policy lesson_exceptions_insert on public.lesson_exceptions for insert
  with check (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
              and public.sees_group(group_id));
create policy lesson_exceptions_update on public.lesson_exceptions for update
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
         and public.sees_group(group_id))
  with check (organization_id = public.current_org_id() and public.sees_group(group_id));
create policy lesson_exceptions_delete on public.lesson_exceptions for delete
  using (organization_id = public.current_org_id() and public.has_permission('groups.edit') and public.org_writable()
         and public.sees_group(group_id));

-- Onlayn to'lovlar, SMS jurnali, bot bog'lanishlari — o'quvchi ko'rinadigan bo'lsa
drop policy payment_transactions_select on public.payment_transactions;
create policy payment_transactions_select on public.payment_transactions for select
  using (organization_id = public.current_org_id() and public.has_permission('payments.view')
         and (public.current_branch_id() is null or public.customer_id_visible(customer_id)));
drop policy sms_log_select on public.sms_log;
create policy sms_log_select on public.sms_log for select
  using (organization_id = public.current_org_id() and public.has_permission('payments.view')
         and (public.current_branch_id() is null or public.customer_id_visible(customer_id)));
drop policy telegram_links_select on public.telegram_links;
create policy telegram_links_select on public.telegram_links for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view') and public.customer_id_visible(customer_id));

-- Amallar jurnalida butun markaz amallari — faqat filialsiz xodim
drop policy audit_select on public.audit_log;
create policy audit_select on public.audit_log for select
  using (organization_id = public.current_org_id() and public.has_permission('audit.view') and public.current_branch_id() is null);

-- ===== Savatcha: filialli xodim faqat o'zi ko'radigan yozuvlarni o'tkazadi / qaytaradi =====
create or replace function public.trash_scope(p_table text) returns text
language sql immutable as $$
  select case p_table
    when 'customers' then 'public.customer_visible(id, branch_id)'
    when 'transactions' then 'public.branch_allowed(branch_id)'
    when 'groups' then 'public.branch_allowed(branch_id)'
    when 'enrollments' then 'public.sees_group(group_id)'
    else 'true'
  end
$$;

create or replace function public.trash_move(p_table text, p_ids text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_by text := (select full_name from public.profiles where id = auth.uid());
begin
  if public.trash_permission(p_table) is null then
    raise exception 'unknown table' using errcode = '22023';
  end if;
  if not public.has_permission(public.trash_permission(p_table)) or not public.org_writable() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  perform set_config('eduflow.trash_op', '1', true);
  execute format('update public.%I set deleted_at = now(), deleted_by = $1 where organization_id = $2 and id = any($3) and deleted_at is null and '
    || public.trash_scope(p_table), p_table)
    using v_by, public.current_org_id(), p_ids;
  get diagnostics v_count = row_count;
  perform set_config('eduflow.trash_op', '', true);
  return v_count;
end $$;

create or replace function public.trash_restore(p_table text, p_ids text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if public.trash_permission(p_table) is null then
    raise exception 'unknown table' using errcode = '22023';
  end if;
  if not (public.has_permission('trash.manage') or public.has_permission(public.trash_permission(p_table))) or not public.org_writable() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  perform set_config('eduflow.trash_op', '1', true);
  execute format('update public.%I set deleted_at = null, deleted_by = null where organization_id = $1 and id = any($2) and deleted_at is not null and '
    || public.trash_scope(p_table), p_table)
    using public.current_org_id(), p_ids;
  get diagnostics v_count = row_count;
  perform set_config('eduflow.trash_op', '', true);
  return v_count;
end $$;

-- ===== Xodimni filialga biriktirish (null — butun markaz) =====
create or replace function public.set_staff_branch(p_id uuid, p_branch text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_target public.profiles;
begin
  if not public.has_permission('staff.manage') or public.current_branch_id() is not null or not public.org_writable() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_id and organization_id = v_org;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_branch is not null and not exists (select 1 from public.branches where organization_id = v_org and id = p_branch) then
    raise exception 'unknown branch' using errcode = '22023';
  end if;
  -- Markazda kamida bitta filialsiz faol administrator qoladi (aks holda filiallarni boshqaradigan odam qolmaydi)
  if p_branch is not null and v_target.role = 'admin' and not exists (
    select 1 from public.profiles
    where organization_id = v_org and role = 'admin' and status = 'active' and branch_id is null and id <> p_id
  ) then
    raise exception 'last admin' using errcode = '42501';
  end if;
  update public.profiles set branch_id = p_branch where id = p_id;
  perform public.write_audit(v_org, 'staff.update', v_target.full_name || ': ' || coalesce(
    (select name from public.branches where organization_id = v_org and id = p_branch), 'barcha filiallar'), p_id::text);
end $$;

-- ===== Xodimni o'zgartirish: filialli administrator faqat o'z filiali xodimlarini boshqaradi;
-- markazda kamida bitta filialsiz faol administrator qoladi =====
create or replace function public.update_staff(p_id uuid, p_role public.app_role default null, p_status text default null,
                                               p_full_name text default null, p_title text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target public.profiles;
  v_admins integer;
begin
  if not public.has_permission('staff.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_id and organization_id = public.current_org_id();
  if not found then
    raise exception 'staff not found' using errcode = 'P0002';
  end if;
  if public.current_branch_id() is not null and v_target.branch_id is distinct from public.current_branch_id() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_id = auth.uid() and ((p_role is not null and p_role <> v_target.role) or p_status = 'blocked') then
    raise exception 'cannot change own role or block yourself' using errcode = '42501';
  end if;
  update public.profiles set
    role = coalesce(p_role, role),
    status = coalesce(p_status, status),
    full_name = coalesce(trim(p_full_name), full_name),
    title = coalesce(trim(p_title), title)
  where id = p_id;
  select count(*) into v_admins from public.profiles
  where organization_id = v_target.organization_id and role = 'admin' and status = 'active' and branch_id is null;
  if v_admins = 0 then
    raise exception 'at least one active administrator is required' using errcode = '23514';
  end if;
  perform public.write_audit(v_target.organization_id,
    case when p_status = 'blocked' then 'staff.block' when p_status = 'active' and v_target.status = 'blocked' then 'staff.unblock' else 'staff.update' end,
    coalesce(trim(p_full_name), v_target.full_name), p_id::text);
end $$;

-- ===== JSON zaxirani import qilish: filiallar va branch_id bilan =====
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
  if not public.has_permission('data.manage') or not public.org_writable() or public.current_branch_id() is not null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.courses (organization_id, id, name, type, duration_months, monthly_price, status, created_at, updated_at)
  select v_org, c.id, c.name, c.type, c."durationMonths", c."monthlyPrice", c.status, c."createdAt", c."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'courses', '[]')) as c(id text, name text, type text, "durationMonths" int, "monthlyPrice" bigint,
       status text, "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, type = excluded.type, duration_months = excluded.duration_months,
    monthly_price = excluded.monthly_price, status = excluded.status, updated_at = excluded.updated_at;
  get diagnostics v_courses = row_count;

  insert into public.branches (organization_id, id, name, address, phone, status, created_at, updated_at)
  select v_org, b.id, b.name, coalesce(b.address, ''), coalesce(b.phone, ''), coalesce(b.status, 'active'), b."createdAt", b."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'branches', '[]')) as b(id text, name text, address text, phone text, status text,
       "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, address = excluded.address, phone = excluded.phone,
    status = excluded.status, updated_at = excluded.updated_at;

  insert into public.teachers (organization_id, id, name, phone, subjects, pay_rule, status, created_at, updated_at)
  select v_org, t.id, t.name, coalesce(t.phone, ''), coalesce(t.subjects, '{}'), coalesce(t."payRule", '{"type": "fixed", "amount": 0}'), t.status, t."createdAt", t."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'teachers', '[]')) as t(id text, name text, phone text, subjects text[], "payRule" jsonb, status text,
       "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, phone = excluded.phone, subjects = excluded.subjects,
    pay_rule = excluded.pay_rule, status = excluded.status;

  insert into public.customers (organization_id, id, name, phone, email, course, status, source, note, created_at, updated_at, paid_at, branch_id)
  select v_org, c.id, c.name, c.phone, c.email, c.course, c.status, c.source, c.note, c."createdAt", c."updatedAt", c."paidAt", nullif(c."branchId", '')
  from jsonb_to_recordset(coalesce(p_data -> 'customers', '[]')) as c(id text, name text, phone text, email text, course text, status text,
       source text, note text, "createdAt" timestamptz, "updatedAt" timestamptz, "paidAt" timestamptz, "branchId" text)
  on conflict (organization_id, id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email, course = excluded.course,
    status = excluded.status, source = excluded.source, note = excluded.note, updated_at = excluded.updated_at, paid_at = excluded.paid_at,
    branch_id = excluded.branch_id;
  get diagnostics v_customers = row_count;

  insert into public.groups (organization_id, id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, start_date, end_date, status, created_at,
                             branch_id)
  select v_org, g.id, g.name, g."courseId", g."teacherId", coalesce(g.room, ''), g.days, g."startTime"::time, g."endTime"::time, g.capacity,
         g."startDate", g."endDate", g.status, g."createdAt", nullif(g."branchId", '')
  from jsonb_to_recordset(coalesce(p_data -> 'groups', '[]')) as g(id text, name text, "courseId" text, "teacherId" text, room text, days text[],
       "startTime" text, "endTime" text, capacity int, "startDate" date, "endDate" date, status text, "createdAt" timestamptz, "branchId" text)
  on conflict (organization_id, id) do update set name = excluded.name, course_id = excluded.course_id, teacher_id = excluded.teacher_id,
    room = excluded.room, days = excluded.days, start_time = excluded.start_time, end_time = excluded.end_time, capacity = excluded.capacity,
    start_date = excluded.start_date, end_date = excluded.end_date, status = excluded.status, branch_id = excluded.branch_id;
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
                                   enrollment_id, teacher_id, period, branch_id)
  select v_org, t.id, t.type, t.amount, t.method, t.category, coalesce(t.note, ''), t."customerId", t."customerName", t.status, t.source, t.date, t."updatedAt",
         t."enrollmentId", t."teacherId", t.period, nullif(t."branchId", '')
  from jsonb_to_recordset(coalesce(p_data -> 'transactions', '[]')) as t(id text, type text, amount bigint, method text, category text, note text,
       "customerId" text, "customerName" text, status text, source text, date timestamptz, "updatedAt" timestamptz,
       "enrollmentId" text, "teacherId" text, period text, "branchId" text)
  on conflict (organization_id, id) do update set type = excluded.type, amount = excluded.amount, method = excluded.method,
    category = excluded.category, note = excluded.note, customer_id = excluded.customer_id, customer_name = excluded.customer_name,
    status = excluded.status, source = excluded.source, date = excluded.date, updated_at = excluded.updated_at,
    enrollment_id = excluded.enrollment_id, teacher_id = excluded.teacher_id, period = excluded.period, branch_id = excluded.branch_id;
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
revoke execute on function public.current_branch_id(), public.branch_allowed(text), public.customer_visible(text, text),
  public.customer_id_visible(text), public.trash_scope(text), public.set_staff_branch(uuid, text),
  public.transactions_fill_branch(), public.audit_branch() from public, anon;
grant execute on function public.current_branch_id(), public.branch_allowed(text), public.customer_visible(text, text),
  public.customer_id_visible(text), public.trash_scope(text), public.set_staff_branch(uuid, text) to authenticated;
