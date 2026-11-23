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

## 4. Ma'lumot yo'qolishi — BAJARILDI

| Holat | Natija |
|---|---|
| Demo: mijoz qo'shish → sahifani yangilash | ✅ ma'lumot va demo rejim saqlanadi; ⚠️ joriy bo'lim "Umumiy ko'rinish"ga qaytadi (bo'lim URL'da yo'q) |
| Demo: rol almashtirish | ✅ yangi mijoz menejerga ham ko'rinadi |
| Forma qoralamasi (yangilashdan keyin) | ✅ tiklanadi |
| Qoralama boshqa xodimga | ⚠️ `apex:draft:*` kaliti foydalanuvchiga bog'lanmagan — admin yozgan qoralama menejerga ochiladi (B, Low) |
| Lokal: ikki tab bir vaqtda mijoz qo'shadi | ✅ ikkalasi ham saqlanadi, ikkala tabda ko'rinadi (`tests/twotabs.mjs`) |
| Menejer "Chiqim"ni to'ldirib saqlaydi | ❌ rad etiladi va qoralama `clear()` bilan o'chadi — kiritilgan ma'lumot yo'qoladi (A-02) |

## 5. QA-01…QA-23 qayta sinash — BAJARILDI (QA-11 — Lighthouse bosqichida)

Natija: 21 ta "Hali mavjud", QA-04 va QA-15/QA-16 — qisman. To'liq jadval REPORT.md da bo'ladi.
Skriptlar: `tests/qa-retest.mjs`, `tests/qa06.mjs`, `tests/qa-mobile-live.mjs`, `tests/local-onboarding.mjs`, `tests/live-legal.mjs`.

## 6. Supabase RLS, sync, offline — BAJARILDI (izolyatsiyalangan lokal PostgreSQL 16)

`supabase start` imkonsiz (Docker daemon yo'q). Migratsiyalar + `stub_auth.sql` toza `qa_rls` bazasiga qo'llandi, o'z hujum testlarim: `tests/sql/qa_rls_attack.sql`, natija: `tests/sql/qa_rls_attack.result.txt`.

| Test | Natija |
|---|---|
| B markaz admini A ning customers/transactions/profiles/audit_log ni o'qiydi | PASS (0 qator) |
| B admin A ma'lumotini/org'ini UPDATE, trash_move | PASS (0 qator) |
| **`write_audit(p_org, …)` — B admin / tashkilotsiz foydalanuvchi / `anon` A jurnaliga yozadi** | **FAIL — 3 ta soxta yozuv A administratoriga ko'rinadi** |
| O'qituvchi: customers, transactions jadvali, boshqa guruh, boshqa guruhga/kelajak sanaga davomat | PASS |
| `teacher_roster` / `teacher_directory` telefon va maoshni niqoblaydi | PASS |
| Filial (b1) menejeri: boshqa filial mijozi/tranzaksiyasini o'qish, boshqa filialga qo'shish | PASS |
| **Filial menejeri o'z mijozini boshqa filialga ko'chiradi (`branch_id='b2'`)** | **FAIL** |
| Kassir: o'zini admin qilish (`update_staff`, `profiles` UPDATE), org settings | PASS |
| **Kassir Payme to'lovi summasini 1 ga o'zgartiradi va `provider` ni o'chiradi** | **FAIL** (UI'da readOnly, serverda himoya yo'q) |
| anon customers o'qiydi | PASS |

Cloud sync (kod auditi): `src/data/supabase.ts:376` butun qatorni `upsert` qiladi, `updated_at` bo'yicha konflikt tekshiruvi yo'q → bir yozuvni ikki xodim ≤90 s ichida tahrirlasa, oxirgisi g'olib (B). Brauzerda bulut bilan — Tekshirilmadi.

Offline (lokal/demo): ma'lumot yozish ishlaydi ✅; lekin 4 bo'lim (O'qituvchilar, Dars jadvali, Boshqaruv, Yordam) oldindan yuklanmagan → offline'da ochilmaydi va internet qaytgach ham "Qayta yuklash"siz tiklanmaydi (A-04, `tests/offline.mjs`).

## 7. Modullar, a11y, tezlik — QISMAN BAJARILDI

- Forma validatsiyasi (admin, 1440): mijoz (bo'sh/bo'shliqlar/qisqa telefon ✅; 300 belgilik ism saqlanadi — A-06), kurs (bo'sh ✅, manfiy narx kiritib bo'lmaydi ✅), guruh (bo'sh ✅).
- Qidiruv/saralash/pagination ✅ (1–10 / 476 → 11–20 / 476); "Python 1" → 250 natija (A-05).
- Eksport: CSV UTF-8 BOM ✅, formula injection ekranlangan ✅; telefon `'+998…` (A-07).
- Import chekka holatlar (`tests/import-edge.mjs`): XSS bajarilmadi ✅, formula matn ✅, `8…`/`0…` telefon rad etiladi (QA-01 bilan nomuvofiq).
- axe-core WCAG 2.1 AA: 12 sahifa × light/dark = 0 buzilish ✅. Klaviatura fokusi ko'rinadi ✅.
- Lighthouse mobil: lokal landing 98 / app 70 (CLS 0.601), jonli landing 100 / app 73 (CLS 0.973, SEO 63 — `/app` atayin noindex).
- 390 px: < 24 px bosish nishonlari (QA-17) — moliya 26, mijozlar 14.

## Yakuniy holat
- REPORT.md (A/B/C, QA jadvali, xulosa, tuzatish prompti) va REMAINING.md (bajarilmaganlar + davom ettirish prompti) yozildi.
- Audit klonida `git status` toza (0 o'zgarish), HEAD = d62889e.

## 8. Qayta sinov 2026-11-23 (003b61f) — BAJARILDI
7 ta QA tuzatilgan (01, 02, 03, 05, 06, 07, 10), 2 tasi qisman (04, 09); A-01…A-07 va B-01…B-06 hali mavjud. Batafsil: REPORT.md → "Qayta sinov".
