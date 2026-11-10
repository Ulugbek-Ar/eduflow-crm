-- RLS va RPC tekshiruvi (lokal: stub_auth.sql + migratsiyalar + shu fayl). Xato bo'lsa — exception bilan to'xtaydi
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@a.uz'),
  ('00000000-0000-0000-0000-00000000000b', 'menejer@a.uz'),
  ('00000000-0000-0000-0000-00000000000c', 'kuzatuvchi@a.uz'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@b.uz'),
  ('00000000-0000-0000-0000-0000000000ff', 'owner@eduflow.uz');

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;

-- 1) Ro'yxatdan o'tish: ikki markaz
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Bilim Plus', 'Dilshod Karimov') as org_a \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.create_organization('Zukko', 'Aziz Rahimov') as org_b \gset
reset role;

-- Xodimlar (Edge Function service_role bilan qo'shadi — bu yerda superuser)
insert into public.profiles (id, organization_id, full_name, role) values
  ('00000000-0000-0000-0000-00000000000b', :'org_a', 'Malika Yusupova', 'manager'),
  ('00000000-0000-0000-0000-00000000000c', :'org_a', 'Nodira Karimova', 'viewer');
insert into public.platform_admins values ('00000000-0000-0000-0000-0000000000ff');

-- 2) A administratori: ma'lumot yozadi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.courses (organization_id, id, name, type, duration_months, monthly_price) values (public.current_org_id(), 'k1', 'Ingliz tili', 'course', 6, 650000);
insert into public.customers (organization_id, id, name, phone, course, status, source) values (public.current_org_id(), 'c1', 'Aziza Karimova', '+998901234567', 'Ingliz tili', 'new', 'instagram');
insert into public.transactions (organization_id, id, type, amount, method, category, customer_id, date) values (public.current_org_id(), 't1', 'income', 650000, 'card', 'course_fee', 'c1', now());
update public.customers set status = 'paid' where id = 'c1';
reset role;

-- 3) B administratori A ning ma'lumotini ko'rmaydi va yoza olmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  if (select count(*) from public.customers) <> 0 then raise exception 'FAIL: boshqa markaz mijozlari ko''rindi'; end if;
  if (select count(*) from public.organizations) <> 1 then raise exception 'FAIL: boshqa markaz ko''rindi'; end if;
  begin
    insert into public.customers (organization_id, id, name, phone, course, status, source)
    values ((select id from public.organizations where name = 'Bilim Plus'), 'x', 'Hack', '', '', 'new', 'website');
    raise exception 'FAIL: boshqa markazga yozildi';
  exception when insufficient_privilege then null; when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;

-- 4) Menejer: mijoz qo'shadi, kirim yozadi; xarajat yoza olmaydi, to'lovni tahrirlay olmaydi, jurnalni ko'rmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.customers (organization_id, id, name, phone, course, status, source) values (public.current_org_id(), 'c2', 'Bobur Aliyev', '', '', 'new', 'telegram');
insert into public.transactions (organization_id, id, type, amount, method, category, date) values (public.current_org_id(), 't2', 'income', 100000, 'cash', 'course_fee', now());
do $$ begin
  begin
    insert into public.transactions (organization_id, id, type, amount, method, category, date) values (public.current_org_id(), 't3', 'expense', 5000, 'cash', 'rent', now());
    raise exception 'FAIL: menejer xarajat yozdi';
  exception when insufficient_privilege then null; end;
  update public.transactions set amount = 1 where id = 't1';
  if (select amount from public.transactions where id = 't1') = 1 then raise exception 'FAIL: menejer to''lovni tahrirladi'; end if;
  if (select count(*) from public.audit_log) <> 0 then raise exception 'FAIL: menejer jurnalni ko''rdi'; end if;
  -- To'g'ridan-to'g'ri deleted_at yozib bo'lmaydi — faqat RPC
  begin
    update public.customers set deleted_at = now() where id = 'c2';
    raise exception 'FAIL: deleted_at to''g''ridan-to''g''ri o''zgardi';
  exception when insufficient_privilege then null; end;
  -- Savatchaga o'tkazish (customers.delete bor), lekin to'lovni o'chira olmaydi
  if public.trash_move('customers', array['c2']) <> 1 then raise exception 'FAIL: savatchaga o''tmadi'; end if;
  begin
    perform public.trash_move('transactions', array['t1']);
    raise exception 'FAIL: menejer to''lovni o''chirdi';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.customers where id = 'c2') then raise exception 'FAIL: o''chirilgan mijoz menejerga ko''rinmoqda'; end if;
end $$;
reset role;

-- 5) Kuzatuvchi: ko'radi, hech narsa yoza olmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.customers) <> 1 then raise exception 'FAIL: kuzatuvchi mijozlarni ko''rmadi'; end if;
  begin
    insert into public.customers (organization_id, id, name, phone, course, status, source) values (public.current_org_id(), 'c3', 'X', '', '', 'new', 'website');
    raise exception 'FAIL: kuzatuvchi yozdi';
  exception when insufficient_privilege then null; end;
  update public.customers set name = 'Y' where id = 'c1';
  if (select name from public.customers where id = 'c1') = 'Y' then raise exception 'FAIL: kuzatuvchi tahrirladi'; end if;
  begin
    perform public.update_staff('00000000-0000-0000-0000-00000000000b'::uuid, 'admin');
    raise exception 'FAIL: kuzatuvchi rol berdi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 6) Administrator: savatchani ko'radi, jurnalda server yozuvlari bor, oxirgi administrator himoyasi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if not exists (select 1 from public.customers where id = 'c2' and deleted_at is not null) then raise exception 'FAIL: admin savatchani ko''rmadi'; end if;
  if not exists (select 1 from public.audit_log where action = 'customer.status' and summary like 'Aziza Karimova: new → paid') then raise exception 'FAIL: bosqich jurnalda yo''q'; end if;
  if not exists (select 1 from public.audit_log where action = 'customer.delete' and user_name = 'Malika Yusupova') then raise exception 'FAIL: o''chirish jurnalda yo''q'; end if;
  if (select deleted_by from public.customers where id = 'c2') <> 'Malika Yusupova' then raise exception 'FAIL: kim o''chirgani yozilmadi'; end if;
  if public.trash_restore('customers', array['c2']) <> 1 then raise exception 'FAIL: tiklanmadi'; end if;
  if not exists (select 1 from public.audit_log where action = 'customer.restore') then raise exception 'FAIL: tiklash jurnalda yo''q'; end if;
  begin
    perform public.update_staff(auth.uid(), 'viewer');
    raise exception 'FAIL: o''z rolini o''zgartirdi';
  exception when insufficient_privilege then null; end;
  perform public.update_staff('00000000-0000-0000-0000-00000000000b'::uuid, null, 'blocked');
  -- Tarifni o'zi uzaytira olmaydi
  begin
    update public.organizations set paid_until = now() + interval '1 year';
    raise exception 'FAIL: markaz tarifini o''zi uzaytirdi';
  exception when insufficient_privilege then null; end;
  begin
    perform public.log_event('customer.delete', 'soxta');
    raise exception 'FAIL: soxta jurnal yozuvi';
  exception when invalid_parameter_value then null; end;
  perform public.log_event('data.export', 'Mijozlar — Excel');
end $$;
select public.import_backup('{"customers":[{"id":"c9","name":"Import Mijoz","phone":"","course":"","status":"new","source":"website","createdAt":"2026-01-01T00:00:00Z"}],"transactions":[],"courses":[],"settings":{"orgName":"Bilim Plus 2"}}'::jsonb) as imported \gset
reset role;

-- 7) Bloklangan menejer endi hech narsani ko'rmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.customers) <> 0 then raise exception 'FAIL: bloklangan xodim ma''lumot ko''rdi'; end if;
end $$;
reset role;

-- 7a) v11: guruhlar, o'qituvchilar, davomat. A markazida ikki o'qituvchi va kassir
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'oqituvchi1@a.uz'),
  ('00000000-0000-0000-0000-0000000000e2', 'oqituvchi2@a.uz'),
  ('00000000-0000-0000-0000-0000000000e3', 'kassir@a.uz');
insert into public.profiles (id, organization_id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000e1', :'org_a', 'Nodira Saidova', 'teacher'),
  ('00000000-0000-0000-0000-0000000000e2', :'org_a', 'Sherzod Aliyev', 'teacher'),
  ('00000000-0000-0000-0000-0000000000e3', :'org_a', 'Sardor Qodirov', 'cashier');

-- Administrator: o'qituvchilar (kirish bilan bog'langan), ikki guruh, o'quvchilar guruhga yoziladi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.teachers (organization_id, id, name, subjects, pay_rule, user_id) values
  (public.current_org_id(), 'p1', 'Nodira Saidova', '{Ingliz tili}', '{"type": "percent", "percent": 40}', '00000000-0000-0000-0000-0000000000e1'),
  (public.current_org_id(), 'p2', 'Sherzod Aliyev', '{Python}', '{"type": "fixed", "amount": 6000000}', '00000000-0000-0000-0000-0000000000e2');
insert into public.groups (organization_id, id, name, course_id, teacher_id, room, days, start_time, end_time, capacity, start_date) values
  (public.current_org_id(), 'g1', 'IELTS — kechki', 'k1', 'p1', '101', '{mon,wed,fri}', '18:00', '19:30', 15, current_date - 60),
  (public.current_org_id(), 'g2', 'Python — 1-guruh', 'k1', 'p2', '102', '{tue,thu}', '16:00', '17:30', 12, current_date - 60);
insert into public.enrollments (organization_id, id, customer_id, group_id, start_date) values
  (public.current_org_id(), 'e1', 'c1', 'g1', current_date - 30),
  (public.current_org_id(), 'e2', 'c2', 'g2', current_date - 30);
do $$ begin
  if not exists (select 1 from public.audit_log where action = 'enrollment.create' and summary = 'Aziza Karimova — IELTS — kechki') then
    raise exception 'FAIL: guruhga yozilish jurnalda yo''q';
  end if;
  -- Guruh bilan bog'liq soft delete ham faqat RPC orqali
  begin
    update public.groups set deleted_at = now() where id = 'g2';
    raise exception 'FAIL: guruh deleted_at to''g''ridan-to''g''ri o''zgardi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- O'qituvchi A: faqat o'z guruhi, o'quvchilari (telefonsiz roster), davomatni bugun va oxirgi N kunga
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  if (select count(*) from public.groups) <> 1 or not exists (select 1 from public.groups where id = 'g1') then
    raise exception 'FAIL: o''qituvchi A boshqa o''qituvchining guruhini ko''rdi';
  end if;
  if (select count(*) from public.enrollments) <> 1 then raise exception 'FAIL: o''qituvchi boshqa guruh o''quvchilarini ko''rdi'; end if;
  if (select count(*) from public.customers) <> 0 then raise exception 'FAIL: o''qituvchi mijozlar jadvalini ko''rdi'; end if;
  if (select count(*) from public.transactions) <> 0 then raise exception 'FAIL: o''qituvchi to''lovlarni ko''rdi'; end if;
  if (select count(*) from public.teacher_roster()) <> 1 or (select phone from public.teacher_roster() limit 1) <> '' then
    raise exception 'FAIL: roster noto''g''ri (telefon yashirilmagan yoki boshqa o''quvchi)';
  end if;
  if (select count(*) from public.teachers) <> 1 then raise exception 'FAIL: o''qituvchi boshqa o''qituvchining maosh qoidasini ko''rdi'; end if;
  insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd1', 'g1', 'c1', current_date, 'present');
  begin
    insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd2', 'g2', 'c2', current_date, 'present');
    raise exception 'FAIL: o''qituvchi A boshqa guruhga davomat yozdi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd3', 'g1', 'c1', current_date - 10, 'absent');
    raise exception 'FAIL: o''qituvchi 10 kun oldingi davomatni yozdi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd4', 'g1', 'c1', current_date + 1, 'present');
    raise exception 'FAIL: kelajak sanasiga davomat yozildi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.groups (organization_id, id, name, course_id, days, start_time, end_time, capacity, start_date)
    values (public.current_org_id(), 'g9', 'Soxta', 'k1', '{mon}', '10:00', '11:00', 5, current_date);
    raise exception 'FAIL: o''qituvchi guruh ochdi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- O'qituvchi B: A ning guruhi va davomatini ko'rmaydi
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  if exists (select 1 from public.groups where id = 'g1') then raise exception 'FAIL: o''qituvchi B o''qituvchi A guruhini ko''rdi'; end if;
  if (select count(*) from public.attendance) <> 0 then raise exception 'FAIL: o''qituvchi B boshqa guruh davomatini ko''rdi'; end if;
  if (select count(*) from public.lesson_exceptions) <> 0 then raise exception 'FAIL: boshqa guruh darslari ko''rindi'; end if;
end $$;
reset role;

-- Kassir: guruh va davomatni ko'radi, lekin davomat yoza olmaydi; maoshni ko'radi
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
do $$ begin
  if (select count(*) from public.groups) <> 2 then raise exception 'FAIL: kassir guruhlarni ko''rmadi'; end if;
  if (select count(*) from public.teachers) <> 2 then raise exception 'FAIL: kassir (payroll.view) o''qituvchilarni ko''rmadi'; end if;
  begin
    insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd5', 'g1', 'c1', current_date, 'absent');
    raise exception 'FAIL: kassir davomat yozdi';
  exception when insufficient_privilege then null; end;
  update public.attendance set status = 'absent' where id = 'd1';
  if (select status from public.attendance where id = 'd1') <> 'present' then raise exception 'FAIL: kassir davomatni o''zgartirdi'; end if;
end $$;
reset role;

-- Administrator: istalgan kunga davomat, dars bekor qilish, jurnal, savatcha
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd6', 'g1', 'c1', current_date - 20, 'late');
insert into public.lesson_exceptions (organization_id, id, group_id, date, reason) values (public.current_org_id(), 'x1', 'g1', current_date - 14, 'Bayram');
do $$ begin
  if not exists (select 1 from public.audit_log where action = 'attendance.mark' and summary like 'IELTS — kechki · % 1 ta') then raise exception 'FAIL: davomat jurnalda yo''q'; end if;
  if not exists (select 1 from public.audit_log where action = 'lesson.cancel') then raise exception 'FAIL: bekor qilingan dars jurnalda yo''q'; end if;
  if public.trash_move('enrollments', array['e2']) <> 1 then raise exception 'FAIL: o''qish savatchaga o''tmadi'; end if;
  if public.trash_restore('enrollments', array['e2']) <> 1 then raise exception 'FAIL: o''qish tiklanmadi'; end if;
  if (select count(*) from public.teacher_directory()) <> 2 then raise exception 'FAIL: teacher_directory'; end if;
end $$;
reset role;

-- B markazi: A ning guruh, o'qituvchi, o'qish va davomatini ko'rmaydi va yoza olmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  if (select count(*) from public.groups) + (select count(*) from public.teachers) + (select count(*) from public.enrollments)
     + (select count(*) from public.attendance) + (select count(*) from public.lesson_exceptions) <> 0 then
    raise exception 'FAIL: boshqa markazning guruh/davomat ma''lumoti ko''rindi';
  end if;
  begin
    insert into public.groups (organization_id, id, name, course_id, days, start_time, end_time, capacity, start_date)
    values ((select id from public.organizations where name like 'Bilim Plus%'), 'gx', 'Hack', 'k1', '{mon}', '10:00', '11:00', 5, current_date);
    raise exception 'FAIL: boshqa markazga guruh yozildi';
  exception when insufficient_privilege then null; when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;

-- 7b) Tarif chegarasi serverda (trigger): sinov tarifi — 3 ta faol xodim, o'qituvchilar hisoblanmaydi
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'ortiqcha@a.uz'),
  ('00000000-0000-0000-0000-0000000000f2', 'oqituvchi3@a.uz');
do $$
declare v_org uuid := (select organization_id from public.profiles where id = '00000000-0000-0000-0000-00000000000a');
begin
  if (select count(*) from public.profiles where organization_id = v_org and status = 'active' and role <> 'teacher') <> 3 then
    raise exception 'FAIL: test holati — A markazida 3 ta faol xodim kutilgan';
  end if;
  -- Edge Function (service_role) ham chegaradan o'ta olmaydi
  begin
    insert into public.profiles (id, organization_id, full_name, role) values ('00000000-0000-0000-0000-0000000000f1', v_org, 'Ortiqcha Xodim', 'manager');
    raise exception 'FAIL: chegaradan ortiq xodim qo''shildi';
  exception when check_violation then null;
  end;
  -- O'qituvchi kirishi chegarasiz
  insert into public.profiles (id, organization_id, full_name, role) values ('00000000-0000-0000-0000-0000000000f2', v_org, 'Yana O''qituvchi', 'teacher');
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  -- O'qituvchi kirishini menejerga aylantirib chegarani aylanib o'tib bo'lmaydi
  begin
    perform public.update_staff('00000000-0000-0000-0000-0000000000f2'::uuid, 'manager');
    raise exception 'FAIL: o''qituvchi kirishi orqali chegara aylanib o''tildi';
  exception when check_violation then null;
  end;
  -- Bloklangan xodimni qayta yoqish ham chegara ichida
  begin
    perform public.update_staff('00000000-0000-0000-0000-00000000000b'::uuid, null, 'active');
    raise exception 'FAIL: bloklangan xodim chegaradan ortiq faollashdi';
  exception when check_violation then null;
  end;
  -- Bitta xodimni bloklasa — o'rniga boshqasini yoqish mumkin
  perform public.update_staff('00000000-0000-0000-0000-00000000000c'::uuid, null, 'blocked');
  perform public.update_staff('00000000-0000-0000-0000-00000000000b'::uuid, null, 'active');
  begin
    perform public.update_staff('00000000-0000-0000-0000-00000000000b'::uuid, null, 'deleted');
    raise exception 'FAIL: noto''g''ri holat qabul qilindi';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- 8) Sotuvchi: markazlar ro'yxati, muddati tugasa markaz faqat o'qiydi
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ff');
do $$ begin
  if (select count(*) from public.owner_list_orgs()) <> 2 then raise exception 'FAIL: sotuvchi markazlarni ko''rmadi'; end if;
  perform public.owner_update_org((select id from public.owner_list_orgs() where name = 'Bilim Plus 2'), null, null, now() - interval '1 day');
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if public.org_writable() then raise exception 'FAIL: muddati o''tgan markaz yoza oladi'; end if;
  if (select count(*) from public.customers where deleted_at is null) <> 3 then raise exception 'FAIL: muddati o''tganda o''qish yopildi'; end if;
  begin
    insert into public.customers (organization_id, id, name, phone, course, status, source) values (public.current_org_id(), 'c4', 'Z', '', '', 'new', 'website');
    raise exception 'FAIL: muddati o''tgan markaz yozdi';
  exception when insufficient_privilege then null; end;
  begin
    perform public.owner_list_orgs();
    raise exception 'FAIL: oddiy administrator sotuvchi ro''yxatini ko''rdi';
  exception when insufficient_privilege then null; end;
  -- Muddati o'tganda xodimlar va sozlamalar ham o'zgarmaydi
  begin
    perform public.update_staff('00000000-0000-0000-0000-00000000000b'::uuid, 'viewer');
    raise exception 'FAIL: muddati o''tgan markaz xodimni o''zgartirdi';
  exception when insufficient_privilege then null; end;
  update public.organizations set settings = '{"hacked": true}'::jsonb where id = public.current_org_id();
  if (select settings ? 'hacked' from public.organizations where id = public.current_org_id()) then
    raise exception 'FAIL: muddati o''tgan markaz sozlamani o''zgartirdi';
  end if;
end $$;
reset role;
select 'RLS_OK' as result, :'imported' as imported;
