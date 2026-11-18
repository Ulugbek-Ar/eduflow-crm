# QA hisoboti va tuzatish prompti — EduFlow CRM 1.2.0

> **Sana:** 2026-11-09 · **Branch:** `claude/stoic-planck-6dmx0c` · **Holat:** kamchiliklar faqat yozib qo'yildi, kod **hali tuzatilmagan**.
>
> **Qanday ishlatiladi:** keyinroq tuzatishni boshlaganda pastdagi [PROMPT](#prompt-nusxalab-claude-codega-bering) bo'limini
> to'liq nusxalab Claude Code'ga bering (yoki shunchaki: *"docs/QA-PROMPT.md dagi topilmalarni tuzat"* deb yozing).
> Har bir topilmada: kim duch keladi, qayerda (fayl:qator), qanday takrorlanadi, nima kutiladi, taklif va qabul mezoni bor.

## Qisqa xulosa

Sayt undan foydalanadigan **har bir odam** nomidan sinaldi: mehmon, yangi markaz egasi, administrator, menejer,
kassir, kuzatuvchi, o'qituvchi, filialga cheklangan xodim, ota-ona (Telegram bot) va mahsulot egasi.

- **Bloklovchi xato yo'q:** hech bir rolda ma'lumot yo'qolishi, ruxsatsiz ko'rish yoki sahifa qulashi topilmadi; konsolda xato yo'q.
- **Yuqori — 5 ta** (sotuvdan oldin tuzatish kerak): telefon raqami jim buziladi, qidiruv `G'ulom`/`Gʻulom` ni topmaydi,
  mijozsiz "kurs to'lovi" qarzni kamaytirmaydi, huquqiy sahifalarda to'ldirilmagan `[...]` joylar ochiq turibdi,
  sozlash ustasi namunaviy telefon/manzilni haqiqiy qiymat qilib qoldiradi.
- **O'rta — 9 ta**, **past — 9 ta** (UX, telefon ko'rinishi, tezlik, bot matnlari, mayda dizayn).

| Jiddiylik | ID |
|---|---|
| 🔴 Yuqori | QA-01 … QA-05 |
| 🟠 O'rta | QA-06 … QA-14 |
| 🟡 Past | QA-15 … QA-23 |

## Qamrov: kim sifatida nima sinaldi

| Kim | Nima qilindi | Natija |
|---|---|---|
| **Mehmon** (sotib olishni o'ylayotgan markaz) | Landing, narxlar, ariza oynasi, `/privacy`, `/terms`, noma'lum URL; 390 / 768 / 1440 px, uz / ru, yorug' / qorong'i | QA-04, QA-15, QA-16, QA-17 |
| **Yangi markaz egasi** | Ro'yxatdan o'tish (xato holatlar), sozlash ustasi (4 qadam), mahsulot turi, bo'sh bo'limlar, birinchi kurs/guruh/mijoz/to'lov | QA-05, QA-07, QA-08, QA-18 |
| **Administrator / direktor** | 11 bo'limning hammasi, mijoz kartasi, kanban, guruh, o'quvchini guruhga yozish, davomat, to'lov, chek, xarajat, import, filiallar, sozlamalar, boshqaruv | QA-01, QA-02, QA-03, QA-06, QA-11, QA-12, QA-14, QA-20, QA-21 |
| **Menejer, Kassir / Buxgalter, Kuzatuvchi** | Har rol bilan barcha ochiq bo'limlar; tugmalar ruxsatlar jadvaliga mosligi | Ruxsatlar to'g'ri; kassirga: QA-03, QA-06, QA-10, QA-22 |
| **O'qituvchi** | Bugun, Guruhlarim, Mening jadvalim, Davomat; telefon va moliya ko'rinmasligi | QA-09, QA-19 |
| **Filialga cheklangan xodim** | Faqat o'z filiali, Header'da filial nomi, Filiallar bo'limi yopiq | Muammo yo'q |
| **Ota-ona** (Telegram bot) | `/start`, kontakt yuborish (o'ziniki / begona), qarz, davomat, jadval, til, `/stop`, navbatdagi xabarlar (kelmadi, to'lov) | QA-13 |
| **Mahsulot egasi** (`/owner`) | Markazlar ro'yxati, sinov muddati, uz / ru | QA-23 |
| **Chekka holatlar** | Juda uzun ism/markaz nomi, kirill ism, `oʻ/gʻ` apostroflar, telefon formatlari, chop etish, Lighthouse, kontrast | QA-01, QA-02, QA-11 |

**Qanday sinaldi:** prod build (`npm run build` → `npx vite preview`) ustida Playwright (Chromium) skriptlari; demo rejim
(`/app?demo=1`, yuqoridagi "Rol sifatida ko'rish" tanlovi) va lokal rejimda noldan ochilgan markaz; har sahifada avtomatik
tekshiruv: gorizontal siljish, ekrandan chiqqan elementlar, nomsiz tugmalar, `alt`siz rasmlar, telefonda kichik bosish
nishonlari, ruscha rejimda tarjima qilinmagan matn, konsol xatolari, WCAG AA kontrast. Bot mantiqi lokal simulyatsiyada
(soxta Telegram API va ma'lumotlar bazasi bilan) sinaldi.

---

## 🔴 Yuqori

### QA-01. Telefon raqami "8" yoki "0" bilan yozilsa — jim buziladi

- **Kim duch keladi:** administrator, menejer, kassir (mijoz/o'qituvchi qo'shish), mehmon (landing ariza), markaz egasi (sozlamalar).
- **Qayerda:** `src/utils/phone.ts:5-9` (`phoneDigits` faqat `998` ni olib tashlaydi, keyin birinchi 9 raqamni oladi).
  Foydalanadi: `CustomerFormModal`, `TeacherFormModal`, `SetupWizard`, `SettingsPanel`, `BranchSettings`, `SmsSettings`,
  `src/landing/apply.ts`, `src/utils/paymentLinks.ts` (Payme/Click havolasidagi `ac.phone`).
- **Takrorlash:** Mijozlar → Yangi mijoz → Telefon: `8 93 111 22 33`.

  | Kiritildi | Hozir saqlanadi | Kutilgan |
  |---|---|---|
  | `8 93 111 22 33` | `+998 89 311 12 23` ❌ (`isValidPhone` = true, xato chiqmaydi) | `+998 93 111 22 33` |
  | `0931112233` | `+998 09 311 12 23` ❌ | `+998 93 111 22 33` |
  | `8-90-123-45-67` | `+998 89 012 34 56` ❌ | `+998 90 123 45 67` |
  | `93 111 22 33`, `998931112233`, `+998 (93) 111-22-33` | to'g'ri ✅ | — |

- **Oqibat:** boshqa odamning raqami saqlanadi → SMS va eslatma begonaga ketadi, ota-ona botga ulana olmaydi,
  takroriy mijozni aniqlash ishlamaydi, Payme/Click havolasida noto'g'ri raqam.
- **Taklif:** `phoneDigits`: 12 raqam va `998` bilan boshlansa → oxirgi 9; 10 raqam va `8` yoki `0` bilan boshlansa → birinchisini
  tashlash; aks holda 9 dan uzun raqamni **kesmasdan** noto'g'ri deb qaytarish (`isValidPhone` false bo'lsin, forma xato ko'rsatsin).
  Import (`src/utils/import/customers.ts:100-107`, `normalizePhone`) hozir 10 raqamli `8…`/`0…` raqamlarni rad etadi — shu
  qoidaga moslashtirish. Mavjud ma'lumotni o'zgartirmaslik (faqat yangi kiritishga ta'sir qiladi).
- **Qabul mezoni:** `src/utils/phone.test.ts` da yuqoridagi jadvaldagi barcha holatlar; mijoz formasida `8 93 111 22 33` →
  `+998 93 111 22 33`; 11+ raqamli tushunarsiz qiymat → "Telefon +998 XX XXX XX XX ko'rinishida" xatosi.

### QA-02. Qidiruv o'zbekcha apostrof variantlarini tenglashtirmaydi

- **Kim duch keladi:** har kuni qidiradigan barcha xodimlar (administrator, menejer, kassir).
- **Qayerda:** `src/utils/customers.ts:17-27` (`matchesCustomer`), `src/utils/search.ts:24-29` (Header qidiruvi — kurs va to'lovlar),
  `src/components/ui/Combobox.tsx:35-37`, `src/utils/transactions.ts:45`, hamda `GroupsPanel`, `TeachersPanel`, `CoursesPanel`
  ichidagi `toLowerCase().includes(...)`.
- **Takrorlash:** mijoz `Gʻulom Qoʻchqorov` (`ʻ` U+02BB — Excel importi va o'zbek klaviaturasi shunday yozadi). Qidiruvda:
  `G'ulom` (oddiy apostrof) → 0 natija; `G‘ulom` (U+2018) → 0; `qo'chqorov` → 0; `gulom` (apostrofsiz) → 0.
  Faqat aynan `Gʻulom` topiladi.
- **Oqibat:** xodim o'quvchini "yo'q" deb o'ylaydi va takroriy mijoz yaratadi; to'lov boshqa kartaga yoziladi.
- **Taklif:** `src/utils/search.ts` da bitta `normalizeSearch(text)`: kichik harf, apostrof turlarini (`ʻ` `ʼ` `'` `‘` `’` `ʹ` va teskari apostrof U+0060) olib tashlash
  (shunda `gulom` = `gʻulom`), ortiqcha bo'sh joylarni siqish. Barcha qidiruvlarda ham so'rov, ham matnga qo'llash.
  Ixtiyoriy: kirill ↔ lotin (`Гулнора` ↔ `Gulnora`) moslashtirish.
- **Qabul mezoni:** unit test — yuqoridagi 4 so'rov `Gʻulom Qoʻchqorov` ni topadi; Header, mijozlar ro'yxati, Combobox,
  moliya filtri, guruh/o'qituvchi/kurs qidiruvi bir xil ishlaydi.

### QA-03. "Kurs to'lovi" mijozsiz saqlanadi — hech kimning qarzi kamaymaydi

- **Kim duch keladi:** kassir, administrator; oqibatini — ota-ona (to'lagan bo'lsa ham qarz eslatmasi oladi).
- **Qayerda:** `src/components/finance/TransactionFormModal.tsx:158-196` (validatsiyada mijoz tekshirilmaydi), maydon `:302-308`
  ("Mijoz — Ixtiyoriy", formada 6-o'rinda: Summa, Sana, Kategoriya, To'lov turi, Status, **Mijoz**, …).
- **Takrorlash:** Moliya va kassa → To'lov qabul qilish → Summa 650 000, Kategoriya "Kurs to'lovi", Mijoz bo'sh → Saqlash.
  Kirim yoziladi, lekin qarzdorlar ro'yxati o'zgarmaydi, chekda mijoz yo'q, avtomatik eslatma ota-onaga ketaveradi.
- **Taklif:** kirimda "Mijoz" maydonini birinchi qo'yish; kategoriya "Kurs to'lovi" bo'lsa mijozni majburiy qilish
  (yoki tasdiq: "Mijozsiz kirim hech kimning qarziga ta'sir qilmaydi. Davom etasizmi?"). Boshqa kirim kategoriyalari mijozsiz qolishi mumkin.
- **Qabul mezoni:** UI test — mijozsiz kurs to'lovi saqlanmaydi (yoki tasdiqsiz saqlanmaydi); mijoz tanlanganda qarz kamayadi.

### QA-04. Huquqiy sahifalarda to'ldirilmagan `[...]` joylar ochiq turibdi

- **Kim duch keladi:** mehmon (sotib olishdan oldin shartlarni o'qiydi), markaz egasi (ro'yxatdan o'tishda "rozilik bildirasiz").
- **Qayerda:** `src/landing/LegalPage.tsx` — `:30` `[Kompaniya nomi, STIR, manzil]`, `:55` `[server joylashuvi]`,
  `:70` `[email yoki telefon]`, `:87` `[Kompaniya nomi, STIR]`, `:101` `[to'lov usullari: Click, Payme, bank o'tkazmasi]`,
  `:116` `[ish vaqti va aloqa kanali]`, `:128` `[shartlar]`, `:136` `[Kompaniya nomi, manzil, telefon, email]`.
- **Oqibat:** shartnoma-oferta va maxfiylik siyosati yuridik kuchga ega emas; ishonchni pasaytiradi.
- **Taklif:** bu — **egasidan olinadigan ma'lumot** (kompaniya nomi, STIR, manzil, aloqa, server joylashuvi). Kod tomoni:
  brend kabi `VITE_COMPANY_*` muhit o'zgaruvchilari bilan berish (`src/constants/brand.ts` uslubida); berilmasa — build paytida
  ogohlantirish (`vite.config.ts`), saytda esa `[...]` ko'rinmasin. Matnni yurist tekshirsin. **Ma'lumotni o'zing to'qib chiqarma.**
- **Qabul mezoni:** prod build'da `/privacy` va `/terms` da `[` belgisi qolmaydi (test: `tests/` da tekshiruv).

### QA-05. Sozlash ustasi namunaviy telefon va manzilni haqiqiy qiymat qilib qoldiradi

- **Kim duch keladi:** yangi markaz egasi; oqibatini — ota-onalar (chek, eslatma, botda noto'g'ri telefon).
- **Qayerda:** `src/components/onboarding/SetupWizard.tsx:58-59` qiymatlarni `DEFAULT_SETTINGS` dan oladi:
  `src/constants/mockData.ts:22-29` — `phone: '+998 71 200 00 00'`, `address: 'Toshkent sh., Chilonzor tumani'`.
- **Takrorlash:** yangi markaz → ustaning 1-qadami: "Telefon" va "Manzil" maydonlari to'ldirilgan holda ochiladi
  (placeholder emas, haqiqiy qiymat). "Keyingi" bosilsa, shu raqam eslatma shablonidagi `{telefon}` ga, chekka va botga tushadi.
- **Taklif:** yangi (demo bo'lmagan) markaz uchun telefon/manzil bo'sh boshlansin, namunalar faqat `placeholder` da;
  ustada telefonni majburiy qilish (eslatmalar uchun kerak) yoki bo'sh qolsa Sozlamalar → Eslatmalarda ogohlantirish.
  Demo rejim namunaviy qiymatlarni saqlab qoladi.
- **Qabul mezoni:** `Onboarding.test.tsx` — yangi markazda telefon/manzil bo'sh; demo o'zgarmagan.

---

## 🟠 O'rta

### QA-06. Mijoz tanlash maydonida telefonni bo'sh joysiz yozsa — topilmaydi

- **Kim:** kassir (to'lov qabul qilishda "raqamingiz?" deb so'raydi), administrator (guruhga o'quvchi qo'shish).
- **Qayerda:** `src/components/ui/Combobox.tsx:37` `${label} ${description}` ichidan qidiradi; tavsifda telefon formatlangan
  (`+998 93 111 22 33`): `TransactionFormModal.tsx:201`, `GroupDetail.tsx:77`. Shuningdek moliya ro'yxati filtri telefon bo'yicha
  umuman qidirmaydi (`src/utils/transactions.ts:45` — faqat izoh va mijoz ismi).
- **Takrorlash:** To'lov qabul qilish → Mijoz: `931112233` → "topilmadi"; `93 111` yozilsa topiladi.
  (Mijozlar ro'yxati va Header qidiruvida raqamlar to'g'ri solishtiriladi — `matchesCustomer`.)
- **Taklif:** Combobox'ga ixtiyoriy `keywords`/`match` prop; mijozlar uchun raqamlarni (faqat `\d`) ham qo'shish;
  QA-02 dagi `normalizeSearch` bilan birga. Moliya filtrida mijoz telefoni bo'yicha ham qidirish.
- **Qabul mezoni:** `931112233`, `+998931112233`, `93 111 22 33` — barchasi Combobox'da topadi.

### QA-07. Ro'yxatdan o'tish formasi xatolarni bittalab ko'rsatadi

- **Kim:** yangi markaz egasi (lokal rejim).
- **Qayerda:** `src/components/auth/SetupAdminScreen.tsx:38-60` — mijoz tomonda faqat markaz nomi va parol takrori tekshiriladi;
  ism, login va parol uzunligi `setupAdmin()` ichida, faqat **birinchi** xato qaytadi.
- **Takrorlash:** bo'sh forma → faqat 2 ta xato (markaz nomi, parol takrori). Parol `qisqa` + takror `boshqa` → faqat
  "Parollar mos kelmadi"; "Kamida 8 ta belgi" xato sifatida chiqmaydi (kulrang izoh bo'lib qoladi), takrorni to'g'rilagandan
  keyingina chiqadi.
- **Taklif:** barcha maydonlarni bir yo'la tekshirish (ism ≥ 2, login qoidasi 3–32, parol ≥ 8, takror mosligi) —
  `setupAdmin` bilan bir xil qoidalar, umumiy funksiyadan; birinchi xatoli maydonga fokus. Bulutli forma (`CloudScreens.tsx:41-46`)
  allaqachon shunday ishlaydi — shunga moslash.
- **Qabul mezoni:** `AuthFlows.test.tsx` — bo'sh formada barcha majburiy maydonlarda xato; qisqa parol + mos kelmagan takror → ikkala xato.

### QA-08. "Boshlash qadamlari" ro'yxati eskirgan (guruh va o'qituvchisiz)

- **Kim:** yangi markaz egasi.
- **Qayerda:** `src/components/overview/GettingStarted.tsx:23-36` — qadamlar: kurs → mijoz → to'lov → xodim → zaxira.
- **Muammo:** 1.1 dan beri qarz **guruhga yozilish** orqali hisoblanadi, lekin ro'yxatda o'qituvchi, guruh, o'quvchini guruhga
  qo'shish, davomat yo'q; bulutli rejimda zaxira o'rniga integratsiyalar (Payme/Click, SMS, bot) muhimroq.
- **Taklif:** Kurs → O'qituvchi → Guruh → O'quvchini guruhga yozish → To'lov → Xodimlar → (lokal) zaxira / (bulut) Payme·SMS·bot;
  har qadam tugmasi tegishli oynani ochsin.
- **Qabul mezoni:** yangi markazda ro'yxat yangi tartibda; guruhga yozilish bo'lmaguncha "To'lov" qadami tavsiya qilinmaydi.

### QA-09. O'qituvchi "Bugun" sahifasi: o'quvchilar soni noto'g'ri, davr tanlovi ta'sirsiz

- **Kim:** o'qituvchi.
- **Qayerda:** `src/components/attendance/TodayLessons.tsx:70-71` — faol guruhlardagi **barcha** yozilishlar sanaladi
  (tugagan, to'xtatilgan ham).
- **Takrorlash:** demo → O'qituvchi (Nodira Saidova): "O'quvchilar **59**", bugungi ikki darsda esa 6 + 14 = **20** o'quvchi.
  Sahifa tepasidagi "Davr: Bugun / 7 kun / Shu oy / Shu yil" bosilganda kartalar o'zgarmaydi.
- **Taklif:** `e.status === 'active'` (va bugungi sanada amalda bo'lgan) yozilishlarni sanash; o'qituvchi sahifasida davr tanlovini
  yashirish (yoki kartalarni davrga bog'lash).
- **Qabul mezoni:** demo o'qituvchida o'quvchilar soni guruhlardagi faol o'quvchilar yig'indisiga teng; test qo'shilgan.

### QA-10. Telefonda to'lov oynasi: "Saqlash" ko'rinmaydi, maydonlar tartibi noqulay

- **Kim:** kassir va administrator telefondan ishlaganda.
- **Qayerda:** `src/index.css:2400-2453` — `.modal { max-height: calc(100vh - 32px); overflow-y: auto }`, `.modal-actions` sticky
  emas; `TransactionFormModal.tsx` maydonlar tartibi.
- **Takrorlash:** 390×844 → Moliya → To'lov qabul qilish: 9 ta maydon, "Saqlash"/"Bekor qilish" ekranda yo'q — oyna ichida
  oxirigacha aylantirish kerak; klaviatura ochilganda (balandlik ~480 px) tugma yana ham pastda. "Summa" dagi `650 000`
  placeholder to'ldirilgan qiymatga o'xshaydi. iOS Safari'da `100vh` pastki panel ostida qoladi.
- **Taklif:** `.modal .modal-actions` ni `position: sticky; bottom: 0` (fon va yuqori chegara bilan) qilish, `100dvh`;
  kirim tartibi: Mijoz → Guruh/oy → Summa → To'lov turi → Sana; Kategoriya/Status/Filial/Izoh — "Qo'shimcha" ostida;
  placeholder: "Masalan: 650 000".
- **Qabul mezoni:** 390×844 va 390×480 da "Saqlash" aylantirmasdan ko'rinadi (Playwright tekshiruvi `boundingBox` bilan).

### QA-11. Panel tezligi: CLS 0.97, TBT 420 ms, Performance 58

- **Kim:** hamma (ayniqsa birinchi kirishda tur ko'rsatilganda va arzon telefonlarda).
- **O'lchov:** Lighthouse (mobil, sekinlashtirilgan tarmoq/CPU simulyatsiyasi), `/app?demo=1`: Performance **58**, LCP **3.2 s**, TBT **420 ms**, CLS **0.973**
  (Accessibility 100, Best practices 100). Ishlatilmagan JS ~63 KiB.
- **Sabab:** `.tour-spot` (`src/index.css:3828-3834`) `left/top/width/height` ni animatsiya qiladi, `ProductTour.tsx:71` shu
  qiymatlarni o'rnatadi — har qadam layout shift (eng kattalari 0.30, 0.25, 0.15). Qo'shimcha: `.overview-grid` siljishi 0.067.
- **Taklif:** spotlight'ni `transform: translate(...)` + o'lcham bilan bitta `position: fixed` elementda chizish
  (yoki `clip-path`), turni sahifa joylashuvi barqarorlashgach boshlash; `overview-grid` uchun skelet balandligini oldindan band qilish;
  grafiklar kodini kechiktirib yuklash.
- **Qabul mezoni:** Lighthouse (mobil) `/app?demo=1`: CLS < 0.1, TBT < 200 ms.

### QA-12. Telefonda "Boshqaruv" tablari va "Sozlamalar" menyusi ekrandan chiqib ketadi

- **Kim:** administrator telefondan.
- **Qayerda:** `.tabs` (`src/index.css:2836-2842`, `overflow-x: auto` + `scrollbar-width: none`), `.settings-nav`
  (`src/index.css:4411-4417`).
- **Takrorlash:** 390 px → Boshqaruv: "Savatcha", "Seanslar", "Rollar va ruxsatlar" tablari ko'rinmaydi, aylantirish belgisi yo'q.
  Sozlamalar: "O'quv jarayoni", "Filiallar", "Integratsiyalar", "SMS", "Telegram bot", "Avtomatik eslatma" havolalari ekrandan tashqarida.
- **Taklif:** telefonda `flex-wrap` yoki chetida soya/strelka; faol tabni `scrollIntoView({ inline: 'center' })`;
  yoki ≤ 640 px da `<select>` ko'rinishi.
- **Qabul mezoni:** 390 px da barcha tab/havolalar ko'rinadi yoki aylantirish mumkinligi aniq ko'rsatilgan.

### QA-13. Ota-onalar boti: xabarlar to'liq emas

- **Kim:** ota-ona.
- **Qayerda:** bot javoblari — `supabase/functions/_shared/telegram.ts`, navbat xabarlari (kelmadi, to'lov) —
  `supabase/functions/_shared/outbox.ts`, webhook — `supabase/functions/telegram/index.ts`, `supabase/functions/_shared/bot.ts`.
  Testlar: `src/server/telegram.test.ts`, `src/server/outbox.test.ts`.
- **Topilganlar:**
  1. Qarz javobida to'lov havolasi xom uzun URL (`https://checkout.paycom.uz/bT01ZTcz…`) — inline tugma "💳 To'lash" kerak (`reply_markup.inline_keyboard`, `url`).
  2. Qarz faqat umumiy summa — oy va guruh bo'yicha tafsilot yo'q ("Noyabr · IELTS — 650 000; Oktabr qoldig'i — 100 000").
  3. "✅ To'lov qabul qilindi" xabarida qolgan qarz ko'rsatilmaydi.
  4. "Darsga kelmadi" xabarida dars vaqti yo'q; ruscha matn `не пришёл(ла)`, `не был(а)` — noqulay; jinssiz tuzilma kerak
     ("Ozoda Toshmatova: сегодня пропуск урока — IELTS, 09:00").
  5. Davomat: oxirgi 5 yozuv chiqadi — "kelmadi" holatlari ro'yxatdan tushib qoladi (statistikada "kelmadi 1", ro'yxatda faqat "Keldi").
     Qoldirilgan darslar birinchi ko'rsatilsin.
  6. Markaz bilan bog'lanish tugmasi yo'q (telefon, manzil, ish vaqti).
  7. `/stop` dan keyin til tanlovi yo'qoladi: rus tilini tanlagan ota-onaga keyingi javob o'zbekcha keldi.
- **Qabul mezoni:** har band uchun `src/server/telegram.test.ts` / `src/server/outbox.test.ts` da test;
  `npm run check` (engine bundle ham) va `deno check --no-lock --node-modules-dir=none supabase/functions/*/index.ts` yashil.

### QA-14. Xodimlar ro'yxatida filial ko'rinmaydi

- **Kim:** administrator (bir nechta filial bo'lsa).
- **Qayerda:** `src/components/admin/AdminPanel.tsx:103-110` — ustunlar: Xodim, Rol, Holat, Oxirgi kirish.
- **Muammo:** qaysi xodim qaysi filialga cheklangani faqat tahrirlash oynasini ochib bilinadi.
- **Taklif:** "Filial" ustuni ("Butun markaz" / filial nomi) va filial bo'yicha filtr (filiallar bo'lsa).
- **Qabul mezoni:** `Branches.test.tsx` ga ustun tekshiruvi.

---

## 🟡 Past

### QA-15. Noma'lum manzil bosh sahifani ochadi (404 yo'q)
- **Qayerda:** `src/main.tsx:18-29` — `default` → `LandingPage`; hosting rewrite tufayli HTTP 200 ("soft 404").
- **Taklif:** "Sahifa topilmadi" sahifasi (uz/ru, "Bosh sahifa" va "Kirish" havolalari, `noindex`).

### QA-16. Landing: ruscha versiya va matnlar
- RU rejimda skrinshotlar o'zbekcha interfeysni ko'rsatadi (`src/landing/LandingPage.tsx:45-47` — bitta to'plam). Ruscha skrinshotlar to'plami (`npm run screenshots` ga `lang` parametri).
- Hero matnida 1.2 imkoniyatlari yo'q: Payme/Click onlayn to'lov, SMS eslatma, ota-onalar boti, filiallar.
- Narx kartalarida takror: Standart — "5 tagacha xodim" (sarlavha) + "5 tagacha xodim va rollar"; Pro — "Cheksiz xodim" ikki marta (`src/constants/plans.ts` + karta sarlavhasi).
- `/privacy`, `/terms` RU tanlanganda ham o'zbekcha (sarlavha `document.title` ham) — ruscha matn (yurist bilan) yoki aniq "Русская версия готовится" belgisi. QA-04 bilan birga.

### QA-17. Telefonda kichik bosish nishonlari (< 32 px, tavsiya 44 px)
- Til tugmalari 35×26, footer havolalari 20 px, segment tugmalari 31 px, `?` izoh tugmalari 18×18, jadvaldagi ism havolalari 20 px,
  saralash tugmalari 17 px, Header'dagi "Filial" tanlovi 25 px.
- **Taklif:** `@media (pointer: coarse)` da `min-height: 44px` yoki `::after` bilan kengaytirilgan bosish maydoni (`.lang-switch button`, `.hint-btn`, `.segmented button`, `.link-btn`, `.sort-btn`, `.branch-switch select`).

### QA-18. Sozlash ustasi: mayda joylashuv xatolari
- 3-qadam (Xodimlar): "Rol" tanlovida "Menejer" kesilgan — "Menejeı" (1440 px da ham). `SetupWizard.tsx` — tanlov kengligi.
- 2-qadam (Kurslar): "Necha oy (0 — muddatsiz)" yorlig'i ikki qatorga tushib, yonidagi maydonlar bilan tekislanmaydi (`SetupWizard.tsx:232-240`). Qisqa yorliq + izoh (`hint`).

### QA-19. O'qituvchi uchun ortiqcha elementlar
- Guruh kartasida "Oylik narx 650 000 so'm" ko'rinadi (`src/components/groups/GroupDetail.tsx:198`) — o'qituvchiga narx ko'rinishi kerakmi? **Biznes qarori**; kerak bo'lmasa `finance` ruxsati bilan yashirish.
- "Davomat"da dars ikki marta tanlanadi: tepada segment (`src/components/attendance/AttendancePanel.tsx:37`) va pastda "Dars" select (`AttendancePanel.tsx:59`). Bittasi qolsin.
- Header'dagi "Barcha filiallar" tanlovi o'qituvchiga (va "Sozlamalar", "Yordam" sahifalarida hammaga) ortiqcha — `BranchSwitch.tsx` da yashirish.

### QA-20. Ekran o'quvchi (accessibility) nomlari
- Profil tugmasi: telefonda faqat bosh harflar ("DR") ko'rinadi, nomi esa "Profil: Dilshod Rahimov"; kompyuterda ko'rinadigan matn "ism + rol", nomda rol yo'q (WCAG 2.5.3, Lighthouse `label-content-name-mismatch`). `src/components/layout/ProfileMenu.tsx:37` — `aria-label` ko'rinadigan matn bilan boshlansin (masalan "Dilshod Rahimov, Administrator — profil menyusi").
- Moliya jadvalida har qatordagi chek tugmasi bir xil "Chek" (`src/components/finance/TransactionTable.tsx:284`) → "Chek: {ism}, {summa}, {sana}".
- "Jadval" so'zi ikki ma'noda: mijozlar ro'yxati ko'rinishi ("Jadval | Kanban") va "Dars jadvali" bo'limi. Ko'rinishni "Ro'yxat" deb atash tavsiya.

### QA-21. Chek: onlayn va import to'lovlarda "Qabul qildi: —"
- `src/components/print/Receipt.tsx:88` — Payme/Click va importdan kelgan to'lovda kassir yo'q → "—". "Qabul qildi: Payme (onlayn)" / "Import" yozilsin. Qarz 0 bo'lsa "Qarz yo'q" qatori ham foydali (hozir faqat qarz > 0 da chiqadi, `:83`).

### QA-22. To'lov oynasidagi "Status" tanlovi kassirni chalg'itadi
- "To'lov qabul qilish" oynasida "Status" (To'langan / Kutilmoqda / Bekor qilingan) tanlovi bor — pul qabul qilinayotganda
  "Kutilmoqda" tanlash mantiqsiz. Taklif: qabul qilishda status yashirin ("To'langan"), kutilayotgan to'lov — alohida amal
  yoki "Qo'shimcha" ichida (`TransactionFormModal.tsx`). Ixtiyoriy, QA-10 bilan birga qilish qulay.

### QA-23. Mahsulot egasi paneli (`/owner`)
- Faqat o'zbekcha: RU tanlansa ham "bepul 14 kun", "To'lovli", "Xodim / mijoz", "+30 kun", "N kun qoldi" o'zbekcha (`src/owner/OwnerConsole.tsx`).
- Demo markazlardan biri "IT Park Kids" — haqiqiy tashkilot nomiga o'xshaydi; to'qima nom bilan almashtirish.
- Markaz tafsiloti sahifasi (to'lovlar tarixi, hisob-faktura, aloqa) yo'q — sotuv ko'paygach kerak bo'ladi.

---

## Sinalmagan — qo'lda tekshirish kerak

Bular xato emas, lekin sotuvdan oldin **haqiqiy hisoblar bilan** tekshirilishi shart (bu sinovda imkon bo'lmadi):

1. **Payme** test kassasi: `CheckPerformTransaction` → `PerformTransaction` → `CancelTransaction`, kassaga kirim va qarz yangilanishi.
2. **Click** test: `prepare` → `complete`, imzo tekshiruvi, takroriy so'rov.
3. **Eskiz** haqiqiy SMS (test akkaunt): yuborish, limit, xato kodlari; har kuni ertalabki avtomatik eslatma (cron).
4. **Telegram** haqiqiy bot: webhook, ulash havolasi, kontakt orqali ulash, navbatdagi xabarlar yetkazilishi.
5. **Supabase bulut**: bir nechta qurilma va xodim bir vaqtda, RLS prod'da (lokal PG 16 da RLS testlari o'tgan).
6. Haqiqiy telefonlar: iPhone Safari va arzon Android Chrome (bu sinov Chromium emulyatsiyasida bo'ldi).
7. Ekran o'quvchi (NVDA / VoiceOver) bilan to'liq o'tish.
8. Katta hajm: 5–10 ming mijoz, 50+ guruhda tezlik.
9. Markazlarning haqiqiy Excel fayllari bilan import.
10. 58/80 mm termoprinterda chek chop etish.

## Tekshirildi — muammo topilmadi

- Rollar: menyu va tugmalar ruxsatlar jadvaliga mos (menejer, kassir, kuzatuvchi, o'qituvchi). Kuzatuvchida tahrirlash tugmasi yo'q
  (avtomatik tekshiruvdagi bitta "topilma" saralash ustuni "Добавлен" ekan — xato emas).
- O'qituvchiga mijoz telefonlari ko'rinmaydi.
- Filialga cheklangan xodim faqat o'z filialini ko'radi, "Filiallar" bo'limi yopiq.
- 390 / 768 / 1440 px da gorizontal siljish yo'q; konsolda xato va ogohlantirish yo'q.
- Kontrast (WCAG AA): yorug' va qorong'i mavzuda 11 bo'lim + landing — 0 ta muammo.
- Rasmlarda `alt` bor; nomsiz tugma yo'q (sana tanlovidagi ichki `input` `aria-hidden` — to'g'ri).
- Takroriy telefonni aniqlash, kirill ism bilan qidiruv, juda uzun ism va markaz nomi, chek oynasi va chop etish ko'rinishi,
  rasmlarning kechiktirib yuklanishi, landingdagi fokus halqalari.
- Ruscha rejimda ism-familiya, guruh va filial nomlari o'zbekcha qoladi — bu foydalanuvchi kiritgan ma'lumot, tarjima xatosi emas.

---

## PROMPT (nusxalab Claude Code'ga bering)

```text
Sen EduFlow CRM (React 19 + TypeScript + Vite, Supabase Edge Functions — Deno) loyihasida ishlayapsan.
Vazifa: docs/QA-PROMPT.md dagi QA topilmalarini tuzatish. Avval faylni to'liq o'qi.

Tartib:
1. Avval 🔴 Yuqori (QA-01…QA-05), keyin 🟠 O'rta (QA-06…QA-14), keyin 🟡 Past (QA-15…QA-23).
   Har guruh — alohida commit (masalan: "fix(qa): QA-01 telefon normalizatsiyasi").
2. Har topilma uchun avval muammoni takrorlaydigan test yoz (Vitest unit / @testing-library UI / Playwright e2e),
   keyin tuzat. Topilmadagi "Qabul mezoni" bajarilmaguncha "tuzatildi" dema.
3. Fayl:qator ko'rsatkichlari 2026-11-09 holatiga — kod o'zgargan bo'lsa, joyni qidirib top.
4. Yangi yoki o'zgargan matnlar tr('...') ichida bo'lsin va src/i18n/ru.ts ga ruscha tarjima qo'sh
   (src/i18n/i18n.test.ts lug'at to'liqligini tekshiradi).
5. Ma'lumot formati (telefon, qidiruv) o'zgarsa — mavjud ma'lumot va eski zaxira fayllari o'qilishi buzilmasin.
6. QA-04 (huquqiy matn) va QA-19 (o'qituvchiga narx) — egasi qaror qiladi: kompaniya ma'lumotlarini to'qib chiqarma,
   kod tomonini tayyorla (VITE_* sozlama, build ogohlantirishi) va nima kerakligini yoz.
7. Har commit oldidan: npm run check (typecheck, oxlint, vitest, build, engine) va npm run e2e.
   supabase/ o'zgarsa: deno check --no-lock --node-modules-dir=none supabase/functions/*/index.ts va RLS testlari (supabase/tests).
8. Taqiqlangan (qaytarib bo'lmaydigan): branch o'chirish, force-push, main'ga to'g'ridan-to'g'ri push, PR'ni merge qilish,
   production ma'lumotni o'chirish.
9. Oxirida jadval ber: QA-ID → tuzatildi / qisman / qoldirildi (+ sabab), qo'shilgan testlar va tekshiruv natijalari.
```

## Qayta sinash (topilmalarni o'z ko'zingiz bilan ko'rish)

```bash
npm run build
```

```bash
npx vite preview --port 4174
```

So'ng brauzerda `http://localhost:4174/app?demo=1` — yuqoridagi "Rol sifatida ko'rish" tanlovi bilan rollarni almashtiring;
telefon ko'rinishi uchun DevTools'da 390 px kenglik. Yangi markaz oqimi uchun `http://localhost:4174/app` (demo'dan chiqib,
toza brauzer profilida).
