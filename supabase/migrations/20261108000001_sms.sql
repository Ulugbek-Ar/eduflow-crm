-- EduFlow v1.2: SMS (Eskiz) — eslatmalar jurnali. Yuborish Edge Function'larda (integrations: qo'lda, cron: avtomatik);
-- kalit (Eskiz login va paroli) integration_secrets'da. Jurnalni ilova faqat o'qiydi, yozuvni faqat service_role qo'shadi.

create table public.sms_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id text,
  phone text not null check (char_length(phone) between 9 and 15),
  text text not null check (char_length(text) between 1 and 1000),
  -- reminder — eslatma oynasidan; auto — kunlik avtomatik; test — sinov
  kind text not null check (kind in ('reminder', 'auto', 'test')),
  status text not null check (status in ('sent', 'failed')),
  -- Eskiz xabar id'si yoki xato matni
  provider_id text,
  error text check (error is null or char_length(error) <= 300),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index sms_log_org_idx on public.sms_log (organization_id, created_at desc);
create index sms_log_customer_idx on public.sms_log (organization_id, customer_id, created_at desc) where customer_id is not null;

alter table public.sms_log enable row level security;
create policy sms_log_select on public.sms_log for select
  using (organization_id = public.current_org_id() and public.has_permission('payments.view'));
revoke insert, update, delete on public.sms_log from public, anon, authenticated;
grant select on public.sms_log to authenticated;
