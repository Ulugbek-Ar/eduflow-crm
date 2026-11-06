-- EduFlow CRM: bulutli rejim sxemasi (Supabase / PostgreSQL 15+)
-- Har bir markaz (organization) ma'lumoti RLS bilan ajratilgan. Ruxsatlar jadvali src/auth/permissions.ts bilan bir xil.
-- Ilova id'lari matn (masalan, "c…", "t…") — lokal ma'lumot va JSON zaxiralar shu holicha import qilinadi.

-- ===== Turlar =====
create type public.app_role as enum ('admin', 'manager', 'cashier', 'viewer');
create type public.plan_id as enum ('trial', 'standard', 'pro');

-- ===== Tashkilotlar (markazlar) =====
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  plan public.plan_id not null default 'trial',
  status text not null default 'active' check (status in ('active', 'blocked')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  -- To'lovli tarif shu sanagacha (null — muddatsiz)
  paid_until timestamptz,
  -- Ilovadagi Settings obyekti (nom, logo, valyuta, sana formati...)
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ===== Xodimlar profili (auth.users bilan 1:1) =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 60),
  title text not null default '' check (char_length(title) <= 40),
  role public.app_role not null default 'viewer',
  status text not null default 'active' check (status in ('active', 'blocked')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create index profiles_org_idx on public.profiles (organization_id);

-- Sotuvchi (platforma egasi) — barcha markazlarni ko'radi va tarifini boshqaradi
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ===== Biznes ma'lumotlari =====
create table public.courses (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 2 and 80),
  type text not null check (type in ('course', 'service')),
  duration_months integer not null default 0 check (duration_months between 0 and 60),
  monthly_price bigint not null default 0 check (monthly_price >= 0),
  active_groups integer not null default 0 check (active_groups between 0 and 999),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  primary key (organization_id, id)
);

create table public.customers (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null default '',
  email text,
  course text not null default '',
  status text not null check (status in ('new', 'contacted', 'thinking', 'paid', 'cancelled')),
  source text not null check (source in ('telegram', 'instagram', 'website', 'referral')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  paid_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  primary key (organization_id, id)
);
create index customers_org_status_idx on public.customers (organization_id, status) where deleted_at is null;

create table public.transactions (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  method text not null check (method in ('cash', 'card', 'transfer')),
  category text not null,
  note text not null default '',
  customer_id text,
  customer_name text,
  status text not null default 'paid' check (status in ('paid', 'pending', 'cancelled')),
  source text check (source in ('telegram', 'instagram', 'website', 'referral')),
  date timestamptz not null,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  primary key (organization_id, id)
);
create index transactions_org_date_idx on public.transactions (organization_id, date desc) where deleted_at is null;

-- Amallar jurnali: faqat qo'shiladi (tahrirlab ham, o'chirib ham bo'lmaydi)
create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  at timestamptz not null default now(),
  user_id uuid,
  user_name text not null default '',
  role public.app_role,
  action text not null,
  summary text not null default '' check (char_length(summary) <= 200),
  entity_id text
);
create index audit_log_org_at_idx on public.audit_log (organization_id, at desc);

-- ===== Yordamchi funksiyalar (RLS ichida ishlatiladi) =====
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

-- src/auth/permissions.ts dagi ROLE_PERMISSIONS bilan bir xil
create or replace function public.role_has_permission(r public.app_role, p text) returns boolean
language sql immutable as $$
  select case r
    when 'admin' then true
    when 'manager' then p = any (array['customers.view', 'customers.edit', 'customers.delete', 'payments.view', 'payments.create', 'courses.view'])
    when 'cashier' then p = any (array['customers.view', 'payments.view', 'payments.create', 'payments.manage', 'courses.view', 'analytics.view', 'reports.export'])
    when 'viewer' then p = any (array['customers.view', 'payments.view', 'courses.view', 'analytics.view'])
    else false
  end
$$;

create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.role_has_permission(public.current_app_role(), p), false)
$$;

-- Yozish mumkinmi: markaz to'xtatilmagan va tarif muddati o'tmagan
create or replace function public.org_writable() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.status = 'active'
      and coalesce(case when o.plan = 'trial' then o.trial_ends_at else o.paid_until end, 'infinity'::timestamptz) > now()
    from public.organizations o where o.id = public.current_org_id()
  ), false)
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- ===== Jurnal (server tomonida — mijoz o'tkazib yubora olmaydi) =====
create or replace function public.write_audit(p_org uuid, p_action text, p_summary text, p_entity text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  insert into public.audit_log (organization_id, user_id, user_name, role, action, summary, entity_id)
  values (p_org, auth.uid(), coalesce(v_profile.full_name, ''), v_profile.role, p_action, left(coalesce(p_summary, ''), 200), p_entity);
end $$;

-- Ilova yuboradigan hodisalar (kirish, eksport, zaxira): faqat ruxsat etilgan turlar
create or replace function public.log_event(p_action text, p_summary text default '', p_entity text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_org_id() is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if p_action not in ('auth.login', 'auth.logout', 'auth.password', 'data.export', 'data.backup', 'data.import', 'session.revoke', 'settings.update') then
    raise exception 'action not allowed: %', p_action using errcode = '22023';
  end if;
  perform public.write_audit(public.current_org_id(), p_action, p_summary, p_entity);
end $$;

-- Mijoz, to'lov va kurs o'zgarishlari jurnalga avtomatik yoziladi
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := case tg_table_name when 'customers' then 'customer' when 'transactions' then 'payment' else 'course' end;
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_summary text := coalesce(v_row ->> 'name', (v_row ->> 'amount') || ' · ' || coalesce(v_row ->> 'customer_name', v_row ->> 'category'));
  v_action text;
begin
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
  elsif v_kind = 'course' and old.status = 'active' and new.status = 'archived' then
    v_action := 'course.archive';
  else
    v_action := v_kind || '.update';
  end if;
  perform public.write_audit((v_row ->> 'organization_id')::uuid, v_action, v_summary, v_row ->> 'id');
  return coalesce(new, old);
end $$;

create trigger customers_audit after insert or update or delete on public.customers for each row execute function public.audit_row();
create trigger transactions_audit after insert or update or delete on public.transactions for each row execute function public.audit_row();
create trigger courses_audit after insert or update or delete on public.courses for each row execute function public.audit_row();

-- Savatcha: deleted_at faqat trash_move / trash_restore RPC orqali o'zgaradi (to'g'ridan-to'g'ri UPDATE bilan emas)
create or replace function public.guard_soft_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at and coalesce(current_setting('eduflow.trash_op', true), '') <> '1' then
    raise exception 'use trash_move / trash_restore' using errcode = '42501';
  end if;
  -- organization_id ni boshqa markazga o'zgartirib bo'lmaydi
  if new.organization_id <> old.organization_id then
    raise exception 'organization_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger customers_guard before update on public.customers for each row execute function public.guard_soft_delete();
create trigger transactions_guard before update on public.transactions for each row execute function public.guard_soft_delete();
create trigger courses_guard before update on public.courses for each row execute function public.guard_soft_delete();

-- ===== RLS =====
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.courses enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_log enable row level security;

-- Markaz: o'zinikini ko'radi; nom va sozlamalarni administrator o'zgartiradi. Tarif/holat — faqat sotuvchi (RPC)
create policy org_select on public.organizations for select using (id = public.current_org_id() or public.is_platform_admin());
create policy org_update on public.organizations for update
  using (id = public.current_org_id() and public.has_permission('settings.manage'))
  with check (id = public.current_org_id() and public.has_permission('settings.manage'));
revoke update on public.organizations from authenticated, anon;
grant update (name, settings) on public.organizations to authenticated;

-- Xodimlar: o'z markazidagilarni ko'radi; o'zgartirish faqat RPC orqali (oxirgi administrator himoyasi)
create policy profiles_select on public.profiles for select
  using (organization_id = public.current_org_id() or id = auth.uid() or public.is_platform_admin());
revoke insert, update, delete on public.profiles from authenticated, anon;

create policy platform_admins_self on public.platform_admins for select using (user_id = auth.uid());

-- Kurslar
create policy courses_select on public.courses for select
  using (organization_id = public.current_org_id() and public.has_permission('courses.view')
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy courses_insert on public.courses for insert
  with check (organization_id = public.current_org_id() and public.has_permission('courses.edit') and public.org_writable());
create policy courses_update on public.courses for update
  using (organization_id = public.current_org_id() and public.has_permission('courses.edit') and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy courses_delete on public.courses for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null);

-- Mijozlar
create policy customers_select on public.customers for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view')
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy customers_insert on public.customers for insert
  with check (organization_id = public.current_org_id() and public.has_permission('customers.edit') and public.org_writable());
create policy customers_update on public.customers for update
  using (organization_id = public.current_org_id() and public.org_writable()
         and (public.has_permission('customers.edit') or public.has_permission('customers.delete')))
  with check (organization_id = public.current_org_id());
create policy customers_delete on public.customers for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null);

-- To'lovlar: kirimni menejer ham yozadi, xarajat va tahrir — moliya ruxsati bilan
create policy transactions_select on public.transactions for select
  using (organization_id = public.current_org_id() and public.has_permission('payments.view')
         and (deleted_at is null or public.has_permission('trash.manage')));
create policy transactions_insert on public.transactions for insert
  with check (organization_id = public.current_org_id() and public.org_writable()
              and (public.has_permission('payments.manage') or (type = 'income' and public.has_permission('payments.create'))));
create policy transactions_update on public.transactions for update
  using (organization_id = public.current_org_id() and public.has_permission('payments.manage') and public.org_writable())
  with check (organization_id = public.current_org_id());
create policy transactions_delete on public.transactions for delete
  using (organization_id = public.current_org_id() and public.has_permission('trash.manage') and deleted_at is not null);

-- Jurnal: faqat o'qish (yozish — triggerlar va log_event orqali)
create policy audit_select on public.audit_log for select
  using (organization_id = public.current_org_id() and public.has_permission('audit.view'));
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- ===== RPC: ro'yxatdan o'tish, xodimlar, import, sotuvchi =====

-- Yangi markaz: joriy foydalanuvchi uning administratori bo'ladi, 14 kunlik sinov
create or replace function public.create_organization(p_name text, p_full_name text, p_title text default 'Direktor')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'already a member of an organization' using errcode = '23505';
  end if;
  insert into public.organizations (name, settings)
  values (trim(p_name), jsonb_build_object('orgName', trim(p_name)))
  returning id into v_org;
  insert into public.profiles (id, organization_id, full_name, title, role, last_login_at)
  values (auth.uid(), v_org, trim(p_full_name), coalesce(trim(p_title), ''), 'admin', now());
  perform public.write_audit(v_org, 'staff.create', 'Birinchi administrator: ' || trim(p_full_name), auth.uid()::text);
  return v_org;
end $$;

-- O'z profili: ism va lavozim
create or replace function public.update_own_profile(p_full_name text, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set full_name = trim(p_full_name), title = trim(p_title) where id = auth.uid();
end $$;

-- Vaqtinchalik parol almashtirilgach
create or replace function public.password_changed() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

-- Kirishda: oxirgi kirish vaqti
create or replace function public.touch_login() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

-- Administrator: xodim roli, holati va ma'lumotlari. O'zini va oxirgi faol administratorni o'zgartirib bo'lmaydi
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
  where organization_id = v_target.organization_id and role = 'admin' and status = 'active';
  if v_admins = 0 then
    raise exception 'at least one active administrator is required' using errcode = '23514';
  end if;
  perform public.write_audit(v_target.organization_id,
    case when p_status = 'blocked' then 'staff.block' when p_status = 'active' and v_target.status = 'blocked' then 'staff.unblock' else 'staff.update' end,
    coalesce(trim(p_full_name), v_target.full_name), p_id::text);
end $$;

-- Lokal ma'lumot yoki JSON zaxirani bulutga ko'chirish (mavjud yozuvlar yangilanadi)
create or replace function public.import_backup(p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_customers integer;
  v_transactions integer;
  v_courses integer;
begin
  if not public.has_permission('data.manage') or not public.org_writable() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.courses (organization_id, id, name, type, duration_months, monthly_price, active_groups, status, created_at, updated_at)
  select v_org, c.id, c.name, c.type, c."durationMonths", c."monthlyPrice", c."activeGroups", c.status, c."createdAt", c."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'courses', '[]')) as c(id text, name text, type text, "durationMonths" int, "monthlyPrice" bigint,
       "activeGroups" int, status text, "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, type = excluded.type, duration_months = excluded.duration_months,
    monthly_price = excluded.monthly_price, active_groups = excluded.active_groups, status = excluded.status, updated_at = excluded.updated_at;
  get diagnostics v_courses = row_count;

  insert into public.customers (organization_id, id, name, phone, email, course, status, source, note, created_at, updated_at, paid_at)
  select v_org, c.id, c.name, c.phone, c.email, c.course, c.status, c.source, c.note, c."createdAt", c."updatedAt", c."paidAt"
  from jsonb_to_recordset(coalesce(p_data -> 'customers', '[]')) as c(id text, name text, phone text, email text, course text, status text,
       source text, note text, "createdAt" timestamptz, "updatedAt" timestamptz, "paidAt" timestamptz)
  on conflict (organization_id, id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email, course = excluded.course,
    status = excluded.status, source = excluded.source, note = excluded.note, updated_at = excluded.updated_at, paid_at = excluded.paid_at;
  get diagnostics v_customers = row_count;

  insert into public.transactions (organization_id, id, type, amount, method, category, note, customer_id, customer_name, status, source, date, updated_at)
  select v_org, t.id, t.type, t.amount, t.method, t.category, coalesce(t.note, ''), t."customerId", t."customerName", t.status, t.source, t.date, t."updatedAt"
  from jsonb_to_recordset(coalesce(p_data -> 'transactions', '[]')) as t(id text, type text, amount bigint, method text, category text, note text,
       "customerId" text, "customerName" text, status text, source text, date timestamptz, "updatedAt" timestamptz)
  on conflict (organization_id, id) do update set type = excluded.type, amount = excluded.amount, method = excluded.method,
    category = excluded.category, note = excluded.note, customer_id = excluded.customer_id, customer_name = excluded.customer_name,
    status = excluded.status, source = excluded.source, date = excluded.date, updated_at = excluded.updated_at;
  get diagnostics v_transactions = row_count;

  if p_data ? 'settings' then
    update public.organizations set settings = p_data -> 'settings', name = coalesce(nullif(p_data -> 'settings' ->> 'orgName', ''), name)
    where id = v_org;
  end if;
  perform public.write_audit(v_org, 'data.import', v_customers || ' mijoz, ' || v_transactions || ' tranzaksiya, ' || v_courses || ' kurs', null);
  return jsonb_build_object('customers', v_customers, 'transactions', v_transactions, 'courses', v_courses);
end $$;

-- Savatchaga o'tkazish / qaytarish. Ruxsat: mijoz — customers.delete, to'lov — payments.manage, kurs — courses.edit;
-- qaytarishga savatcha ruxsati (trash.manage) ham yetadi
create or replace function public.trash_permission(p_table text) returns text
language sql immutable as $$
  select case p_table when 'customers' then 'customers.delete' when 'transactions' then 'payments.manage' when 'courses' then 'courses.edit' end
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
  execute format('update public.%I set deleted_at = now(), deleted_by = $1 where organization_id = $2 and id = any($3) and deleted_at is null', p_table)
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
  execute format('update public.%I set deleted_at = null, deleted_by = null where organization_id = $1 and id = any($2) and deleted_at is not null', p_table)
    using public.current_org_id(), p_ids;
  get diagnostics v_count = row_count;
  perform set_config('eduflow.trash_op', '', true);
  return v_count;
end $$;

-- Savatcha: 30 kundan eski o'chirilganlar butunlay o'chiriladi (pg_cron bilan har kuni — README)
create or replace function public.purge_trash() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_total integer := 0;
  v_count integer;
begin
  delete from public.customers where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.transactions where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.courses where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count; v_total := v_total + v_count;
  delete from public.audit_log where at < now() - interval '1 year';
  return v_total;
end $$;
revoke execute on function public.purge_trash() from public, anon, authenticated;

-- Sotuvchi: barcha markazlar ro'yxati (xodim va mijozlar soni bilan)
create or replace function public.owner_list_orgs()
returns table (id uuid, name text, plan public.plan_id, status text, trial_ends_at timestamptz, paid_until timestamptz,
               created_at timestamptz, staff_count bigint, customer_count bigint, contact text, city text, last_active_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
  select o.id, o.name, o.plan, o.status, o.trial_ends_at, o.paid_until, o.created_at,
         (select count(*) from public.profiles p where p.organization_id = o.id and p.status = 'active'),
         (select count(*) from public.customers c where c.organization_id = o.id and c.deleted_at is null),
         coalesce(o.settings ->> 'phone', ''), coalesce(o.settings ->> 'address', ''),
         coalesce((select max(p.last_login_at) from public.profiles p where p.organization_id = o.id), o.created_at)
  from public.organizations o order by o.created_at desc;
end $$;

create or replace function public.owner_update_org(p_id uuid, p_plan public.plan_id default null, p_status text default null,
                                                   p_trial_ends_at timestamptz default null, p_paid_until timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.organizations set
    plan = coalesce(p_plan, plan),
    status = coalesce(p_status, status),
    trial_ends_at = coalesce(p_trial_ends_at, trial_ends_at),
    paid_until = coalesce(p_paid_until, paid_until)
  where id = p_id;
end $$;

-- Funksiyalarni faqat tizimga kirganlar chaqiradi
revoke execute on all functions in schema public from anon;
grant execute on function public.create_organization(text, text, text), public.update_own_profile(text, text), public.touch_login(),
  public.password_changed(),
  public.update_staff(uuid, public.app_role, text, text, text), public.import_backup(jsonb), public.log_event(text, text, text),
  public.trash_move(text, text[]), public.trash_restore(text, text[]),
  public.owner_list_orgs(), public.owner_update_org(uuid, public.plan_id, text, timestamptz, timestamptz),
  public.current_org_id(), public.current_app_role(), public.has_permission(text), public.org_writable(), public.is_platform_admin()
  to authenticated;
grant select, insert, update, delete on public.courses, public.customers, public.transactions to authenticated;
grant select on public.organizations, public.profiles, public.audit_log, public.platform_admins to authenticated;
