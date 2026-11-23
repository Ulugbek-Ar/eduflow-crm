# FIX-REMAINING — fix/qa-2026-11

Holat: 1–3-bosqichlar to'liq, 4-bosqich qisman. Tekshiruv: `npm run check` ✅ (641 test), e2e ✅ 25/7 skip, RLS ✅.

## Tuzatilgan (commit = ID)
N-1, N-2, A-01, B-02 · B-01, B-03, B-04 · A-02, A-03, A-04, A-08 · QA-01b, A-05, A-06, A-07, B-05, QA-09

## Qolgan ID'lar
- 4-bosqich: QA-08, QA-11 (CLS, avval o'lchash), QA-12 (390 px tablar, avval o'lchash), QA-13 (bot matnlari), QA-14 (xodimlar
  jadvalida filial ustuni), QA-15 (404 sahifa kontenti), QA-16 (RU skrinshot/sarlavha), QA-17 (bosish nishonlari, avval o'lchash),
  QA-18 (usta rol tanlovi kengligi), QA-19 (o'qituvchi: ikki dars tanlovi, filial tanlovi; narx — egasi qarori), QA-20 (aria),
  QA-21 (chek "Qabul qildi" onlayn/import, "Qarz yo'q"), QA-22 (to'lov oynasida Status), QA-23 (/owner i18n, "IT Park Kids"),
  QA-04 (faqat kod tomoni; rekvizitlar — egasi), A-09 (bo'lim URL'da), B-06 (eskicha qarz to'lov muddatiga bog'liq).
- 5-bosqich: landing CTA (Supabase kalitlari bo'lsa "Bepul boshlash", bo'lmasa narx kartalarida VITE_CONTACT_URL "Bog'lanish";
  "Ro'yxatdan o'ting" matni amalga mos), mobil (≤480px) KPI 2×2 va "Bugungi darslar" birinchi ekranda.

## DAVOM ETTIRISH PROMPTI
```text
EduFlow CRM: QA tuzatishlarini davom ettir. Repo: https://github.com/Ulugbek-Ar/eduflow-crm, branch: fix/qa-2026-11 (shundan davom et,
yangi branch ochma). Qolgan ID'lar: qa-reports/FIX-REMAINING.md. Topilma tafsiloti: qa-audit branch → qa-reports/REPORT.md
(faqat kerakli ID qatorini grep bilan o'qi).
TOKEN TEJASH: butun repo/REPORT.md'ni o'qima; faqat ID qatori va ko'rsatilgan fayllar (grep, sed -n). Har tuzatishdan keyin faqat
tegishli test (npx vitest run <fayl>); to'liq `npm run check` faqat bosqich oxirida. Izoh va commit xabarlari qisqa.
QOIDALAR: faqat fix/qa-2026-11 ga commit/push; main'ga push, merge, force-push, PR — yo'q. Har topilma: avval muammoni ko'rsatadigan
test, keyin tuzatish; bitta ID — bitta commit `fix(qa): <ID> <qisqa>`. Yangi matnlar tr() da, ru.ts tarjimasi bilan. Migratsiya —
yangi fayl. supabase/ o'zgarsa: PGHOST=… bash supabase/tests/run-local.sh, rls_test.sql'ga test. Engine manbasi o'zgarsa:
npm run build:engine. Bosqich oxirida npm run check (+ e2e: PW_CHROMIUM_PATH=… npx playwright test --trace off) → push.
QA-11, QA-12, QA-17: avval 390 px va Lighthouse mobil bilan joriy holatni o'lcha; muammo qolsa tuzat.
TEGMA: tarif tarkibi, huquqiy rekvizitlar matni, GitHub default branch — faqat yakuniy hisobotda eslat.
Limit yaqinlashsa: commit, push, FIX-REMAINING.md'ni yangila (qolgan ID'lar + shu prompt).
YAKUNIY HISOBOT: ID → tuzatildi/qisman/qoldirildi (sabab), qo'shilgan testlar soni, check/e2e/RLS, oxirgi commit hash.
```
