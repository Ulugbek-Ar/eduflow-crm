# O'zgarishlar tarixi

Format: [Keep a Changelog](https://keepachangelog.com/) ruhida, versiyalar — [SemVer](https://semver.org/).

## [1.2.0] — 2026-11-09 · ma'lumot sxemasi v12

Pul va aloqa avtomatlashtirildi: onlayn to'lov kassaga o'zi tushadi, eslatmalar SMS va ota-onalar boti orqali (har kuni
avtomatik ham), markaz bir nechta filialda ishlaydi.

### Qo'shildi

- **Payme va Click** (bulutli rejim): Merchant API (Payme JSON-RPC: CheckPerform/Create/Perform/Cancel/CheckTransaction/
  GetStatement, 12 soatlik muddat, tiyin, xato kodlari; ixtiyoriy fiskal `detail` — MXIK) va Click SHOP API (Prepare/
  Complete, MD5 imzo). Hisob — o'quvchi telefoni; to'lov kassaga "To'langan" kirim bo'lib yoziladi (guruh va oy bilan,
  Toshkent vaqti), bekor qilinsa — kirim ham bekor; ilova har daqiqada yangi onlayn to'lovlarni olib keladi va xabar beradi.
  Eslatma matniga o'quvchining shaxsiy to'lov havolasi (`{havola}`). Kalitlar faqat serverda (`integration_secrets`).
- **SMS (Eskiz.uz)**: ulash (login tekshiriladi, token 30 kun, avtomatik yangilanadi), eslatma oynasidan bitta yoki ko'p
  qarzdorga SMS (telefon serverda mijoz kartasidan), SMS jurnali (`sms_log`), sinov SMS, segmentlar soni.
- **Ota-onalar uchun Telegram bot**: markaz o'z botini ulaydi (BotFather tokeni, webhook `X-Telegram-Bot-Api-Secret-Token`
  bilan tekshiriladi). Ota-ona o'quvchi kartasidagi HMAC kodli havola yoki o'z telefon raqami (faqat o'z kontakti) bilan
  ulanadi; "dars qoldirildi" va "to'lov qabul qilindi" xabarlari (bazadagi triggerlar → `notification_outbox` → har 5
  daqiqada, xato belgini tuzatish uchun 2 daqiqa, bekor qilingan voqea yuborilmaydi); botda qarz (to'lov havolasi bilan),
  oxirgi 30 kun davomati, jadval; o'zbek/rus; `/stop`. Eslatma oynasida "Bot orqali ota-onaga".
- **Kunlik avtomatik eslatma** (`cron` Edge Function, pg_cron): qarzdorlarga ertalab — botga ulanganlarga bot orqali
  (bepul, ota-ona tilida), qolganlarga SMS; bir o'quvchiga N kunda bir marta (xodim yuborgan eslatmalar ham hisobga
  olinadi); qarz ilova bilan aynan bir xil hisoblanadi (`src/server/engine.ts` yig'masi, `npm run check:engine`).
- **Filiallar**: Sozlamalar → Filiallar (qo'shish, tahrirlash, arxivlash; birinchi filialga mavjud ma'lumotni biriktirish);
  Header'da filial tanlovi — ro'yxatlar, kassa balansi, hisobotlar, jadval va davomat shu filial bo'yicha; guruh, mijoz,
  xarajat va xodim formalarida filial; mijoz to'lovining filiali o'qish guruhidan; xona ziddiyati filial ichida; Tahlil →
  "Filiallar bo'yicha" (o'quvchi, guruh, kirim, xarajat, foyda). Xodimni bitta filialga cheklash — u faqat shu filial
  ma'lumotini ko'radi va yozadi (bulutda RLS bilan).
- Tariflar: Standart — 1 filial, Pro va sinov — cheksiz. Demo markaz ikki filialli (Pro).
- `DEPLOY.md` §6–9: Payme/Click, Eskiz, Telegram bot, filiallar; pg_cron jadvallari.

### O'zgardi

- Avtomatik eslatma sozlamalari alohida kartaga ko'chdi (SMS va bot kanallari uchun umumiy).
- Mijoz kartasida "Ota-ona Telegram'i" bo'limi (bot ulangan bo'lsa): ulash havolasi, botdan uzish.
- `CopyField` umumiy UI komponenti.

### Migratsiya (v11 → v12)

- Lokal ma'lumot o'zgarmaydi (filialsiz ishlayveradi); zaxira formati — v12 (eski zaxiralar o'qiladi).
- Supabase: `20261108000000_online_payments.sql`, `20261108000001_sms.sql`, `20261108000002_telegram.sql`,
  `20261108000003_branches.sql` — `supabase db push`. Edge Function'lar: `payme`, `click`, `telegram`, `cron`
  (`--no-verify-jwt`), `integrations`, `staff`. Ilova filiallar migratsiyasidan oldin ham ishlaydi (filial qo'shilmaguncha).

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
