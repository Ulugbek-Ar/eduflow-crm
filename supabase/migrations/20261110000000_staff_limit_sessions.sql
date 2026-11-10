-- Xavfsizlik tuzatishlari (v1.1.1):
-- 1) Tarifdagi xodimlar chegarasi serverda har qanday yo'l bilan tekshiriladi (trigger): yangi xodim, o'qituvchi
--    kirishini boshqa rolga o'tkazish, bloklangan xodimni qayta faollashtirish. Avval faqat Edge Function'dagi
--    "taklif qilish" tekshirilardi — o'qituvchi kirishini menejerga aylantirib chegarani aylanib o'tish mumkin edi
-- 2) Muddati tugagan yoki to'xtatilgan markaz xodimlar va sozlamalarni o'zgartira olmaydi (faqat o'qish)
-- 3) Xodim bloklanganda yoki paroli tiklanganda uning seanslari bekor qilinadi (yangi token olib bo'lmaydi)

-- Tarif -> faol xodimlar chegarasi (o'qituvchi kirishlari hisoblanmaydi). null — cheksiz.
-- Ilovadagi src/constants/plans.ts va supabase/functions/staff bilan bir xil
create or replace function public.plan_staff_limit(p_plan text) returns integer
language sql immutable set search_path = public as $$
  select case p_plan when 'trial' then 3 when 'standard' then 5 when 'pro' then null else 3 end
$$;

create or replace function public.enforce_staff_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  -- Faqat "faol, o'qituvchi emas" holatiga o'tishda: yangi xodim, bloklangandan faollashtirish, o'qituvchidan boshqa rolga
  if new.status <> 'active' or new.role = 'teacher' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.role <> 'teacher' then
    return new;
  end if;
  -- Bir vaqtdagi ikki so'rov chegarani birga oshirib yubormasin: markaz qatori qulflanadi
  select plan into v_plan from public.organizations where id = new.organization_id for update;
  v_limit := public.plan_staff_limit(v_plan);
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from public.profiles
  where organization_id = new.organization_id and status = 'active' and role <> 'teacher' and id <> new.id;
  if v_count >= v_limit then
    raise exception 'Tarifingizda % tagacha xodim. Boshqa xodimni bloklang yoki tarifni oshiring', v_limit
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists profiles_staff_limit on public.profiles;
create trigger profiles_staff_limit before insert or update of role, status on public.profiles
  for each row execute function public.enforce_staff_limit();

-- Foydalanuvchining barcha seanslarini bekor qilish: refresh token yaroqsiz bo'ladi, joriy access token
-- muddati (jwt_expiry, 1 soat) tugagach kirish so'raladi. Faqat server (service_role) va update_staff chaqiradi
create or replace function public.revoke_auth_sessions(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  begin
    execute 'delete from auth.sessions where user_id = $1' using p_user;
  exception when undefined_table or insufficient_privilege then
    -- Lokal PostgreSQL testlarida auth.sessions yo'q; Supabase'da huquq bo'lmasa — jim o'tkaziladi
    null;
  end;
end $$;
revoke execute on function public.revoke_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_auth_sessions(uuid) to service_role;
revoke execute on function public.plan_staff_limit(text), public.enforce_staff_limit() from public, anon;

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
  -- Muddati tugagan / to'xtatilgan markaz: faqat o'qish
  if not public.org_writable() then
    raise exception 'Tarif muddati tugagan yoki markaz to''xtatilgan' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('active', 'blocked') then
    raise exception 'invalid status' using errcode = '22023';
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
  -- Bloklangan xodim boshqa qurilmalarda ham chiqariladi
  if p_status = 'blocked' and v_target.status <> 'blocked' then
    perform public.revoke_auth_sessions(p_id);
  end if;
  perform public.write_audit(v_target.organization_id,
    case when p_status = 'blocked' then 'staff.block' when p_status = 'active' and v_target.status = 'blocked' then 'staff.unblock' else 'staff.update' end,
    coalesce(trim(p_full_name), v_target.full_name), p_id::text);
end $$;

-- Markaz sozlamalari: muddati tugaganda ham o'zgartirib bo'lmaydi
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update
  using (id = public.current_org_id() and public.has_permission('settings.manage') and public.org_writable())
  with check (id = public.current_org_id() and public.has_permission('settings.manage') and public.org_writable());
