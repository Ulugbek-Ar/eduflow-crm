# QA audit — progress

- **Audit qilingan commit:** `main` = `d62889ee5403d9d66c0e55132e872c212df256e0` (v1.2.2)
- **Sana:** 2026-11-18
- **Audit klon:** repodan tashqarida (`/home/user/qa/audit`), hisobot — alohida worktree (`qa-audit` branch)

## 1. Tayyorgarlik — BAJARILDI

| Tekshiruv | Natija |
|---|---|
| `npm ci` | OK (package.json / lock o'zgarmadi) |
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` (oxlint --deny-warnings) | ✅ exit 0 |
| `npm test` (vitest) | ✅ 95 fayl, 598/598 test |
| `npm run build` | ✅ exit 0 (eng katta chunk'lar: index 242.7 kB / gz 77.3, supabase 231.4 / 60.0, App 202.8 / 67.7, ru 155.4 / 44.5) |
| `npm run check:engine` | ✅ engine.js manba bilan mos |
| `npm run e2e` (Playwright, desktop+mobile) | ✅ 25 passed, 7 skipped (loyihada atayin skip qilingan) |
| RLS testi (`supabase/tests/run-local.sh`, lokal PostgreSQL 16) | ✅ `RLS_OK` |
| Jonli sayt = main? | ✅ Ha. `gh-pages@8dc0180` "deploy: …@d62889e"; jonli `index.html` gh-pages bilan bayt-bayt bir xil; `App` chunk main'dan qayta yig'ilgan build bilan hash'lardan tashqari 0 farq; `index` chunk faqat CI'dagi bo'sh `VITE_BRAND_*` qiymatlari bilan farq qiladi |

Muhit cheklovlari: Docker daemon yo'q → `supabase start` imkonsiz. RLS faqat oddiy PostgreSQL 16 da (migratsiyalar + stub auth) tekshiriladi; PostgREST/Auth/Realtime bilan brauzer sinovi — "Tekshirilmadi".

## Keyingi qadamlar
Rollar/ruxsatlar → moliya/qarz → ma'lumot yo'qolishi → QA-01…23 → qolgan modullar → dizayn/a11y/tezlik.

## 2. Rollar va ruxsatlar — BAJARILDI (lokal build, demo rejim)

Skriptlar: `tests/roles.mjs` (5 rol × 11 bo'lim × 1440/768/390), `tests/roles-modals.mjs`, `tests/esc-probe.mjs`, `tests/manager-expense.mjs`.

| Rol | Menyu (1440/768/390 bir xil) | Kassa balansi | Kutilgan (permissions.ts) |
|---|---|---|---|
| admin | hammasi (attendance'siz) | ✅ ko'rinadi | ✅ mos |
| manager | overview, customers, groups, schedule, finance, courses, settings, help | yashirin | ✅ mos |
| cashier | + teachers, analytics (admin, groups.edit yo'q) | ✅ ko'rinadi | ✅ mos |
| viewer | cashier menyusi, lekin hech qanday tahrirlash tugmasi yo'q; "Qo'shish" va "Hisobot yuklash" yo'q | yashirin | ✅ mos |
| teacher | Bugun, Guruhlarim, Mening jadvalim, Davomat, Sozlamalar, Yordam; telefon 0 ta | yashirin | ✅ mos |

- 15 kombinatsiyada konsol xatosi 0, network xatosi 0, sahifa gorizontal siljishi yo'q.
- "N" tezkor tugmasi faqat `customers.edit` bor rollarda oyna ochadi (admin, manager) ✅.
- Bo'limlar URL'da saqlanmaydi (faqat `/app`), shuning uchun URL orqali bo'limga kirish imkonsiz; amallar `DashboardContext.allowed()` bilan ikkinchi qatlamda himoyalangan ✅.
- Lokal rejimda rollar faqat brauzerda (README:590 da hujjatlashtirilgan) — C guruhiga.

**Topilmalar:** A-02 (menejerga "Chiqim" ko'rinadi, saqlashda rad, ma'lumot yo'qoladi), A-03 (o'chirilgan birinchi maydonli oynada fokus/Escape ishlamaydi — kuzatuvchi/kassir mijoz kartasi).

## 3. Moliya / qarz / davomat hisob-kitoblari — ASOSIY QISMI BAJARILDI

- Mustaqil hisob (`tests/verify-money.mjs`, `tests/verify-debts.mjs`) demo ma'lumotida UI bilan **to'liq mos**: kassa balansi 190 305 000, shu oy kirim 31 726 000 / chiqim 26 091 000 / sof 5 635 000, 59 yozuv, faol o'quvchilar 54, qarzdorlar 7 ta / 9 020 000.
- **A-01 (High):** oy o'rtasida boshqa guruhga ko'chirilgan, to'liq to'lagan o'quvchida soxta qarz (650 000) va ikki baravar "Oylik" (1 300 000) — `tests/transfer.mjs`, `screenshots/A-transfer-double-charge.png`.
- B: `utils/attendance.ts:78` `trailingAbsences` eski `excused` yozuvini "kelmadi" deb sanamaydi (`simpleStatus` bilan nomuvofiq).

## Joriy holat
Keyingi: ma'lumot yo'qolishi (refresh/rol almashish), QA-01…QA-23 qayta sinash.
