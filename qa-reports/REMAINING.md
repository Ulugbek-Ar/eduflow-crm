# BAJARILMAGAN ISHLAR

> Audit: `main` = `d62889e` (v1.2.2), 2026-11-18. Bajarilganlar — `REPORT.md` va `progress.md` da. Bu yerda faqat qolganlari.

## 1. Muhit yo'qligi sababli bajarilmagan

| Ish | Sabab |
|---|---|
| Bulutli rejim brauzerda: Supabase Auth bilan ro'yxatdan o'tish/kirish, ikki qurilma/xodim bir vaqtda (konflikt, takroriy yozuv, yo'qolgan o'zgarish — B-04 ni amalda isbotlash), offline → online navbatdagi o'zgarishlarni yuborish, 90 s yangilanish, onlayn to'lovlarni olib kelish | Docker daemon yo'q → `supabase start` ishlamaydi; production'ga ulanish taqiqlangan. RLS faqat oddiy PostgreSQL 16 da (PostgREST/GoTrue'siz) sinaldi |
| Payme / Click (prepare/complete, Check/Perform/Cancel), Eskiz SMS, Telegram bot runtime (QA-13 amalda), cron eslatmalar | Test akkauntlar yo'q |
| `/owner` Supabase (`platform_admins`) bilan kirish | Bulut yo'q |
| Haqiqiy iPhone Safari / Android, NVDA/VoiceOver, termoprinter | Faqat Chromium emulyatsiyasi |

## 2. Vaqt/limit sababli yarim qolgan yoki boshlanmagan

| Modul / ish | Holat | Qayerda to'xtadi |
|---|---|---|
| **O'qituvchilar maoshi hisobi** (fixed / foiz / soatbay, oy almashishi, maosh to'lash → chiqim) | Boshlanmagan | Faqat rol bo'yicha tugmalar ko'rildi (kassirda "maosh to'lash" bor). Hisob to'g'riligi mustaqil tekshirilmadi |
| **Tahlil va hisobotlar** raqamlari (konversiya, CPL, ROI, o'rtacha chek, voronka, filiallar kesimi) | Boshlanmagan | Faqat KPI "Jami tushum", kassa, oylik kirim/chiqim tekshirildi |
| **Filiallar** (Sozlamalar → Filiallar CRUD, Header filial tanlovi bo'yicha raqamlar, filialga cheklangan xodim brauzerda) | Boshlanmagan | Filial cheklovi faqat SQL (RLS) darajasida sinaldi |
| **Sozlamalar** bo'limlari validatsiyasi: Tashkilot, Mintaqa, O'quv jarayoni (to'lov kuni, birinchi oy ulushi — qarzga ta'siri), SMS, Telegram, Integratsiyalar, Avtomatik eslatma, Ko'rinish, Profil (parol almashtirish), Tarif, Ma'lumotlar (JSON zaxira → tiklash aylanishi, tozalash) | Boshlanmagan | Faqat menyu va 390 px ko'rinishi (QA-12) |
| **Davomat** to'liq oqimi: o'qituvchi belgilash, tahrirlash muddati, bekor qilingan dars, ketma-ket qoldirish ogohlantirishi | Qisman | Repo e2e (`teacher.spec.ts`) o'tdi; foiz formulasi kod bo'yicha tekshirildi; B-05 kod bo'yicha |
| **Dars jadvali**: xonalar bo'yicha ko'rinish, to'qnashuvlar (bir xona/o'qituvchi bir vaqtda), chop etish | Boshlanmagan | Faqat sahifa ochilishi, overflow va axe |
| **Kanban** (drag & drop, bosqich o'zgarishi → paidAt), **Savatcha** (o'chirish → tiklash), **Seanslar**, **Amallar jurnali** | Boshlanmagan | — |
| **Chek** chop etish, **Eslatma** oynasi (SMS/Telegram shablon, {telefon} o'rniga qo'yish) | Boshlanmagan | QA-21 faqat kod bo'yicha |
| **Landing**: ariza (Apply) formasi validatsiyasi, narx kartalari (QA-16 takror), RU rejimda butun ilova (`/app`) tarjimasi | Qisman | Landing axe/Lighthouse/RU matni bajarildi |
| **Forma validatsiyasi** boshqa rollarda va 768/390 da | Qisman | Faqat admin, 1440 da: mijoz, kurs, guruh, to'lov |
| **Modal ichki tugmalari** 768/390 da (rol bo'yicha) | Qisman | `roles-modals.mjs` faqat 1440 da |
| **Dark theme** 768/390 da kontrast (axe) | Qisman | axe faqat 1440 da (light + dark, 12 sahifa) |
| **Lighthouse** desktop preset, boshqa sahifalar (`/privacy`, `/owner`) | Qisman | Mobil: landing va `/app?demo=1` (lokal + jonli) |
| **Edge Functions** kod auditi (`supabase/functions/payme|click|telegram|cron|staff|integrations`) | Boshlanmagan | Faqat `_shared/telegram.ts` matnlari (QA-13) |
| **C-03** — `enrollmentId`siz kirimlarni bog'lash (Payme/Click `pay_tx_perform` `enrollment_id` yozadimi) | Boshlanmagan | `attribution.ts` kod bo'yicha xavf aniqlandi |
| **QA-16** narx kartalaridagi takror matn, **QA-21** onlayn to'lov cheki brauzerda | Tekshirilmadi | Demo'da onlayn to'lov yo'q |
| Katta hajm (5–10 ming mijoz) tezligi va `localStorage` to'lishi | Boshlanmagan | — |

---

# DAVOM ETTIRISH PROMPTI

```text
EduFlow CRM loyihasining QA auditini DAVOM ETTIR (oldingi sessiya 2026-11-18 da to'xtagan).
Repository: https://github.com/Ulugbek-Ar/eduflow-crm (branch: main). Jonli sayt: https://ulugbek-ar.github.io/eduflow-crm/
Oldingi natijalar: qa-audit branch'idagi qa-reports/REPORT.md, progress.md, REMAINING.md — avval ularni o'qi.
Bajarilganlarni TAKRORLAMA (rollar matritsasi, asosiy moliya/qarz hisoblari, ma'lumot yo'qolishi, QA-01…QA-23, RLS hujum testlari,
axe 1440, Lighthouse mobil landing/app). Faqat pastdagi qolgan ishlarni bajar.

ASOSIY QOIDA
- Bu faqat audit. Ilova kodini o'zgartirma, refactor qilma, yangi funksiya qo'shma, paket o'rnatib package.json/lock faylni
  o'zgartirma, production bazaga ulanma. main'ga commit, push yoki merge qilma, PR ochma. Tuzatishni alohida ruxsatsiz boshlama.
- Playwright va boshqa vositalarni repodan TASHQARIDA o'rnat (masalan, alohida /qa papkada). Skriptlar, skrinshotlar, hisobot avval
  repodan tashqarida.
- YAGONA ISTISNO: QA natijalarini qa-audit branch'iga push qilish (pastda).
- Audit klonida oxirida `git status` toza ekanini tasdiqla.
- Avval main'ning oxirgi commit hash'ini yoz; d62889e dan farq qilsa — o'zgargan fayllarni ko'rib, oldingi topilmalar
  (A-01…A-09, B-01…B-06, QA-01…QA-23) holatiga ta'sirini qisqacha qayd et.
- Lokal build (`npm ci`, `npm run build`, `npx vite preview --port 4174`, demo: /app?demo=1, rol: yuqoridagi "Rol sifatida ko'rish")
  ustida ishlang; jonli saytda faqat ko'rish va demo.
- Oldingi skriptlar va yordamchi lib: qa-reports/tests/*.mjs (lib.mjs — demo'ga kirish, bo'lim ochish, overflow, kichik nishonlar).

QOLGAN ISHLAR (muhimlik tartibida)
1. Moliya: o'qituvchilar maoshi hisobini (fixed/foiz/soatbay, guruh to'lovlari bo'yicha) demo ma'lumotida mustaqil qayta hisobla va UI
   bilan solishtir; "Maosh to'lash" → chiqim va kassa balansi. Sozlamalar → O'quv jarayoni (to'lov kuni, birinchi oy ulushi)
   o'zgarganda qarzlar to'g'ri qayta hisoblanishini tekshir. Tahlil bo'limi raqamlarini (konversiya, CPL, ROI, o'rtacha chek,
   voronka, filiallar kesimi) mustaqil hisobla.
2. Filiallar: Sozlamalar → Filiallar CRUD, Header filial tanlovi bo'yicha KPI/qarz/tranzaksiyalar filtri, filialga cheklangan
   xodimni brauzerda (Boshqaruv → xodimni filialga biriktirish → shu xodim bilan kirish), URL/ruxsatsiz amal sinovlari.
3. Ma'lumot: Sozlamalar → Ma'lumotlar: JSON zaxira yuklab olish → tozalash → tiklash aylanishi (hamma ro'yxat va sozlamalar
   bir xil qaytadimi), buzuq/eski JSON fayl, juda katta fayl; Savatcha o'chirish → tiklash; Kanban drag&drop; Seanslar; Jurnal.
4. C-03: supabase/functions/payme|click va pay_tx_perform — onlayn to'lov enrollment_id yozadimi; yozmasa attribution.ts:29-35
   qoidasi bilan qaysi holatda qarz kamaymaydi — unit darajada isbotla (repodan tashqaridagi test fayli bilan).
   Edge Functions kod auditi: imzo tekshiruvi, takroriy so'rov (idempotency), summa tekshiruvi, xato kodlari.
5. Sozlamalar bo'limlari forma validatsiyasi (Tashkilot, Mintaqa, SMS, Telegram, Integratsiyalar, Avtomatik eslatma, Ko'rinish,
   Profil — parol almashtirish, Tarif) — bo'sh/noto'g'ri/juda uzun qiymatlar, XSS, saqlanmagan o'zgarishdan chiqish ogohlantirishi.
6. Davomat to'liq oqimi (o'qituvchi): belgilash, tahrirlash muddati, bekor qilingan dars, ketma-ket qoldirish ogohlantirishi;
   Dars jadvali: xona/o'qituvchi to'qnashuvi, xonalar ko'rinishi, chop etish; Chek chop etish; Eslatma oynasi shablonlari.
7. Forma validatsiyasi va modal ichki tugmalari menejer/kassir/kuzatuvchi/o'qituvchi uchun 768 va 390 px da; dark theme'da
   768/390 axe skani; RU tilida butun /app (tarjima qilinmagan matn qidirish).
8. Landing: ariza formasi validatsiyasi; QA-16 narx kartalari takrori; Lighthouse desktop preset (landing, /app?demo=1,
   /privacy, /owner) lokal va jonli.
9. Katta hajm: demo generatorni repodan tashqarida 5–10 ming mijoz bilan ishlatib (yoki localStorage'ga yozib) tezlik,
   localStorage to'lishi va xato xabarini tekshir.
10. Bulutli rejim (faqat Docker bo'lsa): supabase start + repodagi migratsiyalar; ikki brauzer profili bilan B-04 (lost update),
    takroriy yozuv, offline → online yuborish. Docker bo'lmasa — "Tekshirilmadi" deb qoldir.

HISOBOT
- Har modul tugagach qa-reports/progress.md ga yoz va push qil.
- REPORT.md ni yangila: yangi topilmalar A/B/C guruhlariga keyingi raqamlar bilan (A-10…, B-07…, C-08…), format:
  ID | Muammo | Joyi (sahifa/fayl:qator, rol, ekran, lokal/jonli) | Takrorlash | Dalil | Muhimlik | Tavsiya.
  Eski topilmalar holati o'zgarsa — jadvalda yangila. "Tuzatish prompti" bo'limiga yangi topilmalarni muhimlik tartibida,
  qabul mezoni va regressiya testlari bilan qo'sh.
- REMAINING.md ni yangila: faqat hali bajarilmaganlar va yangi DAVOM ETTIRISH PROMPTI (shu qoidalar bilan).
- Limit tugashiga yaqin yangi test boshlama; hisobotni yozib, oxirgi qadam sifatida push qil.

GITHUB'GA PUSH (faqat QA natijalari)
- Audit klonidan alohida klon yoki git worktree'da mavjud qa-audit branch'idan davom et (git fetch origin qa-audit).
- Faqat qa-reports/ ichiga yoz: REPORT.md, progress.md, REMAINING.md, screenshots/ (faqat topilmalarni isbotlovchi asosiy
  skrinshotlar), tests/ (ishlatilgan skriptlar).
- Commit'dan oldin `git diff --cached --name-only` — qa-reports/ dan tashqarida fayl bo'lmasin.
- Commit xabari: `qa: audit progress — <bajarilgan modullar>`. Faqat `git push origin qa-audit`. main'ga push, force push,
  merge, PR — taqiqlangan. Push qila olmasang — sababini yoz va fayllarni javobda to'liq ber.
- Tuzatishni boshlama, egasining javobini kut.
```
