-- B-02 (QA 2026-11): Payme/Click orqali kelgan kirim — xodim (API) summa, sana, tur, provayder va test belgisini o'zgartira olmaydi.
-- Bog'lanmagan to'lovga (customer_id null) o'quvchi biriktirish, guruh, oy, izoh va kategoriya — mumkin.
-- Edge Function'lar (service_role) va SECURITY DEFINER funksiyalar (pay_tx_cancel) cheklanmaydi
create or replace function public.guard_provider_tx() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.provider is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.amount is distinct from old.amount or new.type is distinct from old.type or new.date is distinct from old.date
     or new.provider is distinct from old.provider or new.provider_ref is distinct from old.provider_ref
     or new.is_test is distinct from old.is_test or new.method is distinct from old.method
     or (old.customer_id is not null and new.customer_id is distinct from old.customer_id) then
    raise exception 'online payment fields are immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger transactions_provider_guard before update on public.transactions
  for each row execute function public.guard_provider_tx();

revoke execute on function public.guard_provider_tx() from public, anon, authenticated;
