# O'zgarishlar tarixi

Format: [Keep a Changelog](https://keepachangelog.com/) ruhida, versiyalar — [SemVer](https://semver.org/).

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
