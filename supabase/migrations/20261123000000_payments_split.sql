-- N-1 (QA 2026-11): onlayn to'lov to'g'ri o'quvchi va guruhga.
--  * Hisob: o'quvchi id'si (havolada ac.student / Click transaction_param), bo'lmasa telefon.
--  * Bitta telefonda bir nechta o'quvchi va qarzli yagona o'quvchi yo'q — to'lov bog'lanmagan (customer_id null) yoziladi,
--    jurnalga "payment.unassigned" tushadi (ilovada administratorga bildirishnoma).
--  * Bajarishda summa o'qishlar bo'yicha bo'linadi (Edge Function engine.allocatePayment hisoblaydi: eski o'qish qarzi birinchi);
--    bo'linma noto'g'ri bo'lsa — eskicha (yagona faol o'qish).
alter table public.payment_transactions alter column customer_id drop not null;
alter table public.payment_transactions add column if not exists transaction_ids text[] not null default '{}';

-- Nomzodlar: id aniq mos kelsa — faqat u; aks holda telefon (oxirgi 9 xona) bo'yicha barchasi
create or replace function public.pay_find_customers(p_org uuid, p_customer text, p_phone text)
returns table (id text, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(p_customer, '') <> '' then
    return query select c.id, c.name from public.customers c
      where c.organization_id = p_org and c.deleted_at is null and c.id = p_customer;
    if found then return; end if;
  end if;
  return query select c.id, c.name from public.customers c
    where c.organization_id = p_org and c.deleted_at is null
      and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
      and right(regexp_replace(c.phone, '\D', '', 'g'), 9) = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    order by c.created_at;
end $$;

drop function if exists public.pay_tx_perform(uuid, text, text, bigint, text);
create function public.pay_tx_perform(p_org uuid, p_provider text, p_provider_id text, p_time bigint, p_label text, p_split jsonb default null)
returns setof public.payment_transactions
language plpgsql security definer set search_path = public as $$
declare
  v public.payment_transactions;
  v_name text;
  v_enrollment text;
  v_tx text;
  v_ids text[] := '{}';
  v_total bigint;
  v_sum bigint;
  v_part jsonb;
  v_split jsonb := p_split;
  v_period text := to_char(now() at time zone 'Asia/Tashkent', 'YYYY-MM');
begin
  select * into v from public.payment_transactions
  where organization_id = p_org and provider = p_provider and provider_id = p_provider_id for update;
  if not found then return; end if;
  if v.state = 1 then
    v_total := greatest(1, round(v.amount / 100.0))::bigint;
    perform set_config('app.actor', p_label, true);
    if v.customer_id is null then
      v_tx := 't' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
      insert into public.transactions (organization_id, id, type, amount, method, category, note, status, date, updated_at, provider, provider_ref)
      values (p_org, v_tx, 'income', v_total, 'card', 'other_income',
              p_label || ' · ' || v.provider_id || ' · bog''lanmagan, tel: ' || coalesce(v.account ->> 'phone', '—'),
              'paid', now(), now(), p_provider, v.provider_id);
      v_ids := array[v_tx];
      perform public.write_audit(p_org, 'payment.unassigned',
        p_label || ': ' || v_total || ' — o''quvchi aniqlanmadi (tel: ' || coalesce(v.account ->> 'phone', '—') || ')', v_tx);
    else
      select c.name into v_name from public.customers c where c.organization_id = p_org and c.id = v.customer_id;
      if v_split is not null and jsonb_typeof(v_split) = 'array' and jsonb_array_length(v_split) > 0 then
        select coalesce(sum((x ->> 'amount')::bigint), 0) into v_sum from jsonb_array_elements(v_split) x;
        if v_sum <> v_total or exists (
          select 1 from jsonb_array_elements(v_split) x
          where coalesce((x ->> 'amount')::bigint, 0) <= 0
             or (x ->> 'enrollment' is not null and not exists (
                  select 1 from public.enrollments e
                  where e.organization_id = p_org and e.id = x ->> 'enrollment' and e.customer_id = v.customer_id and e.deleted_at is null))
        ) then
          v_split := null;
        end if;
      else
        v_split := null;
      end if;
      if v_split is null then
        select min(e.id) into v_enrollment from public.enrollments e
        where e.organization_id = p_org and e.customer_id = v.customer_id and e.deleted_at is null and e.status in ('active', 'paused')
        having count(*) = 1;
        v_split := jsonb_build_array(jsonb_build_object('enrollment', v_enrollment, 'amount', v_total));
      end if;
      for v_part in select * from jsonb_array_elements(v_split) loop
        v_tx := 't' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
        insert into public.transactions (organization_id, id, type, amount, method, category, note, customer_id, customer_name, status,
                                         date, updated_at, enrollment_id, period, provider, provider_ref)
        values (p_org, v_tx, 'income', (v_part ->> 'amount')::bigint, 'card', 'course_fee', p_label || ' · ' || v.provider_id,
                v.customer_id, v_name, 'paid', now(), now(), v_part ->> 'enrollment', v_period, p_provider,
                -- provider_ref noyob: birinchi qism — provayder id'si, keyingilari — "#2", "#3"
                case when cardinality(v_ids) = 0 then v.provider_id else v.provider_id || '#' || (cardinality(v_ids) + 1) end);
        v_ids := v_ids || v_tx;
      end loop;
    end if;
    update public.payment_transactions set state = 2, perform_time = p_time, transaction_id = v_ids[1], transaction_ids = v_ids
    where organization_id = p_org and provider = p_provider and provider_id = p_provider_id
    returning * into v;
  end if;
  return next v;
end $$;

-- Bekor qilish: bo'lingan to'lovning barcha kirimlari
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
    update public.transactions set status = 'cancelled', updated_at = now()
    where organization_id = p_org and (id = v.transaction_id or id = any(v.transaction_ids));
    update public.payment_transactions set state = -2, cancel_time = p_time, reason = p_reason
    where organization_id = p_org and provider = p_provider and provider_id = p_provider_id
    returning * into v;
  end if;
  return next v;
end $$;

revoke execute on function public.pay_find_customers(uuid, text, text), public.pay_tx_perform(uuid, text, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.pay_find_customers(uuid, text, text), public.pay_tx_perform(uuid, text, text, bigint, text, jsonb)
  to service_role;
