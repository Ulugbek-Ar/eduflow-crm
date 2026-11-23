-- Lokal Supabase (supabase start) uchun namunaviy markaz. Kirish: demo@eduflow.uz / DemoParol2026
-- Haqiqiy loyihada (supabase db push) seed ishlatilmaydi
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'demo@eduflow.uz',
        crypt('DemoParol2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
        '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@eduflow.uz"}', 'email', now(), now(), now())
on conflict do nothing;

insert into public.organizations (id, name, plan, trial_ends_at, settings)
values ('22222222-2222-2222-2222-222222222222', 'Bilim Plus (demo)', 'trial', now() + interval '14 days',
        '{"orgName":"Bilim Plus (demo)","logoText":"BP","currency":"UZS","dateFormat":"dd.mm.yyyy","csvDelimiter":";"}')
on conflict (id) do nothing;

insert into public.profiles (id, organization_id, full_name, title, role)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Dilshod Karimov', 'Direktor', 'admin')
on conflict (id) do nothing;

insert into public.courses (organization_id, id, name, type, duration_months, monthly_price, active_groups) values
  ('22222222-2222-2222-2222-222222222222', 'k1', 'Ingliz tili (IELTS)', 'course', 6, 650000, 3),
  ('22222222-2222-2222-2222-222222222222', 'k2', 'Matematika (DTM)', 'course', 9, 450000, 2),
  ('22222222-2222-2222-2222-222222222222', 'k3', 'Python asoslari', 'course', 4, 800000, 1)
on conflict do nothing;

insert into public.customers (organization_id, id, name, phone, course, status, source, created_at, paid_at) values
  ('22222222-2222-2222-2222-222222222222', 'c1', 'Aziza Karimova', '+998 90 123 45 67', 'Ingliz tili (IELTS)', 'paid', 'instagram', now() - interval '40 days', now() - interval '38 days'),
  ('22222222-2222-2222-2222-222222222222', 'c2', 'Bobur Aliyev', '+998 93 555 44 33', 'Python asoslari', 'thinking', 'telegram', now() - interval '6 days', null),
  ('22222222-2222-2222-2222-222222222222', 'c3', 'Dilnoza Sobirova', '+998 94 222 11 00', 'Matematika (DTM)', 'new', 'referral', now() - interval '1 day', null)
on conflict do nothing;

insert into public.transactions (organization_id, id, type, amount, method, category, note, customer_id, customer_name, status, date) values
  ('22222222-2222-2222-2222-222222222222', 't1', 'income', 650000, 'card', 'course_fee', 'IELTS — 1-oy', 'c1', 'Aziza Karimova', 'paid', now() - interval '38 days'),
  ('22222222-2222-2222-2222-222222222222', 't2', 'income', 650000, 'cash', 'course_fee', 'IELTS — 2-oy', 'c1', 'Aziza Karimova', 'paid', now() - interval '8 days'),
  ('22222222-2222-2222-2222-222222222222', 't3', 'expense', 3000000, 'transfer', 'rent', 'Xona ijarasi', null, null, 'paid', now() - interval '5 days')
on conflict do nothing;
