-- Xavfsizlik (QA audit 2026-11-18, B-01 … B-03):
-- B-01) Funksiyalarni bajarish huquqi. PostgreSQL'da har bir yangi funksiya standart holda PUBLIC (hamma, jumladan anon)
--       uchun ochiq; init'dagi "revoke ... from anon" buni yopmasdi — PUBLIC huquqi qolardi. Natijada write_audit(p_org, ...)
--       ni istalgan kishi (hatto kirmagan) chaqirib, boshqa markaz jurnaliga soxta yozuv qo'sha olardi.
--       Endi: anon va PUBLIC hech qaysi funksiyani chaqira olmaydi; authenticated va service_role avvalgidek (PUBLIC orqali
--       ochiq bo'lganlari aniq beriladi); ichki funksiyalar (write_audit, trigger funksiyalari) to'g'ridan-to'g'ri yopiq —
--       ular faqat SECURITY DEFINER funksiyalar va triggerlar ichida ishlaydi.
-- B-02) Onlayn to'lov (Payme/Click) yozuvining summasi, turi, sanasi, mijozi va provayderini API orqali o'zgartirib bo'lmaydi
--       (UI'da summa faqat o'qish uchun edi, server himoyasi yo'q edi). Holat (masalan, bekor qilish) o'zgartiriladi.
-- B-03) Filialga cheklangan xodim mijozni boshqa filialga o'tkaza olmaydi (trigger).

-- ===== B-01 =====
do $$
declare
  f record;
  public_can boolean;
begin
  for f in
    select p.oid, p.oid::regprocedure as sig, p.proacl, p.prorettype
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- Kengaytmalar (pgcrypto va h.k.) funksiyalariga tegilmaydi
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    public_can := f.proacl is null
      or exists (select 1 from aclexplode(f.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE');
    -- Avval PUBLIC orqali ochiq bo'lgan bo'lsa — ilova (authenticated) va server (service_role) uchun aniq saqlanadi
    if public_can then
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
    end if;
    execute format('revoke execute on function %s from public, anon', f.sig);
    -- Trigger funksiyalari faqat trigger orqali ishlaydi
    if f.prorettype = 'trigger'::regtype then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop;
end $$;

-- Jurnalga yozish faqat ichki (SECURITY DEFINER funksiyalar, triggerlar). Ilova hodisalari — log_event (o'z markazi)
revoke execute on function public.write_audit(uuid, text, text, text) from public, anon, authenticated;

-- Keyin yaratiladigan funksiyalar ham avtomatik PUBLIC'ga ochilmasin
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- ===== B-02 =====
-- SECURITY INVOKER (definer emas): current_user — haqiqiy chaqiruvchi. Server (Edge Function — service_role) va ichki
-- funksiyalar (pay_tx_* — SECURITY DEFINER, egasi nomidan) o'zgartira oladi; ilova foydalanuvchisi (authenticated) — yo'q
create or replace function public.guard_provider_payment() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.provider is not null and (
       new.amount is distinct from old.amount
    or new.type is distinct from old.type
    or new.provider is distinct from old.provider
    or new.provider_ref is distinct from old.provider_ref
    or new.customer_id is distinct from old.customer_id
    or new.date is distinct from old.date
  ) then
    raise exception 'Onlayn to''lov (%) summasi, sanasi va mijozini o''zgartirib bo''lmaydi', old.provider using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.guard_provider_payment() from public, anon, authenticated;

drop trigger if exists transactions_provider_guard on public.transactions;
create trigger transactions_provider_guard before update on public.transactions
  for each row execute function public.guard_provider_payment();

-- ===== B-03 =====
-- Trigger (policy emas): boshqa filialda ro'yxatdan o'tgan, lekin shu filial guruhida o'qiyotgan o'quvchini tahrirlash
-- avvalgidek mumkin — faqat filialni o'z filialidan tashqariga (yoki "filialsiz"ga) o'zgartirish rad etiladi
create or replace function public.guard_customer_branch() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and public.current_branch_id() is not null
     and new.branch_id is distinct from old.branch_id and not coalesce(public.branch_allowed(new.branch_id), false) then
    raise exception 'Mijozni boshqa filialga o''tkazish faqat butun markaz administratoriga ruxsat' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.guard_customer_branch() from public, anon, authenticated;

drop trigger if exists customers_branch_guard on public.customers;
create trigger customers_branch_guard before update of branch_id on public.customers
  for each row execute function public.guard_customer_branch();
