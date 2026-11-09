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

-- 7b) v1.2: onlayn to'lov (Payme/Click). Funksiyalarni Edge Function service_role bilan chaqiradi — bu yerda superuser
select set_config('test.org_a', :'org_a', false);
-- service_role so'rovida JWT foydalanuvchisi yo'q (oldingi bo'limdan qolgan sub tozalanadi)
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
  v public.payment_transactions;
  n integer;
begin
  -- Hisob — telefon (998 bilan ham, bo'shliq va belgilar bilan ham); qisqa raqam — topilmaydi
  if (select id from public.pay_find_customer(v_org, '998901234567')) is distinct from 'c1' then raise exception 'FAIL: mijoz telefon bo''yicha topilmadi'; end if;
  if (select id from public.pay_find_customer(v_org, '+998 (90) 123-45-67')) is distinct from 'c1' then raise exception 'FAIL: formatlangan telefon'; end if;
  if exists (select 1 from public.pay_find_customer(v_org, '12345')) then raise exception 'FAIL: qisqa raqam bilan mijoz topildi'; end if;
  -- Yaratish takror chaqirilsa ham bitta yozuv
  perform public.pay_tx_create(v_org, 'payme', 'pm-1', 'c1', 65000000, 1700000000000, '{"phone":"901234567"}');
  perform public.pay_tx_create(v_org, 'payme', 'pm-1', 'c1', 65000000, 1700000000000, '{"phone":"901234567"}');
  if (select count(*) from public.payment_transactions where organization_id = v_org) <> 1 then raise exception 'FAIL: takror yaratildi'; end if;
  -- Bajarish: bitta kirim (so'mda), yagona faol o'qishga bog'langan; takror — ikkinchi kirim yo'q
  select * into v from public.pay_tx_perform(v_org, 'payme', 'pm-1', 1700000001000, 'Payme');
  if v.state <> 2 or v.transaction_id is null or v.perform_time <> 1700000001000 then raise exception 'FAIL: bajarilmadi'; end if;
  perform public.pay_tx_perform(v_org, 'payme', 'pm-1', 1700000002000, 'Payme');
  select count(*) into n from public.transactions
  where organization_id = v_org and provider = 'payme' and provider_ref = 'pm-1' and amount = 650000 and status = 'paid' and method = 'card'
    and enrollment_id = 'e1' and customer_name = 'Aziza Karimova' and updated_at is not null;
  if n <> 1 then raise exception 'FAIL: Payme kirimi % ta', n; end if;
  if not exists (select 1 from public.audit_log where organization_id = v_org and action = 'payment.create' and user_name = 'Payme') then
    raise exception 'FAIL: jurnalda "Payme" yo''q';
  end if;
  -- Bajarilgandan keyin bekor: -2, kirim "Bekor qilingan"
  select * into v from public.pay_tx_cancel(v_org, 'payme', 'pm-1', 1700000003000, 5::smallint, 'Payme');
  if v.state <> -2 or v.reason <> 5 then raise exception 'FAIL: bajarilgandan keyin bekor holati %', v.state; end if;
  if (select status from public.transactions where organization_id = v_org and provider_ref = 'pm-1') <> 'cancelled' then raise exception 'FAIL: kirim bekor bo''lmadi'; end if;
  -- Click: tayyorlangan, so'ng bekor — kirim yozilmaydi; topilmagan id — bo'sh
  perform public.pay_tx_create(v_org, 'click', '9001', 'c1', 10000000, 1700000004000, '{}');
  select * into v from public.pay_tx_cancel(v_org, 'click', '9001', 1700000005000, null, 'Click');
  if v.state <> -1 or exists (select 1 from public.transactions where provider = 'click') then raise exception 'FAIL: Click bekor qilinmadi'; end if;
  if exists (select 1 from public.pay_tx_perform(v_org, 'click', 'yoq', 1, 'Click')) then raise exception 'FAIL: yo''q tranzaksiya bajarildi'; end if;
  if (select count(*) from public.pay_tx_statement(v_org, 'payme', 1700000000000, 1700000009000)) <> 1 then raise exception 'FAIL: statement'; end if;
  insert into public.integration_secrets (organization_id, provider, secret) values (v_org, 'payme', '{"key":"maxfiy"}');
end $$;
-- Administrator: provayder tranzaksiyalarini ko'radi; maxfiy kalitni o'qiy olmaydi, to'lov funksiyasini chaqira olmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.payment_transactions) <> 2 then raise exception 'FAIL: administrator provayder tranzaksiyalarini ko''rmadi'; end if;
  begin
    perform 1 from public.integration_secrets;
    raise exception 'FAIL: administrator maxfiy kalitni o''qidi';
  exception when insufficient_privilege then null; end;
  begin
    perform public.pay_tx_perform(public.current_org_id(), 'payme', 'pm-1', 1, 'X');
    raise exception 'FAIL: administrator to''lov funksiyasini chaqirdi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.payment_transactions (organization_id, provider, provider_id, id, customer_id, amount, state, create_time)
    values (public.current_org_id(), 'payme', 'soxta', 'soxta', 'c1', 100, 2, 1);
    raise exception 'FAIL: administrator provayder tranzaksiyasini qo''lda yozdi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- 7c) v1.2: SMS jurnali — yozuvni faqat service_role qo'shadi; administrator va kassir ko'radi, o'qituvchi ko'rmaydi
insert into public.sms_log (organization_id, customer_id, phone, text, kind, status, provider_id)
values (current_setting('test.org_a')::uuid, 'c1', '998901234567', 'Eslatma', 'reminder', 'sent', 'eskiz-1');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.sms_log) <> 1 then raise exception 'FAIL: administrator SMS jurnalini ko''rmadi'; end if;
  begin
    insert into public.sms_log (organization_id, phone, text, kind, status) values (public.current_org_id(), '998901234567', 'soxta', 'test', 'sent');
    raise exception 'FAIL: administrator SMS jurnaliga qo''lda yozdi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
do $$ begin
  if (select count(*) from public.sms_log) <> 1 then raise exception 'FAIL: kassir SMS jurnalini ko''rmadi'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  if exists (select 1 from public.sms_log) then raise exception 'FAIL: o''qituvchi SMS jurnalini ko''rdi'; end if;
end $$;
reset role;
-- 7d) v1.2: Telegram bot — ota-ona bog'lanishi va xabarlar navbati (dars qoldirildi, to'lov qabul qilindi)
insert into public.integration_secrets (organization_id, provider, secret)
values (current_setting('test.org_a')::uuid, 'telegram', '{"token":"1:x","webhookSecret":"w"}');
insert into public.telegram_links (organization_id, customer_id, chat_id) values (current_setting('test.org_a')::uuid, 'c1', 555001);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
-- Administrator "Kelmadi" belgilaydi va kirim yozadi — navbatga tushadi; bog'lanmagan o'quvchi uchun — tushmaydi
insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd7', 'g1', 'c1', current_date - 2, 'absent');
insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd8', 'g2', 'c2', current_date - 2, 'absent');
insert into public.transactions (organization_id, id, type, amount, method, category, customer_id, date) values (public.current_org_id(), 't9', 'income', 300000, 'cash', 'course_fee', 'c1', now());
insert into public.transactions (organization_id, id, type, amount, method, category, customer_id, status, date) values (public.current_org_id(), 't10', 'income', 100000, 'cash', 'course_fee', 'c1', 'pending', now());
do $$ begin
  if (select count(*) from public.telegram_links) <> 1 then raise exception 'FAIL: administrator Telegram bog''lanishini ko''rmadi'; end if;
  begin
    perform 1 from public.notification_outbox;
    raise exception 'FAIL: administrator xabarlar navbatini o''qidi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.telegram_links (organization_id, customer_id, chat_id) values (public.current_org_id(), 'c2', 1);
    raise exception 'FAIL: administrator Telegram bog''lanishini qo''lda yozdi';
  exception when insufficient_privilege then null; end;
  begin
    perform public.outbox_wanted(public.current_org_id(), 'c1');
    raise exception 'FAIL: administrator outbox_wanted ni chaqirdi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare
  v_org uuid := current_setting('test.org_a')::uuid;
begin
  if (select count(*) from public.notification_outbox where organization_id = v_org and kind = 'absence' and customer_id = 'c1' and payload ->> 'group_id' = 'g1') <> 1 then
    raise exception 'FAIL: "Kelmadi" navbatga tushmadi';
  end if;
  if exists (select 1 from public.notification_outbox where customer_id = 'c2') then raise exception 'FAIL: bog''lanmagan o''quvchi uchun navbat'; end if;
  if (select count(*) from public.notification_outbox where organization_id = v_org and kind = 'payment' and (payload ->> 'amount')::bigint = 300000) <> 1 then
    raise exception 'FAIL: to''lov navbatga tushmadi';
  end if;
  -- "Kutilmoqda" kirim — navbatga tushmaydi; "To'langan"ga o'tsa — tushadi
  if exists (select 1 from public.notification_outbox where payload ->> 'transaction_id' = 't10') then raise exception 'FAIL: kutilayotgan to''lov navbatga tushdi'; end if;
  update public.transactions set status = 'paid' where organization_id = v_org and id = 't10';
  if not exists (select 1 from public.notification_outbox where payload ->> 'transaction_id' = 't10') then raise exception 'FAIL: to''langan bo''lgach navbatga tushmadi'; end if;
end $$;

-- 7e) v1.2: filiallar. Filialga cheklangan xodim faqat o'z filiali guruhlari, o'quvchilari va to'lovlarini ko'radi va yozadi
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e4', 'filial-menejer@a.uz'),
  ('00000000-0000-0000-0000-0000000000e5', 'filial-admin@a.uz');
insert into public.profiles (id, organization_id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000e4', current_setting('test.org_a')::uuid, 'Kamola Ergasheva', 'manager'),
  ('00000000-0000-0000-0000-0000000000e5', current_setting('test.org_a')::uuid, 'Jasur Tursunov', 'admin');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.branches (organization_id, id, name, address) values
  (public.current_org_id(), 'f1', 'Chilonzor filiali', 'Chilonzor 9'),
  (public.current_org_id(), 'f2', 'Yunusobod filiali', 'Yunusobod 4');
update public.groups set branch_id = 'f1' where id = 'g1';
update public.groups set branch_id = 'f2' where id = 'g2';
update public.customers set branch_id = 'f1' where id = 'c1';
insert into public.customers (organization_id, id, name, phone, course, status, source, branch_id) values (public.current_org_id(), 'c5', 'Yunusobod lidi', '', '', 'new', 'website', 'f2');
-- Filialsiz kirim (Payme, eski ilova): o'qish guruhining filiali avtomatik yoziladi
insert into public.transactions (organization_id, id, type, amount, method, category, customer_id, enrollment_id, date) values (public.current_org_id(), 't11', 'income', 400000, 'cash', 'course_fee', 'c2', 'e2', now());
insert into public.transactions (organization_id, id, type, amount, method, category, date, branch_id) values (public.current_org_id(), 't12', 'expense', 2000000, 'cash', 'rent', now(), 'f1');
insert into public.transactions (organization_id, id, type, amount, method, category, date) values (public.current_org_id(), 't13', 'expense', 900000, 'transfer', 'utilities', now());
select public.set_staff_branch('00000000-0000-0000-0000-0000000000e4', 'f2');
select public.set_staff_branch('00000000-0000-0000-0000-0000000000e5', 'f2');
do $$ begin
  if (select branch_id from public.transactions where id = 't11') is distinct from 'f2' then raise exception 'FAIL: kirimga filial avtomatik yozilmadi'; end if;
  if not exists (select 1 from public.audit_log where action = 'branch.create' and summary = 'Yunusobod filiali') then raise exception 'FAIL: filial jurnalda yo''q'; end if;
  -- Oxirgi filialsiz administrator filialga cheklanmaydi
  begin
    perform public.set_staff_branch('00000000-0000-0000-0000-00000000000a', 'f1');
    raise exception 'FAIL: oxirgi filialsiz administrator filialga cheklandi';
  exception when insufficient_privilege then null; end;
  -- Xodim biriktirilgan filial o'chirilmaydi
  begin
    delete from public.branches where id = 'f2';
    raise exception 'FAIL: xodim biriktirilgan filial o''chirildi';
  exception when foreign_key_violation then null; end;
end $$;
reset role;

-- Filialga cheklangan menejer (Yunusobod)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
do $$ begin
  if (select string_agg(id, ',' order by id) from public.branches) is distinct from 'f2' then raise exception 'FAIL: filialli xodim boshqa filialni ko''rdi'; end if;
  if (select string_agg(id, ',' order by id) from public.groups) is distinct from 'g2' then raise exception 'FAIL: filialli xodim boshqa filial guruhini ko''rdi'; end if;
  -- c2 — filialsiz, lekin shu filial guruhida o'qiydi; c5 — shu filial lidi; c1 — boshqa filial
  if (select string_agg(id, ',' order by id) from public.customers where deleted_at is null) is distinct from 'c2,c5' then
    raise exception 'FAIL: filialli xodim mijozlari: %', (select string_agg(id, ',' order by id) from public.customers);
  end if;
  if (select string_agg(id, ',' order by id) from public.transactions) is distinct from 't11' then
    raise exception 'FAIL: filialli xodim to''lovlari: %', (select string_agg(id, ',' order by id) from public.transactions);
  end if;
  if exists (select 1 from public.enrollments where group_id <> 'g2') then raise exception 'FAIL: boshqa filial o''qishlari ko''rindi'; end if;
  if exists (select 1 from public.attendance where group_id = 'g1') then raise exception 'FAIL: boshqa filial davomati ko''rindi'; end if;
  if exists (select 1 from public.telegram_links) then raise exception 'FAIL: boshqa filial o''quvchisining bot bog''lanishi ko''rindi'; end if;
  if exists (select 1 from public.sms_log) then raise exception 'FAIL: boshqa filial SMS jurnali ko''rindi'; end if;
  -- Yozish: faqat o'z filialiga
  insert into public.customers (organization_id, id, name, phone, course, status, source, branch_id) values (public.current_org_id(), 'c6', 'Yangi lid', '', '', 'new', 'telegram', 'f2');
  begin
    insert into public.customers (organization_id, id, name, phone, course, status, source, branch_id) values (public.current_org_id(), 'c7', 'X', '', '', 'new', 'telegram', 'f1');
    raise exception 'FAIL: boshqa filialga mijoz yozildi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.customers (organization_id, id, name, phone, course, status, source) values (public.current_org_id(), 'c8', 'X', '', '', 'new', 'telegram');
    raise exception 'FAIL: filialsiz mijoz yozildi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.transactions (organization_id, id, type, amount, method, category, date, branch_id) values (public.current_org_id(), 't14', 'income', 1000, 'cash', 'other_income', now(), 'f1');
    raise exception 'FAIL: boshqa filialga kirim yozildi';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (public.current_org_id(), 'd9', 'g1', 'c1', current_date, 'present');
    raise exception 'FAIL: boshqa filial guruhiga davomat yozildi';
  exception when insufficient_privilege then null; end;
  -- Ko'rinmaydigan yozuv: savatchaga o'tmaydi, o'zgarmaydi; cheklovni o'zi olib tashlay olmaydi
  if public.trash_move('customers', array['c1']) <> 0 then raise exception 'FAIL: boshqa filial mijozi savatchaga o''tdi'; end if;
  update public.groups set name = 'Hack' where id = 'g1';
  begin
    perform public.set_staff_branch('00000000-0000-0000-0000-0000000000e4', null);
    raise exception 'FAIL: menejer filial cheklovini olib tashladi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Filialga cheklangan administrator: filial qo'sha olmaydi, butun markaz jurnali va zaxirasi yopiq
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e5');
do $$ begin
  if exists (select 1 from public.audit_log) then raise exception 'FAIL: filialli administrator butun markaz jurnalini ko''rdi'; end if;
  if (select string_agg(id, ',' order by id) from public.transactions) is distinct from 't11' then raise exception 'FAIL: filialli administrator boshqa filial to''lovini ko''rdi'; end if;
  begin
    insert into public.branches (organization_id, id, name) values (public.current_org_id(), 'f3', 'Sergeli filiali');
    raise exception 'FAIL: filialli administrator filial qo''shdi';
  exception when insufficient_privilege then null; end;
  begin
    perform public.import_backup('{"customers": [], "transactions": []}'::jsonb);
    raise exception 'FAIL: filialli administrator butun markaz zaxirasini import qildi';
  exception when insufficient_privilege then null; end;
  -- Direktorni (filialsiz) bloklay olmaydi; o'z filiali menejerini o'zgartira oladi
  begin
    perform public.update_staff('00000000-0000-0000-0000-00000000000a', null, 'blocked');
    raise exception 'FAIL: filialli administrator direktorni blokladi';
  exception when insufficient_privilege then null; end;
  perform public.update_staff('00000000-0000-0000-0000-0000000000e4', null, null, null, 'Filial menejeri');
end $$;
reset role;

-- Filialsiz administrator: hammasini ko'radi, boshqa filial ma'lumoti o'zgarmagan
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select name from public.groups where id = 'g1') <> 'IELTS — kechki' then raise exception 'FAIL: boshqa filial guruhi o''zgardi'; end if;
  if (select deleted_at from public.customers where id = 'c1') is not null then raise exception 'FAIL: boshqa filial mijozi savatchaga tushdi'; end if;
  if not exists (select 1 from public.customers where id = 'c6' and branch_id = 'f2') then raise exception 'FAIL: filial menejeri qo''shgan mijoz ko''rinmadi'; end if;
  if (select count(*) from public.transactions where id in ('t11', 't12', 't13')) <> 3 then raise exception 'FAIL: filialsiz administrator barcha to''lovlarni ko''rmadi'; end if;
  if (select count(*) from public.branches) <> 2 then raise exception 'FAIL: administrator filiallarni ko''rmadi'; end if;
end $$;
reset role;

-- B markazi A ning provayder tranzaksiyalarini ko'rmaydi
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  if exists (select 1 from public.payment_transactions) then raise exception 'FAIL: B markazi A ning Payme tranzaksiyasini ko''rdi'; end if;
  if exists (select 1 from public.transactions where provider is not null) then raise exception 'FAIL: B markazi A ning Payme kirimini ko''rdi'; end if;
  if exists (select 1 from public.sms_log) then raise exception 'FAIL: B markazi A ning SMS jurnalini ko''rdi'; end if;
  if exists (select 1 from public.telegram_links) then raise exception 'FAIL: B markazi A ning Telegram bog''lanishini ko''rdi'; end if;
  if exists (select 1 from public.branches) then raise exception 'FAIL: B markazi A ning filiallarini ko''rdi'; end if;
  if exists (select 1 from public.customers where branch_id is not null) then raise exception 'FAIL: B markazi A ning filial mijozlarini ko''rdi'; end if;
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
  if (select count(*) from public.customers where deleted_at is null) <> 5 then raise exception 'FAIL: muddati o''tganda o''qish yopildi'; end if;
  begin
    insert into public.customers (organization_id, id, name, phone, course, status, source) values (public.current_org_id(), 'c4', 'Z', '', '', 'new', 'website');
    raise exception 'FAIL: muddati o''tgan markaz yozdi';
  exception when insufficient_privilege then null; end;
  begin
    perform public.owner_list_orgs();
    raise exception 'FAIL: oddiy administrator sotuvchi ro''yxatini ko''rdi';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'RLS_OK' as result, :'imported' as imported;
