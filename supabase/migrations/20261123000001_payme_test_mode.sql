-- N-2 (QA 2026-11): Payme test kaliti (sandbox) bilan kelgan tranzaksiya is_test — kassa, qarz va hisobotlarga kirmaydi
alter table public.payment_transactions add column if not exists is_test boolean not null default false;
alter table public.transactions add column if not exists is_test boolean not null default false;

drop function if exists public.pay_tx_create(uuid, text, text, text, bigint, bigint, jsonb);
create function public.pay_tx_create(p_org uuid, p_provider text, p_provider_id text, p_customer text, p_amount bigint,
                                     p_create_time bigint, p_account jsonb default '{}'::jsonb, p_is_test boolean default false)
returns setof public.payment_transactions
language plpgsql security definer set search_path = public as $$
begin
  insert into public.payment_transactions (organization_id, provider, provider_id, id, customer_id, amount, state, create_time, account, is_test)
  values (p_org, p_provider, p_provider_id, 'pt' || replace(gen_random_uuid()::text, '-', ''), p_customer, p_amount, 1, p_create_time,
          coalesce(p_account, '{}'::jsonb), coalesce(p_is_test, false))
  on conflict (organization_id, provider, provider_id) do nothing;
  return query select * from public.payment_transactions where organization_id = p_org and provider = p_provider and provider_id = p_provider_id;
end $$;

-- Bajarilgan test tranzaksiyasining kirimlari ham is_test
create or replace function public.payment_mark_test() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_test and new.state = 2 then
    update public.transactions set is_test = true
    where organization_id = new.organization_id and (id = new.transaction_id or id = any(new.transaction_ids));
  end if;
  return new;
end $$;
create trigger payment_transactions_test after update of state on public.payment_transactions
  for each row execute function public.payment_mark_test();

revoke execute on function public.pay_tx_create(uuid, text, text, text, bigint, bigint, jsonb, boolean), public.payment_mark_test()
  from public, anon, authenticated;
grant execute on function public.pay_tx_create(uuid, text, text, text, bigint, bigint, jsonb, boolean) to service_role;
