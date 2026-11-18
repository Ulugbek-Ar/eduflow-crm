-- EduFlow v1.2: ota-onalar uchun Telegram bot. Har markaz o'z botini ulaydi (token integration_secrets'da).
-- Ota-ona bot orqali o'quvchiga bog'lanadi (havola kodi yoki o'z telefon raqamini yuborib), so'ng dars qoldirilsa va
-- to'lov qabul qilinsa xabar oladi; botdan qarz, davomat va jadvalni so'raydi. Webhook va yuborish — Edge Function'larda.

-- ===== Ota-ona (Telegram chat) <-> o'quvchi =====
create table public.telegram_links (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id text not null,
  chat_id bigint not null,
  lang text not null default 'uz' check (lang in ('uz', 'ru')),
  linked_at timestamptz not null default now(),
  primary key (organization_id, customer_id, chat_id)
);
create index telegram_links_chat_idx on public.telegram_links (organization_id, chat_id);
alter table public.telegram_links enable row level security;
-- Xodimlar faqat "bog'langanmi"ni ko'radi (mijoz kartasida); qo'shish va uzish — server orqali
create policy telegram_links_select on public.telegram_links for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view'));
revoke insert, update, delete on public.telegram_links from public, anon, authenticated;
grant select on public.telegram_links to authenticated;

-- ===== Xabarlar navbati (cron har 5 daqiqada yuboradi) =====
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id text not null,
  kind text not null check (kind in ('absence', 'payment')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts smallint not null default 0,
  error text
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where sent_at is null;
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;

-- Navbatga faqat bot ulangan va o'quvchiga ota-ona bog'langan bo'lsa yoziladi
create or replace function public.outbox_wanted(p_org uuid, p_customer text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.integration_secrets s where s.organization_id = p_org and s.provider = 'telegram')
     and exists (select 1 from public.telegram_links l where l.organization_id = p_org and l.customer_id = p_customer)
$$;
revoke execute on function public.outbox_wanted(uuid, text) from public, anon, authenticated;

-- Dars qoldirildi ("Kelmadi" belgilandi)
create or replace function public.outbox_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'absent' and (tg_op = 'INSERT' or old.status is distinct from 'absent')
     and public.outbox_wanted(new.organization_id, new.customer_id) then
    insert into public.notification_outbox (organization_id, customer_id, kind, payload)
    values (new.organization_id, new.customer_id, 'absence', jsonb_build_object('group_id', new.group_id, 'date', new.date));
  end if;
  return new;
end $$;
create trigger attendance_outbox after insert or update of status on public.attendance
  for each row execute function public.outbox_attendance();

-- To'lov qabul qilindi (kirim "To'langan" bo'ldi — kassada, Payme yoki Click orqali)
create or replace function public.outbox_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'income' and new.status = 'paid' and new.customer_id is not null and new.deleted_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'paid')
     and public.outbox_wanted(new.organization_id, new.customer_id) then
    insert into public.notification_outbox (organization_id, customer_id, kind, payload)
    values (new.organization_id, new.customer_id, 'payment',
            jsonb_build_object('amount', new.amount, 'date', new.date, 'provider', new.provider, 'transaction_id', new.id));
  end if;
  return new;
end $$;
create trigger transactions_outbox after insert or update of status on public.transactions
  for each row execute function public.outbox_payment();
