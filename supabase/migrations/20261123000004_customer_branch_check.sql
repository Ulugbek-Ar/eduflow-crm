-- B-03 (QA 2026-11): filialga cheklangan xodim mijozni boshqa filialga o'tkaza olmaydi. Faqat branch_id o'zgarganda tekshiriladi:
-- boshqa filialda ro'yxatdan o'tgan, lekin xodim filiali guruhida o'qiydigan o'quvchini oddiy tahrirlash avvalgidek mumkin
create or replace function public.guard_customer_branch() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.branch_id is distinct from old.branch_id and current_user in ('authenticated', 'anon')
     and public.current_branch_id() is not null and not public.branch_allowed(new.branch_id) then
    raise exception 'branch change not allowed' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger customers_branch_guard before update on public.customers
  for each row execute function public.guard_customer_branch();

revoke execute on function public.guard_customer_branch() from public, anon, authenticated;
