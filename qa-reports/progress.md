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
