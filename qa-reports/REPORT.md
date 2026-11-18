# EduFlow CRM — to'liq QA audit hisoboti

| | |
|---|---|
| **Audit qilingan kod** | `main` = `d62889ee5403d9d66c0e55132e872c212df256e0` (v1.2.2) |
| **Sana** | 2026-11-18 |
| **Jonli sayt** | https://ulugbek-ar.github.io/eduflow-crm/ — `gh-pages@8dc0180` = main'dan deploy; kod bir xil (pastda) |
| **Usul** | Repodan tashqaridagi klonda `npm ci` → typecheck/lint/test/build → `vite preview` (demo + lokal rejim, production kalitlarisiz) ustida Playwright (Chromium) skriptlari; axe-core; Lighthouse 12; izolyatsiyalangan lokal PostgreSQL 16 da RLS hujum testlari. Jonli saytda faqat ko'rish (landing, `/privacy`, `/terms`, 404, `/owner`, demo). |
| **Ilova kodi** | o'zgartirilmagan; audit klonida `git status` toza |

Dalillar: `qa-reports/screenshots/`, skriptlar: `qa-reports/tests/` (`*.mjs` — Playwright, `sql/` — RLS), batafsil jurnal: `qa-reports/progress.md`.

---

## 0. Tayyorgarlik natijalari

| Tekshiruv | Natija |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` (oxlint `--deny-warnings`) | ✅ exit 0 |
| `npm test` (Vitest) | ✅ 95 fayl, **598/598** |
| `npm run build` | ✅; eng katta chunk'lar (gzip): `index` 77.3 kB, `App` 67.7 kB, `supabase` 60.0 kB (demo/lokal rejimda yuklanmaydi ✅), `ru` 44.5 kB; `dist/assets` jami 1.6 MB |
| `npm run check:engine` | ✅ |
| `npm run e2e` (desktop + mobile) | ✅ 25 passed, 7 skipped (loyihada atayin) |
| `supabase/tests/run-local.sh` (lokal PG 16) | ✅ `RLS_OK` |
| Jonli sayt = main? | ✅ jonli `index.html` = `gh-pages@8dc0180` ("deploy: …@d62889e"); `App` chunk main'dan qayta yig'ilganda hash'lardan tashqari 0 farq; `index` chunk faqat CI'dagi bo'sh `VITE_BRAND_*` bilan farq qiladi |

---

## A. Brauzerda tasdiqlangan xatolar

### Yangi topilmalar

| ID | Muammo | Joyi | Takrorlash qadamlari | Dalil | Muhimlik | Tavsiya |
|---|---|---|---|---|---|---|
| **A-01** | Oy o'rtasida boshqa guruhga **ko'chirilgan**, shu oyni to'liq to'lagan o'quvchida **soxta qarz** paydo bo'ladi va "Oylik" ikki baravar ko'rsatiladi | Guruh kartasi → "Ko'chirish"; `src/utils/debts.ts:130-153` (`monthExpected`: tugagan o'qishning oxirgi qisman oyi **to'liq** narxda; yangi o'qishning birinchi oyi ham to'liq), `src/context/eduActions.ts:206-227`, `debts.ts:297,307` ("Oylik" 31 kun ichida tugagan o'qishni ham qo'shadi). Admin/menejer · 1440 · lokal | Demo → Guruhlar → "IELTS — ertalabki" → "Ko'chirish: Iroda Tursunova" (noyabr uchun 650 000 to'lagan, qarzi yo'q) → "IELTS — kechki", sana 12.11.2026 → Saqlash → Moliya → Qarzdorliklar | `screenshots/A-transfer-double-charge.png`, `screenshots/A-transfer-dialog.png`, `tests/transfer.mjs` (oldin: 7 qarzdor / 9 020 000; keyin: 8 / 9 670 000, Iroda: oylik 1 300 000, qarz 650 000) | **High** | Ko'chirish oyida o'quvchidan bir oylik summa olinishi kerak: eski o'qishning oxirgi oyini va yangisining birinchi oyini kunlar ulushida hisoblash (yoki eski o'qish to'lovi/avansini yangi o'qishga o'tkazish). "Oylik" ustunida faqat `status === 'active'` o'qishlar. Avtomatik eslatma/SMS soxta qarzga ketmasligi uchun shoshilinch |
| **A-02** | Menejerga to'lov oynasida **"Chiqim"** tanlovi ko'rinadi (ruxsati yo'q). To'ldirib "Saqlash" bosilsa — "ruxsatingiz yo'q", oyna yopiladi va **kiritilgan ma'lumot yo'qoladi** (qoralama ham o'chadi) | `src/components/finance/TransactionFormModal.tsx:222-234` (segment ruxsatsiz), `:186-197` (`addTransaction` rad etsa ham `clear()` + `closeModal()`), `DashboardContext.tsx:764`. Menejer · 1440 · lokal | Demo → Rol: Menejer → Moliya → To'lov qabul qilish → "Chiqim" → Summa 1 500 000 → Saqlash | `screenshots/A-manager-expense-form.png`, `screenshots/A-manager-expense-denied.png`, `tests/manager-expense.mjs` (yozuvlar 1307 → 1307, toast "ruxsatingiz yo'q", oyna yopiq) | Medium | `payments.manage` bo'lmasa "Chiqim" segmentini yashirish; `addTransaction` natija qaytarsin — muvaffaqiyatsiz bo'lsa oyna va qoralama saqlanib qolsin |
| **A-03** | Birinchi forma elementi **disabled** bo'lgan oynada fokus oynaga o'tmaydi: **Escape ishlamaydi**, Tab fon sahifasiga ketadi (fokus tuzog'i buzilgan) | `src/components/ui/Modal.tsx:66-67` (`.modal-body select` disabled'ni ham tanlaydi, `focus()` jim muvaffaqiyatsiz, zaxira yo'q); `CustomerDetail.tsx:107-110` (`disabled={!can('customers.edit')}`). Kuzatuvchi, kassir · 1440 · lokal | Demo → Rol: Kuzatuvchi → Mijozlar → istalgan "… kartasi" → Escape | `tests/esc-probe.mjs`: admin — fokus `SELECT` (oyna ichida), Escape yopadi; kuzatuvchi — fokus `BUTTON "Aziza Qodirova kartasi"` (oynadan tashqarida), Escape'dan keyin oyna ochiq | Medium (a11y, WCAG 2.1.2/2.4.3) | Selektorga `:not([disabled])` qo'shish; `focus()` dan keyin `document.activeElement` oyna ichida bo'lmasa — dialogning o'ziga yoki "Yopish" tugmasiga fokus |
| **A-04** | Internet uzilganda banner "Ish davom etadi" deydi, lekin **O'qituvchilar, Dars jadvali, Boshqaruv, Yordam** bo'limlari ochilmaydi ("Bo'lim yuklanmadi"); internet qaytgach ham o'zi tiklanmaydi | `src/App.tsx:143-149` (`prefetchChunks` ro'yxatida bu bo'limlar yo'q), `React.lazy` rad etilgan promise'ni keshlaydi. Admin · 1440 · lokal | Demo → 3 s kutish → DevTools Offline → "O'qituvchilar" → Online → yana "O'qituvchilar" | `screenshots/A-offline-teachers-after-online.png`, `tests/offline.mjs` | Medium | Rolga ochiq barcha bo'lim chunk'larini bo'sh vaqtda oldindan yuklash (yoki service worker); `online` hodisasida xato chegarasini va lazy loader'ni qayta tiklash |
| **A-05** | Harf va raqam aralash qidiruv ("Python 1", "IELTS 2") raqam bo'yicha **har qanday telefonni** moslaydi | `src/utils/customers.ts:17-27` (`digits.length > 0` — bitta raqam yetarli). Barcha rollar · lokal | Demo → Mijozlar → qidiruv "Python 1" | `tests/modules.mjs`: 476 tadan **250** natija | Low | Telefon bo'yicha moslashni faqat so'rov asosan raqamlardan iborat bo'lsa (masalan, harf yo'q va ≥ 3 raqam) qo'llash |
| **A-06** | Mijoz ismiga **uzunlik chegarasi yo'q** — 300 belgilik ism saqlandi (guruh nomi 2–80 bilan cheklangan) | `src/utils/customers.ts:87`. Admin/menejer · lokal | Yangi mijoz → Ism: 300 ta "A" → Qo'shish | `tests/modules.mjs` (`customer_300chars.saved: true`) | Low | 2–100 belgi chegarasi (forma + import + bulut `check`) |
| **A-07** | CSV eksportda telefon raqamlari `'+998 33 …` ko'rinishida (apostrof bilan) chiqadi — Excel/Sheets'da apostrof ko'rinadi, SMS xizmatlariga yuklashda raqam buziladi | `src/services/export.service.ts:15-19` (`+` formula belgisi deb hisoblanadi) | Header → Hisobot yuklash → Mijozlar — CSV | `tests/modules.mjs` (`export_file.head`) | Low | Telefon ustunini raqam formatida (`+` siz yoki `998…`) yozish yoki faqat haqiqiy formula (`+` dan keyin raqam/bo'shliq bo'lmasa) ekranlash |
| **A-08** | Forma **qoralamasi xodimga bog'lanmagan**: bir brauzerda admin yozgan "Yangi mijoz" qoralamasi menejerga ochiladi (shaxsiy ma'lumot) | `src/hooks/useFormDraft.ts:22` (`apex:draft:${name}`). Admin → menejer · lokal/demo | Admin: Yangi mijoz → ism yozish → yopish → rolni Menejerga almashtirish → Yangi mijoz | `tests/dataloss.mjs` (`draftLeaksToOtherStaff: "Draft Person"`) | Low | Kalitga foydalanuvchi id'sini qo'shish; chiqishda/rol almashganda qoralamalarni tozalash |
| **A-09** | Sahifa yangilanganda joriy bo'lim va filtrlar yo'qoladi — har doim "Umumiy ko'rinish" ochiladi | `DashboardContext.tsx:164` (bo'lim faqat state'da) | Istalgan bo'lim → F5 | `tests/dataloss.mjs` (`afterReload.section`) | Low | Bo'limni URL'da (`/app#finance` yoki `?s=`) saqlash; ruxsat tekshiruvi bilan |

### Eski topilmalar — brauzerda qayta tasdiqlandi (to'liq jadval pastda)

QA-01, QA-02, QA-03, QA-05, QA-06, QA-07, QA-08, QA-09, QA-10, QA-11 (CLS), QA-12, QA-14, QA-15 (qisman), QA-16 (qisman), QA-17, QA-18, QA-19, QA-20, QA-22, QA-23, QA-04 (mazmunan).

---

## B. Kod auditida tasdiqlangan xatolar

| ID | Muammo | Joyi | Takrorlash | Dalil | Muhimlik | Tavsiya |
|---|---|---|---|---|---|---|
| **B-01** | **Audit jurnalini soxtalashtirish (kross-tenant):** `write_audit(p_org, …)` SECURITY DEFINER, `p_org` joriy tashkilotga tegishliligini tekshirmaydi va `EXECUTE` `anon`/`authenticated` dan olib tashlanmagan. Istalgan foydalanuvchi — hatto `anon` kalit bilan — org UUID'ini bilsa, boshqa markaz jurnaliga ixtiyoriy yozuv qo'sha oladi (PostgREST `POST /rest/v1/rpc/write_audit`) | `supabase/migrations/20261108000000_online_payments.sql:56` (oxirgi ta'rif), `20261106000001_init.sql:156`; `revoke` yo'q | `tests/sql/qa_rls_attack.sql` 2-bo'lim: B admin, tashkilotsiz foydalanuvchi va `anon` `select public.write_audit('<A org>', 'payment.delete', 'FORGED…', null)` | `tests/sql/qa_rls_attack.result.txt`: 3 ta FAIL, A administratori 3 ta soxta yozuvni ko'radi | **High** (xavfsizlik, jurnal yaxlitligi) | `revoke execute on function public.write_audit(...) from public, anon, authenticated;` (faqat ichki chaqiruvlar). Barcha trigger va ichki SECURITY DEFINER funksiyalardan ham (`audit_row`, `outbox_*`, `guard_soft_delete`, …) `public`/`anon` EXECUTE'ni olib tashlash; regressiya: RLS testiga qo'shish |
| **B-02** | **Payme/Click to'lovi summasini API orqali o'zgartirish mumkin:** UI'da summa `readOnly`, lekin serverda `amount`/`provider`/`date`/`customer_id` ni himoya qiluvchi trigger yo'q. `payments.manage` (kassir, admin) to'lovni `amount = 1, provider = null` qila oladi | `20261108000003_branches.sql:166` (`transactions_update`), `init.sql:215` (`guard_soft_delete` — faqat `deleted_at`/`organization_id`) | `qa_rls_attack.sql` 7-bo'lim (kassir sifatida `update transactions set amount = 1, provider = null where id = 'tp'`) | natija: `FAIL (amount=1, provider=NULL)` | Medium (ichki firibgarlik, hisob-kitob buziladi) | `BEFORE UPDATE` trigger: `old.provider is not null` bo'lsa `amount`, `provider`, `date`, `customer_id`, `type` o'zgarishini rad etish (service_role'dan tashqari) |
| **B-03** | **Filialga cheklangan xodim mijozni boshqa filialga ko'chira oladi:** `customers_update` `WITH CHECK` da `branch_allowed(branch_id)` yo'q; `customer_visible()` o'quvchining o'z filialidagi guruhi orqali `true` qaytaradi | `20261108000003_branches.sql:147-150` | `qa_rls_attack.sql` 4-bo'lim (b1 menejeri `update customers set branch_id = 'b2' where id = 'c1'`) | `FAIL (moved to b2)` | Medium | `WITH CHECK` ga `and public.branch_allowed(branch_id)` qo'shish; xuddi shunday `groups`/`transactions` uchun ko'rib chiqish |
| **B-04** | **Cloud sync — "lost update":** o'zgargan yozuv butun qatori bilan `upsert` qilinadi, `updated_at` bo'yicha versiya tekshiruvi yo'q; ikki xodim bir yozuvni 90 s yangilanish oralig'ida tahrirlasa, birining o'zgarishi jim yo'qoladi | `src/data/supabase.ts:354-380`, `DashboardContext.tsx:114,215-245` | Kod tahlili (bulutli brauzer sinovi imkonsiz — Docker yo'q) | — | Medium | Optimistik qulf: `update … where updated_at = <oldingi>`; 0 qator bo'lsa — konflikt xabari va serverdagi holatni olib kelish; yoki faqat o'zgargan maydonlarni yuborish |
| **B-05** | Eski "Sababli" (`excused`) davomat yozuvi UI va foizda "Kelmadi" deb hisoblanadi, lekin ketma-ket qoldirishlar sanog'ida ketma-ketlikni **uzadi** (ogohlantirish kechikadi) | `src/utils/attendance.ts:73-80` (`r.status !== 'absent'`) vs `:11-13` (`simpleStatus`) | Kod tahlili | — | Low | `simpleStatus(r.status) !== 'absent'` ishlatish |
| **B-06** | Guruhsiz ("eskicha") mijozlarda qarz oyning **1-kunidan** to'liq summa bo'lib chiqadi — `paymentDueDay` hisobga olinmaydi; o'tgan oylar qarzi esa umuman hisoblanmaydi | `src/utils/debts.ts:237-263` | Kod tahlili | — | Low | Eskicha hisobni ham to'lov muddatiga bog'lash yoki UI'da "guruhga yozing" ogohlantirishi |

---

## C. Tekshirilmagan ehtimoliy muammolar

| ID | Mavzu | Nega tekshirilmadi / xavf | Tavsiya |
|---|---|---|---|
| C-01 | Bulutli rejim brauzerda (Supabase Auth, ko'p qurilma, offline → online sinxronizatsiya, takroriy yozuv) | Docker daemon yo'q → `supabase start` imkonsiz; production'ga ulanish taqiqlangan | Docker'li muhitda `supabase start` + 2 brauzer profili bilan e2e |
| C-02 | Payme / Click / Eskiz SMS / Telegram bot real oqimlari, Edge Functions (`supabase/functions/*`) | Test akkauntlar yo'q; Edge Function kodi chuqur audit qilinmadi | Sandbox kassalar bilan; `deno check` va funksiya testlari |
| C-03 | `enrollmentId`siz kirim (Payme/Click, import) o'quvchining `course` maydoni guruh kursi nomiga teng bo'lmasa hech bir o'qishga bog'lanmaydi → qarz kamaymaydi | `src/utils/attribution.ts:29-35`; demo'da barcha to'lovlarda `enrollmentId` bor, holat qayta yaratilmadi | `pay_tx_perform` `enrollment_id` yozishini tekshirish; zaxira qoida: o'quvchining yagona faol o'qishi |
| C-04 | Lokal rejimda rollar faqat brauzerda (DevTools orqali admin bo'lish mumkin) | README:590 da hujjatlashtirilgan — xato emas | Ko'p xodimli markazga bulutli rejimni tavsiya qiluvchi ogohlantirish |
| C-05 | Katta hajm (5–10 ming mijoz) va `localStorage` ~5 MB chegarasi | Demo allaqachon ~0.7 MB (transactions 354 KB, attendance 188 KB) | 10k mijozli generator bilan tezlik va to'lish sinovi |
| C-06 | Haqiqiy iPhone Safari / arzon Android, NVDA/VoiceOver, termoprinter | Faqat Chromium emulyatsiyasi | Qo'lda sinov |
| C-07 | `/owner` Supabase (platform_admins) bilan kirish | Bulut yo'q | Bulutli muhitda |

---

## QA-01 … QA-23 holati (docs/QA-PROMPT.md)

| QA | Holat | Dalil / izoh |
|---|---|---|
| QA-01 | **Hali mavjud** | Forma: `8 93 111 22 33` → `+998 89 311 12 23`, `0931112233` → `+998 09 311 12 23`, `8-90-123-45-67` → `+998 89 012 34 56`; `phone.ts` o'zgarmagan; import esa bularni rad etadi (`tests/qa-retest.mjs`, `tests/import-edge.mjs`) |
| QA-02 | **Hali mavjud** | `Gʻulom Qoʻchqorov`: `G'ulom`, `G‘ulom`, `qo'chqorov`, `gulom` → topilmadi; faqat `Gʻulom` topadi |
| QA-03 | **Hali mavjud** | Mijozsiz "Kurs to'lovi" 650 000 saqlandi (`customerId: null`) |
| QA-04 | **Qisman tuzatilgan / mazmunan mavjud** | `VITE_LEGAL_*` qo'shilgan, jonli `/privacy`, `/terms` da `[...]` yo'q; lekin rekvizitlar o'rnida "sayt egasi (rekvizitlar so'rov bo'yicha beriladi)" va ommaga "Bu hujjat namuna… kvadrat qavs ichidagi ma'lumotlarni to'ldiring" banneri (`screenshots/live-privacy.png`) |
| QA-05 | **Hali mavjud** | Usta 1-qadam: Telefon `+998 71 200 00 00`, Manzil `Toshkent sh., Chilonzor tumani` — haqiqiy qiymat sifatida saqlanadi (`screenshots/qa05-wizard-step1.png`) |
| QA-06 | **Hali mavjud** | Combobox: `885086077` → 0, `+998885086077` → 0, `88 508` → 1 (`screenshots/qa06-combobox-digits.png`) |
| QA-07 | **Hali mavjud** | Bo'sh forma — 2 xato; qisqa parol + mos kelmagan takror — faqat "Parollar mos kelmadi" (`screenshots/qa07-short.png`) |
| QA-08 | **Hali mavjud** | "Boshlash uchun 5 qadam": kurs → mijoz → to'lov → xodim → zaxira |
| QA-09 | **Hali mavjud** | O'qituvchi (Nodira Saidova): "O'quvchilar **72**", bugungi darslarda 5 + 9; "Shu yil" bosilganda sahifa o'zgarmaydi (`TodayLessons.tsx:71`) |
| QA-10 | **Hali mavjud** | 390×844: "Saqlash" y = 921 px (ekrandan tashqarida); `.modal-actions` sticky emas (`screenshots/qa10-mobile-payment-modal.png`) |
| QA-11 | **Qisman** | Lighthouse mobil `/app?demo=1`: Perf 58 → **70** (lokal) / **73** (jonli), TBT 420 → **140 ms** ✅; CLS **0.601** (lokal) / **0.973** (jonli) ❌ — manba `.tour-spot` |
| QA-12 | **Hali mavjud** | 390 px: Boshqaruv — "Savatcha", "Seanslar", "Rollar va ruxsatlar" ekrandan tashqarida; Sozlamalar — 12 tadan 10 tasi (`screenshots/qa12-*.png`) |
| QA-13 | **Hali mavjud** (kod bo'yicha) | `_shared/telegram.ts:63` `To'lash: ${link}` (xom URL, inline tugma yo'q), `:97-98` `не пришёл(ла)` / `не был(а)`; bot runtime — Tekshirilmadi |
| QA-14 | **Hali mavjud** | Xodimlar jadvali: XODIM, ROL, HOLAT, OXIRGI KIRISH, AMALLAR — filial yo'q |
| QA-15 | **Qisman** | Jonli Pages: noma'lum URL **404** status ✅, lekin kontent — landing (h1 "O'quv markazingizni…"); lokal/Vercel preview — 200 |
| QA-16 | **Qisman** | Landing RU matni ✅; skrinshotlar o'zbekcha UI (`/landing/*.jpg` bitta to'plam); `/privacy` RU'da `document.title` o'zbekcha ("Maxfiylik siyosati · EduFlow CRM"). Narx kartalaridagi takror — qayta tekshirilmadi |
| QA-17 | **Hali mavjud** | 390 px: "?" tugmalari 18×18, saralash tugmalari 17 px, filial tanlovi 25 px; moliya bo'limida 26 ta < 24 px nishon |
| QA-18 | **Hali mavjud** | 3-qadam "Rol": "Menejeı" kesilgan (`screenshots/qa18-wizard-step3.png`) |
| QA-19 | **Hali mavjud** | O'qituvchiga guruh kartasida "Oylik narx 650 000 so'm"; Davomat'da segment + "Dars" select; filial tanlovi ko'rinadi |
| QA-20 | **Hali mavjud** | Profil: `aria-label="Profil: Dilshod Rahimov"`, ko'rinadigan matn "DR Dilshod Rahimov Administrator"; har qatordagi chek tugmasi bir xil "Chek" |
| QA-21 | **Hali mavjud** (kod bo'yicha) | `Receipt.tsx:88` `data.cashier \|\| '—'`; "Qarz yo'q" qatori yo'q (`:83`). Demo'da onlayn to'lov yo'qligi sababli brauzerda ko'rsatilmadi |
| QA-22 | **Hali mavjud** | To'lov oynasida "Status" maydoni bor |
| QA-23 | **Hali mavjud** | Jonli `/owner` RU: "Sotuvchi paneli", "bepul 14 kun", "To'lovli" o'zbekcha (`OwnerConsole.tsx` da `tr()` 0 ta); `src/owner/tenants.ts:60` "IT Park Kids" (`screenshots/live-owner-ru.png`) |

---

## Muammosiz deb tasdiqlangan joylar

- **Rollar:** 5 rol × 11 bo'lim × 3 o'lcham — menyu, tugmalar, "Qo'shish" menyusi, "N" tezkor tugmasi, kassa balansi ko'rinishi `permissions.ts` jadvaliga to'liq mos; o'qituvchiga telefon ko'rinmaydi; amallar `DashboardContext.allowed()` bilan ikkinchi qatlamda ham himoyalangan.
- **Hisob-kitoblar (demo ma'lumotida mustaqil qayta hisob):** kassa balansi 190 305 000, shu oy kirim 31 726 000 / chiqim 26 091 000 / sof 5 635 000, faol o'quvchilar 54, qarzdorlar 7 ta / 9 020 000 — UI bilan aynan mos. Davomat foizi formulasi to'g'ri.
- **Ma'lumot saqlanishi:** refresh, rol almashish, ikki tab bir vaqtda yozish, offline'da yozish — yo'qotish yo'q.
- **Xavfsizlik:** markaz nomi, mijoz ismi va import orqali `<img onerror>` — bajarilmadi; CSV/Excel formula injection ekranlanadi; xom HTML sink yo'q; RLS: boshqa markaz ma'lumotini o'qish/yozish, o'qituvchi/kassir/filial cheklovlari, `integration_secrets` yopiq, `teacher_roster`/`teacher_directory` niqoblangan, rolni oshirish rad etiladi.
- **Konsol/network:** 15 rol×o'lcham kombinatsiyasida 0 xato.
- **Responsive:** 1440/768/390 da sahifa gorizontal siljishi yo'q.
- **Accessibility:** axe-core (WCAG 2.0/2.1 A/AA) — 12 sahifa × light/dark = **0 buzilish**; klaviatura bilan fokus ko'rinadi (qidiruv va filial tanlovi — o'rovchi elementda).
- **Tezlik:** landing Lighthouse mobil — lokal 98, jonli 100; demo rejimda `supabase` chunk yuklanmaydi.

---

## Qisqa xulosa

**Eng muhim 5 ta muammo**

1. **B-01 (High, xavfsizlik)** — `write_audit` orqali istalgan (hatto anonim) foydalanuvchi boshqa markaz amallar jurnaliga soxta yozuv qo'sha oladi.
2. **A-01 (High, pul)** — guruhdan ko'chirilgan o'quvchida soxta qarz → noto'g'ri eslatma/SMS ota-onaga.
3. **QA-01 + QA-02 (High, eski)** — telefon raqami jim buziladi va apostrofli ismlar topilmaydi → takroriy mijozlar, begonaga SMS.
4. **B-02 / QA-03 (Medium–High, pul)** — Payme to'lovini API orqali o'zgartirish mumkin; mijozsiz "kurs to'lovi" hech kimning qarzini yopmaydi.
5. **A-02 / A-03 / A-04 (Medium)** — menejer kiritgan ma'lumot yo'qoladi; kuzatuvchi/kassir oynasida klaviatura tuzog'i; offline'da 4 bo'lim ishlamaydi.

**Qamrab olinmagan joylar:** bulutli rejim brauzerda (Supabase Auth/Realtime/ko'p qurilma), Payme/Click/SMS/Telegram real oqimlari va Edge Functions, haqiqiy mobil qurilmalar va ekran o'quvchilar, katta hajm, onboarding'dan keyingi filiallar/integratsiya sozlamalari formalarining chuqur validatsiyasi (batafsil — `REMAINING.md`).

---

## 7. Tuzatish prompti (nusxalab Claude Code'ga bering)

```text
Sen EduFlow CRM (React 19 + TypeScript + Vite; Supabase: PostgreSQL migratsiyalari + Edge Functions/Deno) loyihasida ishlayapsan.
Vazifa: qa-reports/REPORT.md (qa-audit branch) dagi A va B guruhidagi barcha muammolarni hamda "Hali mavjud"/"Qisman"
QA-01…QA-23 topilmalarini tuzatish. Avval REPORT.md ni va docs/QA-PROMPT.md ni to'liq o'qi.

UMUMIY QOIDALAR
- main'dan yangi branch och (masalan fix/qa-audit-2026-11-18). main'ga to'g'ridan-to'g'ri push, force-push, merge, branch o'chirish,
  production bazaga ulanish — taqiqlangan. PR faqat egasi so'rasa.
- Har topilma: avval muammoni takrorlaydigan test (Vitest unit / @testing-library / Playwright e2e / SQL RLS), keyin tuzatish.
  Qabul mezoni bajarilmaguncha "tuzatildi" dema. Har guruh — alohida commit: "fix(qa): A-01 ko'chirishda ikki baravar qarz".
- Fayl:qator 2026-11-18 (d62889e) holatiga; kod o'zgargan bo'lsa joyni qidirib top.
- Yangi matnlar tr('...') ichida va src/i18n/ru.ts da tarjimasi bilan.
- Mavjud ma'lumot formati, eski zaxira fayllari va bulut sxemasi bilan moslik buzilmasin (migratsiya — yangi fayl, eski fayllar o'zgarmaydi).
- Har commit oldidan: npm run check && npm run e2e; supabase/ o'zgarsa: PGHOST=… bash supabase/tests/run-local.sh va
  deno check --no-lock --node-modules-dir=none supabase/functions/*/index.ts.

TARTIB (muhimlik bo'yicha)

1. B-01 [High] write_audit kross-tenant yozish.
   Fix: yangi migratsiya: revoke execute on function public.write_audit(uuid,text,text,text) from public, anon, authenticated;
   shuningdek ichki/trigger SECURITY DEFINER funksiyalardan (audit_row, audit_attendance, audit_branch, audit_lesson_exception,
   outbox_attendance, outbox_payment, guard_soft_delete, transactions_fill_branch, enforce_staff_limit) public/anon EXECUTE ni olib tashla;
   anon'ga kerak bo'lmagan RPC'lardan (log_event, import_backup, trash_*, update_staff, update_own_profile, owner_*, touch_login,
   password_changed, create_organization) anon EXECUTE ni olib tashla.
   Qabul: supabase/tests/rls_test.sql ga test — B admin, tashkilotsiz foydalanuvchi va anon write_audit(<A org>) chaqirsa xato,
   A audit_log da yozuv yo'q; log_event va triggerlar orqali jurnal avvalgidek yoziladi.

2. A-01 [High] Guruhdan ko'chirishda soxta qarz.
   Fix: src/utils/debts.ts monthExpected — tugagan o'qishning oxirgi qisman oyi va ko'chirish natijasida ochilgan o'qishning birinchi oyi
   kunlar ulushida (prorateFirstMonth'dan qat'i nazar, faqat ko'chirish holatida — Enrollment'ga transferredFrom yoki shunga o'xshash
   belgi qo'shish mumkin; yoki eski o'qish avansini yangisiga o'tkazish). rowFor.monthly — faqat faol o'qishlar.
   Qabul: unit test — 650 000 to'lagan o'quvchi 12-noyabrda boshqa guruhga (shu narx) ko'chirilsa qarz 0, oylik 650 000;
   narx farq qilsa — kunlar ulushidagi farq; e2e: tests/transfer.mjs ssenariysi (Qarzdorlar soni o'zgarmaydi).

3. QA-01 [High] telefon normalizatsiyasi va QA-02 [High] apostrofli qidiruv — docs/QA-PROMPT.md dagi taklif va qabul mezonlari bo'yicha;
   import (normalizePhone) va forma bir xil qoida. A-05 shu yerda: matnli so'rovda telefon raqami bo'yicha moslash faqat so'rov
   asosan raqam bo'lsa ("Python 1" → faqat nomi mos keladiganlar). QA-06: Combobox mijozlar uchun raqamlar bo'yicha qidiradi.

4. B-02 [Medium] Provayder to'lovini o'zgartirish.
   Fix: BEFORE UPDATE trigger transactions: old.provider is not null va so'rov service_role emas bo'lsa — amount, provider, type,
   date, customer_id o'zgarishi rad etiladi (izoh/period/enrollment o'zgartirish mumkin).
   Qabul: rls_test.sql — kassir amount=1 qila olmaydi; Edge Function (service_role) bekor qilishni yozadi.

5. QA-03 [High eski] mijozsiz "Kurs to'lovi" — QA-PROMPT bo'yicha (mijoz majburiy yoki tasdiq).

6. B-03 [Medium] customers_update WITH CHECK ga public.branch_allowed(branch_id). Qabul: filial menejeri branch_id ni boshqa filialga
   o'zgartira olmaydi; o'z filialidagi tahrirlash ishlaydi (rls_test.sql).

7. A-02 [Medium] TransactionFormModal: payments.manage bo'lmasa "Chiqim" segmenti yashirin; addTransaction/updateTransaction boolean
   qaytaradi, false bo'lsa oyna yopilmaydi va qoralama o'chmaydi. Qabul: UI test — menejerda "Chiqim" yo'q; rad etilganda forma saqlanadi.

8. A-03 [Medium] Modal fokus: FOCUSABLE va firstField selektorlari :not([disabled]); focus() dan keyin activeElement oyna ichida
   bo'lmasa — dialogga. Qabul: Modal.test.tsx — birinchi maydon disabled bo'lsa fokus oyna ichida, Escape yopadi; e2e — kuzatuvchi
   mijoz kartasini Escape bilan yopadi.

9. A-04 [Medium] Offline: rolga ochiq barcha bo'lim chunk'larini prefetch (App.tsx prefetchChunks), online hodisasida lazy
   bo'limni qayta yuklash (ErrorBoundary reset). Qabul: Playwright — yuklangach offline, 11 bo'limning hammasi ochiladi;
   offline'da xato bo'lgan bo'lim online'dan keyin "Qayta yuklash"siz ochiladi.

10. B-04 [Medium] Cloud sync optimistik qulf (updated_at). Qabul: unit test (soxta supabase client) — eski updated_at bilan yozish
    konflikt beradi, foydalanuvchiga xabar, server holati olinadi; mavjud sync testlari yashil.

11. Qolgan eski topilmalar (QA-PROMPT'dagi qabul mezonlari bilan): QA-05, QA-07, QA-08, QA-09, QA-10, QA-11 (CLS < 0.1 —
    .tour-spot transform/clip-path), QA-12, QA-13, QA-14, QA-15 (Pages 404 sahifasi kontenti + Vercel/vite preview), QA-16
    (RU skrinshotlar, RU sarlavha), QA-17, QA-18, QA-19 (narx — egasi qarori), QA-20, QA-21, QA-22, QA-23, QA-04
    (rekvizitlar — egasidan; ommaviy "namuna" bannerini prod'da yashirish, VITE_LEGAL_* bo'sh bo'lsa build ogohlantirishi).

12. Past: A-06 (ism 2–100 belgi; import va bulut check bilan), A-07 (CSV telefon apostrofsiz), A-08 (qoralama kaliti user id bilan,
    chiqishda tozalash), A-09 (bo'lim URL'da), B-05 (trailingAbsences simpleStatus bilan), B-06 (eskicha qarz to'lov muddatiga bog'liq).

REGRESSIYA TESTLARI (qo'shilishi shart)
- supabase/tests/rls_test.sql: write_audit kross-tenant (B-01), provayder to'lovi (B-02), filial ko'chirish (B-03).
  Tayyor namunalar: qa-reports/tests/sql/qa_rls_attack.sql.
- src/utils/debts.test.ts: ko'chirish oyi (A-01), eskicha qarz muddati (B-06).
- src/utils/phone.test.ts, src/utils/search.test.ts (QA-01, QA-02, A-05, QA-06).
- src/components/ui/Modal.test.tsx (A-03); TransactionFormModal.test.tsx (A-02, QA-03, QA-22).
- e2e: ko'chirish → qarzdorlar soni o'zgarmaydi; offline → barcha bo'limlar; kuzatuvchi Escape; 390×844 va 390×480 da "Saqlash"
  ko'rinadi (QA-10); 390 px da tab/sozlama havolalari ko'rinadi (QA-12).

YAKUNDA: jadval — ID → tuzatildi / qisman / qoldirildi (+ sabab), qo'shilgan testlar, npm run check, e2e va RLS natijalari.
```
