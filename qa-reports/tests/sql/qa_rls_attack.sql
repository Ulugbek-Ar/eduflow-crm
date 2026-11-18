-- QA: kross-tenant va rol bo'yicha hujum testlari (faqat lokal PostgreSQL; stub_auth.sql + migratsiyalardan keyin)
\set ON_ERROR_STOP on
set client_min_messages = warning;
insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-00000000000a','a-admin@qa'), ('10000000-0000-0000-0000-00000000000b','a-teacher@qa'),
 ('10000000-0000-0000-0000-00000000000c','a-cashier@qa'), ('10000000-0000-0000-0000-00000000000d','a-branchmgr@qa'),
 ('20000000-0000-0000-0000-00000000000a','b-admin@qa'), ('30000000-0000-0000-0000-00000000000a','no-org@qa');
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); execute 'set role authenticated'; end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', false); execute 'set role anon'; end $$;
create temp table results(test text, outcome text);
grant all on results to public;

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
select public.create_organization('Org A', 'A Admin') as org_a \gset
reset role;
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select public.create_organization('Org B', 'B Admin') as org_b \gset
reset role;
-- A: filial, xodimlar, ma'lumot
insert into public.branches (organization_id, id, name) values (:'org_a','b1','Chilonzor'), (:'org_a','b2','Yunusobod');
insert into public.profiles (id, organization_id, full_name, role) values
 ('10000000-0000-0000-0000-00000000000b', :'org_a', 'A Teacher', 'teacher'),
 ('10000000-0000-0000-0000-00000000000c', :'org_a', 'A Cashier', 'cashier');
insert into public.profiles (id, organization_id, full_name, role, branch_id) values ('10000000-0000-0000-0000-00000000000d', :'org_a', 'A Branch Mgr', 'manager', 'b1');
insert into public.courses (organization_id, id, name, type, duration_months, monthly_price) values (:'org_a','k1','IELTS','course',6,650000);
insert into public.teachers (organization_id, id, name, user_id) values (:'org_a','p1','A Teacher','10000000-0000-0000-0000-00000000000b'), (:'org_a','p2','Other T',null);
insert into public.groups (organization_id, id, name, course_id, teacher_id, days, start_time, end_time, capacity, start_date, branch_id) values
 (:'org_a','g1','G own','k1','p1','{mon,wed,fri}','09:00','10:30',15,'2026-01-01','b1'),
 (:'org_a','g2','G other','k1','p2','{mon,wed,fri}','09:00','10:30',15,'2026-01-01','b2');
insert into public.customers (organization_id, id, name, phone, course, status, source, branch_id) values
 (:'org_a','c1','Cust b1','+998901111111','IELTS','paid','website','b1'),
 (:'org_a','c2','Cust b2','+998902222222','IELTS','paid','website','b2');
insert into public.enrollments (organization_id, id, customer_id, group_id, start_date, status) values (:'org_a','e1','c1','g1','2026-01-01','active'), (:'org_a','e2','c2','g2','2026-01-01','active');
insert into public.transactions (organization_id, id, type, amount, method, category, customer_id, date) values (:'org_a','t1','income',650000,'card','course_fee','c1',now()), (:'org_a','t2','income',650000,'card','course_fee','c2',now());

-- 1) B admin: A ma'lumotini ko'radimi / o'zgartiradimi
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
insert into results select 'B reads A customers', case when count(*) = 0 then 'PASS' else 'FAIL ' || count(*) end from public.customers where organization_id = :'org_a';
insert into results select 'B reads A transactions', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.transactions where organization_id = :'org_a';
insert into results select 'B reads A profiles', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.profiles where organization_id = :'org_a';
insert into results select 'B reads A audit_log', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.audit_log where organization_id = :'org_a';
with u as (update public.customers set name = 'HACK' where organization_id = :'org_a' returning 1) insert into results select 'B updates A customers', case when count(*) = 0 then 'PASS' else 'FAIL' end from u;
with u as (update public.organizations set name = 'HACK' where id = :'org_a' returning 1) insert into results select 'B updates A org', case when count(*) = 0 then 'PASS' else 'FAIL' end from u;
do $$ begin begin perform public.trash_move('customers', array['c1','c2']); exception when others then null; end; end $$;
reset role;
insert into results select 'B trash_move A customers', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.customers where deleted_at is not null;

-- 2) write_audit: boshqa markaz jurnaliga yozish (B admin, profilsiz foydalanuvchi, anon)
\set ON_ERROR_STOP off
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select public.write_audit(:'org_a', 'customer.delete', 'FORGED by B admin', 'c1');
reset role;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select public.write_audit(:'org_a', 'staff.delete', 'FORGED by user without org', null);
reset role;
select pg_temp.as_anon();
select public.write_audit(:'org_a', 'payment.delete', 'FORGED by anon', null);
reset role;
\set ON_ERROR_STOP on
insert into results select 'write_audit cross-org (B admin)', case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ' row)' end from public.audit_log where organization_id = :'org_a' and summary = 'FORGED by B admin';
insert into results select 'write_audit cross-org (no-org user)', case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ' row)' end from public.audit_log where organization_id = :'org_a' and summary = 'FORGED by user without org';
insert into results select 'write_audit cross-org (anon)', case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ' row)' end from public.audit_log where organization_id = :'org_a' and summary = 'FORGED by anon';
-- A admin forged yozuvni ko'radimi
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
insert into results select 'A admin sees forged audit rows', count(*)::text from public.audit_log where summary like 'FORGED%';
reset role;

-- 3) O'qituvchi: mijozlar, to'lovlar, boshqa guruh, davomat
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
insert into results select 'teacher reads customers table', case when count(*) = 0 then 'PASS' else 'FAIL ' || count(*) end from public.customers;
insert into results select 'teacher reads transactions', case when count(*) = 0 then 'PASS' else 'FAIL ' || count(*) end from public.transactions;
insert into results select 'teacher sees other group', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.groups where id = 'g2';
insert into results select 'teacher sees own group', case when count(*) = 1 then 'PASS' else 'FAIL ' || count(*) end from public.groups where id = 'g1';
\set ON_ERROR_STOP off
insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (:'org_a','qa1','g2','c2', current_date, 'present');
insert into public.attendance (organization_id, id, group_id, customer_id, date, status) values (:'org_a','qa2','g1','c1', current_date + 30, 'present');
\set ON_ERROR_STOP on
reset role;
insert into results select 'teacher marks other group', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.attendance where id = 'qa1';
insert into results select 'teacher marks future date', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.attendance where id = 'qa2';
-- teacher_roster: o'qituvchiga telefon qaytadimi
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
insert into results select 'teacher_roster columns', string_agg(distinct k, ',') from (select jsonb_object_keys(to_jsonb(r)) k from public.teacher_roster() r) x;
insert into results select 'teacher_roster rows (only own group?)', count(*)::text from public.teacher_roster();
reset role;

-- 4) Filialga cheklangan menejer (b1)
select pg_temp.as_user('10000000-0000-0000-0000-00000000000d');
insert into results select 'branch mgr reads other-branch customer', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.customers where id = 'c2';
insert into results select 'branch mgr reads other-branch tx', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.transactions where id = 't2';
\set ON_ERROR_STOP off
insert into public.customers (organization_id, id, name, phone, course, status, source, branch_id) values (:'org_a','qa3','X','','','new','website','b2');
update public.customers set branch_id = 'b2' where id = 'c1';
\set ON_ERROR_STOP on
reset role;
insert into results select 'branch mgr inserts into other branch', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.customers where id = 'qa3';
insert into results select 'branch mgr moves own customer to other branch', case when (select branch_id from public.customers where id = 'c1') = 'b1' then 'PASS' else 'FAIL (moved to ' || (select branch_id from public.customers where id = 'c1') || ')' end;

-- 5) Kassir: rolni oshirish, xodim qo'shish, sozlama
select pg_temp.as_user('10000000-0000-0000-0000-00000000000c');
\set ON_ERROR_STOP off
select public.update_staff('10000000-0000-0000-0000-00000000000c', 'admin', null, null, null);
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-00000000000c';
update public.organizations set settings = '{"orgName":"HACK"}' where id = :'org_a';
\set ON_ERROR_STOP on
reset role;
insert into results select 'cashier escalates to admin', case when (select role from public.profiles where id = '10000000-0000-0000-0000-00000000000c') = 'cashier' then 'PASS' else 'FAIL' end;
insert into results select 'cashier edits org settings', case when (select settings->>'orgName' from public.organizations where id = :'org_a') <> 'HACK' then 'PASS' else 'FAIL' end;

-- 6) anon: hech narsa o'qimaydi
select pg_temp.as_anon();
\set ON_ERROR_STOP off
insert into results select 'anon reads customers', case when count(*) = 0 then 'PASS' else 'FAIL' end from public.customers;
\set ON_ERROR_STOP on
reset role;

select test, outcome from results order by 1;

-- 7) Kassir: Payme orqali kelgan to'lov summasini API orqali o'zgartirish (UI'da readOnly)
insert into public.transactions (organization_id, id, type, amount, method, category, customer_id, date, provider) values (:'org_a','tp','income',650000,'card','course_fee','c1',now(),'payme');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000c');
\set ON_ERROR_STOP off
update public.transactions set amount = 1, provider = null where id = 'tp';
\set ON_ERROR_STOP on
reset role;
select 'cashier edits provider payment' as test, case when (select amount from public.transactions where id = 'tp') = 650000 then 'PASS' else 'FAIL (amount=' || (select amount from public.transactions where id = 'tp') || ', provider=' || coalesce((select provider from public.transactions where id = 'tp'), 'NULL') || ')' end as outcome;
