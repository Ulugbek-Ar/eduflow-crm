-- EduFlow CRM v1.1: o'qituvchi roli.
-- Alohida faylda: PostgreSQL yangi enum qiymatini u qo'shilgan tranzaksiya ichida ishlatishga ruxsat bermaydi,
-- Supabase CLI esa har migratsiya faylini alohida tranzaksiyada bajaradi
alter type public.app_role add value if not exists 'teacher';
