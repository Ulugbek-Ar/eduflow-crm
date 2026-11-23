-- EduFlow v1.2: onlayn to'lov — Payme (Merchant API, JSON-RPC) va Click (SHOP API: prepare/complete).
-- Webhook'lar Edge Function'larda (supabase/functions/payme, click). Bu yerda: provayder tranzaksiyalari, maxfiy
-- kalitlar va to'lovni atomar yozish funksiyalari. Funksiyalarni faqat service_role chaqiradi.

-- ===== Kirim qaysi to'lov tizimidan kelgani =====
alter table public.transactions
  add column provider text check (provider is null or provider in ('payme', 'click')),
  add column provider_ref text;
create unique index transactions_provider_ref_idx on public.transactions (organization_id, provider, provider_ref) where provider is not null;
create index transactions_provider_updated_idx on public.transactions (organization_id, updated_at) where provider is not null;

-- ===== Maxfiy kalitlar (Payme kaliti, Click secret key, Eskiz paroli, Telegram bot tokeni) =====
-- RLS yoqilgan, siyosat yo'q: ilova (anon/authenticated) hech qachon o'qiy olmaydi; faqat Edge Function'lar (service_role)
create table public.integration_secrets (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('payme', 'click', 'eskiz', 'telegram')),
  secret jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from public, anon, authenticated;

-- ===== Provayder tranzaksiyalari (Payme holat mashinasi: 1 yaratildi, 2 bajarildi, -1 bekor, -2 bajarilgach bekor) =====
create table public.payment_transactions (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('payme', 'click')),
  -- Payme tranzaksiya id'si yoki Click click_trans_id
  provider_id text not null check (char_length(provider_id) between 1 and 64),
  -- Bizning id (Payme javobidagi "transaction") va raqamli id (Click merchant_prepare_id / merchant_confirm_id)
  id text not null unique,
  num bigint generated always as identity,
  customer_id text not null,
  -- Tiyinda (Payme shunday yuboradi; Click so'mini 100 ga ko'paytirib yozamiz)
  amount bigint not null check (amount > 0),
  state smallint not null check (state in (1, 2, -1, -2)),
  -- Unix ms (Payme protokoli shunday talab qiladi)
  create_time bigint not null,
  perform_time bigint,
  cancel_time bigint,
  reason smallint,
  account jsonb not null default '{}'::jsonb,
  -- Bajarilganda yozilgan kirim (public.transactions.id)
  transaction_id text,
  created_at timestamptz not null default now(),
  primary key (organization_id, provider, provider_id)
);
create index payment_transactions_time_idx on public.payment_transactions (organization_id, provider, create_time);
alter table public.payment_transactions enable row level security;
create policy payment_transactions_select on public.payment_transactions for select
  using (organization_id = public.current_org_id() and public.has_permission('payments.view'));
revoke insert, update, delete on public.payment_transactions from public, anon, authenticated;
grant select on public.payment_transactions to authenticated;

-- ===== Jurnal: foydalanuvchisiz (server) yozuvlarda kim ekani — app.actor ("Payme", "Click", "Telegram bot") =====
create or replace function public.write_audit(p_org uuid, p_action text, p_summary text, p_entity text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  insert into public.audit_log (organization_id, user_id, user_name, role, action, summary, entity_id)
  values (p_org, auth.uid(), coalesce(v_profile.full_name, nullif(current_setting('app.actor', true), ''), ''), v_profile.role,
          p_action, left(coalesce(p_summary, ''), 200), p_entity);
end $$;

-- ===== To'lov funksiyalari (Edge Function → service_role) =====

-- Hisob (telefon raqami, oxirgi 9 xona) bo'yicha mijoz; bir nechta bo'lsa — o'quvchi, keyin eng yangisi
create or replace function public.pay_find_customer(p_org uuid, p_phone text)
returns table (id text, name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name from public.customers c
  where c.organization_id = p_org and c.deleted_at is null
    and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
    and right(regexp_replace(c.phone, '\D', '', 'g'), 9) = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
  order by (c.status = 'paid') desc, c.created_at desc
  limit 1
$$;

create or replace function public.pay_tx_get(p_org uuid, p_provider text, p_provider_id text)
returns setof public.payment_transactions
language sql stable security definer set search_path = public as $$
  select * from public.payment_transactions where organization_id = p_org and provider = p_provider and provider_id = p_provider_id
$$;

-- Takror chaqiruv (tarmoq qayta urinishi) yangi yozuv yaratmaydi — mavjudi qaytadi
create or replace function public.pay_tx_create(p_org uuid, p_provider text, p_provider_id text, p_customer text, p_amount bigint,
                                                 p_create_time bigint, p_account jsonb default '{}'::jsonb)
returns setof public.payment_transactions
language plpgsql security definer set search_path = public as $$
begin
  insert into public.payment_transactions (organization_id, provider, provider_id, id, customer_id, amount, state, create_time, account)
  values (p_org, p_provider, p_provider_id, 'pt' || replace(gen_random_uuid()::text, '-', ''), p_customer, p_amount, 1, p_create_time,
          coalesce(p_account, '{}'::jsonb))
  on conflict (organization_id, provider, provider_id) do nothing;
  return query select * from public.payment_transactions where organization_id = p_org and provider = p_provider and provider_id = p_provider_id;
end $$;

-- Bajarish: kirim (To'langan, karta) yoziladi; o'quvchining bitta faol o'qishi bo'lsa — shu guruhga bog'lanadi.
-- Takror chaqiruv ikkinchi kirim yozmaydi (holat 2 bo'lsa o'zgarishsiz qaytadi)
create or replace function public.pay_tx_perform(p_org uuid, p_provider text, p_provider_id text, p_time bigint, p_label text)
returns setof public.payment_transactions
language plpgsql security definer set search_path = public as $$
declare
  v public.payment_transactions;
  v_name text;
  v_enrollment text;
  v_tx text;
begin
  select * into v from public.payment_transactions
  where organization_id = p_org and provider = p_provider and provider_id = p_provider_id for update;
  if not found then return; end if;
  if v.state = 1 then
    select c.name into v_name from public.customers c where c.organization_id = p_org and c.id = v.customer_id;
    select min(e.id) into v_enrollment from public.enrollments e
    where e.organization_id = p_org and e.customer_id = v.customer_id and e.deleted_at is null and e.status in ('active', 'paused')
    having count(*) = 1;
    v_tx := 't' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    perform set_config('app.actor', p_label, true);
    insert into public.transactions (organization_id, id, type, amount, method, category, note, customer_id, customer_name, status,
                                     date, updated_at, enrollment_id, period, provider, provider_ref)
    values (p_org, v_tx, 'income', greatest(1, round(v.amount / 100.0))::bigint, 'card', 'course_fee', p_label || ' · ' || v.provider_id,
            v.customer_id, v_name, 'paid', now(), now(), v_enrollment, to_char(now() at time zone 'Asia/Tashkent', 'YYYY-MM'),
            p_provider, v.provider_id);
    update public.payment_transactions set state = 2, perform_time = p_time, transaction_id = v_tx
    where organization_id = p_org and provider = p_provider and provider_id = p_provider_id
    returning * into v;
  end if;
  return next v;
end $$;

-- Bekor qilish: bajarilmagan — -1; bajarilgan — -2 va yozilgan kirim "Bekor qilingan" bo'ladi
create or replace function public.pay_tx_cancel(p_org uuid, p_provider text, p_provider_id text, p_time bigint, p_reason smallint, p_label text)
returns setof public.payment_transactions
language plpgsql security definer set search_path = public as $$
declare
  v public.payment_transactions;
begin
  select * into v from public.payment_transactions
  where organization_id = p_org and provider = p_provider and provider_id = p_provider_id for update;
  if not found then return; end if;
  if v.state = 1 then
    update public.payment_transactions set state = -1, cancel_time = p_time, reason = p_reason
    where organization_id = p_org and provider = p_provider and provider_id = p_provider_id
    returning * into v;
  elsif v.state = 2 then
    perform set_config('app.actor', p_label, true);
    update public.transactions set status = 'cancelled', updated_at = now() where organization_id = p_org and id = v.transaction_id;
    update public.payment_transactions set state = -2, cancel_time = p_time, reason = p_reason
    where organization_id = p_org and provider = p_provider and provider_id = p_provider_id
    returning * into v;
  end if;
  return next v;
end $$;

-- Davr bo'yicha ro'yxat (Payme GetStatement)
create or replace function public.pay_tx_statement(p_org uuid, p_provider text, p_from bigint, p_to bigint)
returns setof public.payment_transactions
language sql stable security definer set search_path = public as $$
  select * from public.payment_transactions
  where organization_id = p_org and provider = p_provider and create_time between p_from and p_to
  order by create_time
$$;

revoke execute on function public.pay_find_customer(uuid, text), public.pay_tx_get(uuid, text, text),
  public.pay_tx_create(uuid, text, text, text, bigint, bigint, jsonb), public.pay_tx_perform(uuid, text, text, bigint, text),
  public.pay_tx_cancel(uuid, text, text, bigint, smallint, text), public.pay_tx_statement(uuid, text, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.pay_find_customer(uuid, text), public.pay_tx_get(uuid, text, text),
  public.pay_tx_create(uuid, text, text, text, bigint, bigint, jsonb), public.pay_tx_perform(uuid, text, text, bigint, text),
  public.pay_tx_cancel(uuid, text, text, bigint, smallint, text), public.pay_tx_statement(uuid, text, bigint, bigint)
  to service_role;
