# O'zgarishlar tarixi

Format: [Keep a Changelog](https://keepachangelog.com/) ruhida, versiyalar — [SemVer](https://semver.org/).

## [1.1.2] — 2026-11-12 · ma'lumot sxemasi v11

Butun loyihani qayta ko'rib chiqish natijasidagi tuzatishlar.

### Tuzatildi

- **Telefon maydonlari**: Backspace bilan "+998" gacha o'chirilganda "+99" yana "+998 99" ga aylanib, maydonni
  tozalab bo'lmasdi (mijoz, sozlamalar, sozlash ustasi, o'qituvchi). O'qituvchi telefoni ixtiyoriy — faqat "+998"
  qolsa saqlanadi va bo'sh yoziladi.
- **Noyob id'lar** kriptografik tasodifiy (avval `Math.random` ning 5 belgisi — katta Excel importda ikki yozuv bir
  xil id olib, biri ikkinchisining ustidan yozilishi mumkin edi).
- **Bulut: katta o'chirishlar** (savatchani bo'shatish, bekor qilingan import, davomat) 150 tadan bo'laklab — id'lar
  URL'da ketadi, avval minglab yozuvda so'rov juda uzun bo'lib (414) muvaffaqiyatsiz tugardi. Davomat yozish ham bo'laklab.
- **Bulut: sozlamalar** ruxsat bo'lmaganda (muddat tugagan) "saqlandi" deb ko'rinmaydi — xato ko'rsatiladi.
- **Bulut: kirishda** profil bir marta o'qiladi (avval har yuklashda ikki marta); serverdan yangilashda bir xil ma'lumot
  uchun panel qayta chizilmaydi.
- **Excel import**: "zip-bomba" himoyasi — ochilgan hajm oqim davomida sanaladi (e'lon qilingan hajmga ishonilmaydi),
  64 MB dan oshsa to'xtatiladi; avval maxsus fayl tabni qotirib qo'yishi mumkin edi.

### Qo'shildi

- **Huquqiy sahifalar rekvizitlari** muhit o'zgaruvchilaridan: `VITE_LEGAL_COMPANY`, `VITE_LEGAL_ADDRESS`,
  `VITE_LEGAL_DATA_LOCATION`, `VITE_LEGAL_PAYMENT`, `VITE_LEGAL_REFUND`, `VITE_LEGAL_SUPPORT_HOURS`; aloqa —
  `VITE_SUPPORT_*` dan. Kod o'zgartirmasdan `[qavs]` joylar to'ldiriladi (`DEPLOY.md`).
- **Tezroq ochilish**: sahifa bo'lagi (ilova, landing, huquqiy) va CSS `index.js` bilan parallel yuklanadi
  (`scripts/route-preload.ts`), rus tili tanlangan bo'lsa — lug'at ham. `/app` Lighthouse 94 → 96.

## [1.1.1] — 2026-11-10 · ma'lumot sxemasi v11

Tuzatishlar: bulutli rejimda ma'lumot to'liqligi va internet uzilishi, tarif chegarasi, ma'lumotni tozalash.

### Tuzatildi

- **Bulut: 1000 tadan ortiq yozuv.** Supabase bitta javobda ~1000 qator beradi — endi barcha jadvallar (to'lovlar,
  davomat, mijozlar ...) sahifalab to'liq o'qiladi. Avval 1000+ to'lovli markazda to'lagan o'quvchi "qarzdor" chiqardi.
- **Bulut: internet qaytganda** yuborilmay qolgan o'zgarishlar o'zi qayta yuboriladi (avval faqat keyingi o'zgarishda).
- **Bulut: boshqa xodimlar o'zgarishlari** oyna ochilganda, internet qaytganda va har 1,5 daqiqada serverdan olinadi;
  yuborilmagan o'z o'zgarishingiz ustidan yozilmaydi.
- **Bulut: ochilishda internet uzilsa** hisobdan chiqarib yuborilmaydi — "Serverga ulanib bo'lmadi" va "Qayta urinish",
  aloqa tiklansa o'zi ochiladi.
- **Tarif chegarasi serverda** (trigger): o'qituvchi kirishini menejerga aylantirib yoki bloklangan xodimni qayta yoqib
  chegaradan oshib bo'lmaydi. Muddati tugagan markaz xodimlar va sozlamalarni o'zgartira olmaydi.
- **Xodim bloklanganda yoki paroli tiklanganda** uning seanslari bekor qilinadi.
- **Muddat tugaganda** hisobot eksporti va JSON zaxira ochiq; "Tarif" va "Ma'lumotlar" bo'limlari ko'rinadi.
- **"Barcha ma'lumotni tozalash"** savatcha va migratsiyadan oldingi nusxani ham o'chiradi (mijozlar ma'lumoti
  brauzerda qolmaydi). Migratsiyadan oldingi nusxani alohida o'chirish tugmasi; nusxa saqlanmasa — ogohlantirish.
- Tarif muddati ochiq oynada ham har daqiqada qayta hisoblanadi.
- `@supabase/supabase-js` 2.118 ga yangilandi (`npm audit` — 0 zaiflik).

### Migratsiya

- Supabase: `supabase/migrations/20261110000000_staff_limit_sessions.sql` — `supabase db push` bilan qo'llang,
  so'ng `supabase functions deploy staff`. Lokal ma'lumot o'zgarmaydi.

## [1.1.0] — 2026-11-07 · ma'lumot sxemasi v11

O'quv jarayoni: guruhlar, dars jadvali, davomat, o'qituvchilar va maosh; qarz har bir o'qish bo'yicha; eslatmalar va import.

### Qo'shildi

- **Guruhlar**: kurs, o'qituvchi, xona, hafta kunlari va vaqt, sig'im; xona va o'qituvchi ziddiyatlari tekshiriladi.
  O'quvchini guruhga yozish (lid "To'lov qildi"ga o'tadi), boshqa guruhga ko'chirish, pauza, tugatish, chegirma va
  individual narx. Guruh kartasi: o'quvchilar, oylik davomat setkasi, shu oy to'lovlari.
- **Dars jadvali**: haftalik setka (kunlar yoki xonalar bo'yicha), kurs ranglari, ziddiyat va bekor qilingan darslar,
  filtrlar, A4 (albom) chop etish, telefonda kunlar bo'yicha ro'yxat.
- **Davomat**: Keldi / Kechikdi / Kelmadi / Sababli, "Hammasi keldi", klaviatura bilan setka, oy bo'yicha foiz,
  CSV/Excel eksport; belgilanmagan dars va ketma-ket 3 darsga kelmaganlar haqida bildirishnoma.
- **O'qituvchi roli**: faqat o'z guruhlari ("Bugun", "Guruhlarim", "Mening jadvalim", "Davomat"); o'quvchi telefoni va
  moliya yopiq. O'qituvchi kirishlari tarifdagi xodimlar soniga kirmaydi; davomatni tahrirlash oralig'i sozlanadi.
- **O'qituvchilar va maosh**: belgilangan summa, tushumdan foiz yoki har o'quvchi uchun; oy bo'yicha hisob, kassadan
  to'lash (`teacherId`, `period`), eksport.
- **To'lov formasi**: o'quvchi tanlangach guruh va "Qaysi oy uchun" tanlanadi, summa shu oy oxirigacha qoldiq bilan
  to'ldiriladi; chekda guruh va oy.
- **To'lov eslatmalari**: qarzdorlar ro'yxatida "Eslatma" (shablon — o'zbek/rus, nusxa, Telegram, SMS, qo'ng'iroq),
  bir nechtasiga bitta nusxa, "Oxirgi eslatma: N kun oldin". Shablon va to'lov muddati — Sozlamalar → O'quv jarayoni.
- **Mijoz kartasi**: guruh bo'yicha qarz/avans va oxirgi 12 oy jadvali (kutilgan, to'langan, balans).
- **Excel/CSV'dan import**: .csv (UTF-8 / Windows-1251), .xlsx va .xls-shablon, 5 MB va 5000 qatorgacha, kutubxonasiz
  parser; o'zbek/rus/ingliz sarlavhalari, oldindan ko'rish, telefon normallashtirish, fayl ichidagi va bazadagi
  takrorlar (o'tkazib yuborish yoki yangilash), "kurs yaratish" taklifi, o'tkazilganlar CSV'si, jurnalga bitta yozuv va
  "Importni bekor qilish".
- **Demo**: davrga moslashgan deterministik demo (12–24 oylik tarix, 45–60 o'quvchi, 6–8 guruh, 4 o'qituvchi, davomat);
  har kuni "Shu oy" KPI'lari va trendlar to'la.
- `scripts/screenshots.mjs` — README (`docs/*.jpg`) va landing (`public/landing/*.webp|*.jpg`) rasmlari bitta buyruq bilan.
- GitHub Pages: deep link'lar (`/app`, `/privacy`, ...), 404.html, sitemap; `DEPLOY.md` — ishga tushirish runbook'i.
- Landing: "Ariza qoldirish" oynasi va sotuvchi kontaktlari; yangi imkoniyatlar va skrinshotlar.

### O'zgardi

- **Qarz hisobi** har bir o'qish (enrollment) bo'yicha: o'qish boshidan, to'lov muddati (oyning N-sanasi, birinchi oy —
  boshlangan kun), pauza va tugash sanasi, birinchi oy ulushi (ixtiyoriy) hisobga olinadi; ortiqcha to'lov avans bo'lib
  keyingi oylarga o'tadi. Guruhga yozilmagan mijozlar — avvalgidek joriy oy bo'yicha.
- Kirim guruhga yagona qoida bilan bog'lanadi (`enrollmentId`, bo'lmasa to'lov sanasidagi faol o'qish) — qarz va maosh uchun.
- "Faol mijozlar" KPI — guruhlarda o'qiyotganlar.
- Tariflar: bajarilmagan "Bir nechta filial uchun alohida markaz" da'vosi olib tashlandi; har bir da'vo ishlaydigan
  funksiyaga mos.
- Bulutli sinxronlash katta o'zgarishlarni (import) 500 talik bo'laklarda yuboradi.
- Oyna (modal): fokus yo'qolganda ham Escape va Tab eng ustidagi oynaga tegishli.

### Migratsiya (v10 → v11)

- Ko'chishdan oldin ma'lumotning avtomatik nusxasi olinadi (`apex:backup-pre-v11`, Sozlamalar → Ma'lumotlar'dan yuklab olinadi).
- "To'lov qildi" mijozlar kurs bo'yicha "{Kurs} — 1-guruh"ga yoziladi (o'qish boshlanishi — `paidAt`); guruh vaqti, xonasi
  va o'qituvchisini keyin tahrirlang. Eski to'lovlar o'zgartirilmaydi.
- Supabase: `supabase/migrations/20261107000000_teacher_role.sql` va `20261107000001_groups_attendance.sql` (o'qituvchi
  roli, guruhlar, o'qishlar, davomat, RLS, `has_permission()` yangilangan). `supabase db push` bilan qo'llang.

## [1.0.0] — 2026-11-07 · ma'lumot sxemasi v10

Birinchi reliz: lidlar voronkasi (jadval va Kanban), moliya va kassa, chek, qarzdorlar (joriy oy), kurslar, tahlil va
hisobotlar (CSV/Excel), xodimlar va rollar, amallar jurnali, savatcha, sozlash ustasi, o'zbek va rus tillari, yorug' va
qorong'i mavzu, lokal va bulutli (Supabase) rejim, landing va sotuvchi paneli.
