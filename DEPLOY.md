# EduFlow CRM — ishga tushirish (runbook)

Bu hujjat — sotuvga chiqarishdan oldin **qo'lda** bajariladigan qadamlar. Har qadamdan keyin "Tekshirish" bandini
bajaring: u o'tmasa, keyingi qadamga o'tmang. Taxminiy vaqt: 1–1,5 soat.

Uchta joy bor:

| Joy | Vazifasi | Manzil (namuna) |
| --- | --- | --- |
| **Supabase** | Baza, kirish (Auth), RLS, `staff` funksiyasi | `https://<loyiha-id>.supabase.co` |
| **Vercel** | Asosiy sayt: landing + `/app` (bulutli rejim) | `https://eduflow.uz` |
| **GitHub Pages** | Faqat namoyish (demo), ro'yxatdan o'tish yo'q | `https://ulugbek-ar.github.io/eduflow-crm/` |

---

## 0. GitHub repozitoriya

- [ ] **Default branch → `main`.** GitHub → *Settings → General → Default branch* → `main` → *Update*.
      Hozir default — eski `claude/happy-babbage-ahxbov` (8-bosqich), shuning uchun repo sahifasida eski README ko'rinadi.
      Buyruq bilan (huquq yetsa): `gh repo edit Ulugbek-Ar/eduflow-crm --default-branch main`
- [ ] **Eski branch'lar** (hammasi `main` ga to'liq qo'shilgan — xohlasangiz o'chirishingiz mumkin, majburiy emas):
      `claude/happy-babbage-ahxbov`, `claude/crm-funnel-courses-analytics`, `claude/eduflow-product`,
      `claude/storage-errors-password-security-m483a6`. Tekshirish: `git branch -r --merged origin/main`.
- [ ] *Settings → Pages*: Source — **Deploy from a branch**, branch — `gh-pages`, papka — `/ (root)`.
- [ ] *Settings → Actions → General → Workflow permissions*: **Read and write** (Pages workflow `gh-pages` ga yozadi).

**Tekshirish:** repo bosh sahifasida "EduFlow CRM" README ko'rinadi; *Actions* da CI yashil.

---

## 1. Supabase loyihasi

- [ ] [supabase.com](https://supabase.com) → *New project*. Nom: `eduflow-crm`. Region — eng yaqini (Frankfurt yoki
      Stockholm). **DB parolini** parol menejeriga saqlang.
      > Ma'lumot joylashuvi: O'zbekiston qonunchiligiga ko'ra fuqarolarning shaxsga doir ma'lumotlari O'zbekiston
      > hududida saqlanishi kerak — mijozlarga sotishdan oldin yurist bilan maslahatlashing (README → "Ma'lumot joylashuvi").
- [ ] Kompyuterda [Supabase CLI](https://supabase.com/docs/guides/cli) o'rnating va loyihani bog'lang:

```bash
supabase login
```

```bash
supabase link --project-ref <loyiha-id>
```

- [ ] **Sxemani o'rnating** (barcha migratsiyalar: `supabase/migrations/*.sql` — sxema, RLS, guruhlar, davomat):

```bash
supabase db push
```

  CLI'siz: Dashboard → *SQL Editor* → migratsiya fayllarini **nomi bo'yicha tartibda** birma-bir qo'yib *Run*.

- [ ] **`staff` funksiyasini joylang** (xodim qo'shish, parol tiklash; `service_role` kaliti faqat serverda qoladi):

```bash
supabase functions deploy staff
```

  Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase tomonidan funksiyaga avtomatik
  beriladi — qo'shimcha secret kerak emas. Tekshirish: `supabase secrets list` da uchalasi ko'rinadi.

- [ ] *Authentication → URL Configuration*: **Site URL** = `https://<domeningiz>/app`, **Redirect URLs** ga ham shu manzil
      (va vaqtincha `https://<loyiha>.vercel.app/app`).
- [ ] *Authentication → Providers → Email*: yoqilgan. "Confirm email" — tavsiya etiladi (markaz email tasdiqlangach yaratiladi).
- [ ] *Authentication → Emails → SMTP*: o'z SMTP'ingizni ulang (standart Supabase pochtasi soatiga bir necha xat bilan cheklangan).
- [ ] **Savatchani avtomatik tozalash:** *Database → Extensions* → `pg_cron` ni yoqing, so'ng *SQL Editor*:

```sql
select cron.schedule('eduflow-purge-trash', '15 3 * * *', $$select public.purge_trash()$$);
```

- [ ] *Project Settings → API*: `Project URL` va `anon public` kalitni yozib oling (keyingi bo'lim uchun).
      **`service_role` kalitini hech qayerga yozmang.**

**Tekshirish (smoke test):**

- *Table Editor* da `organizations`, `profiles`, `customers`, `groups`, `teachers`, `enrollments`, `attendance` jadvallari bor,
  har birida RLS **enabled** belgisi.
- *Edge Functions* da `staff` — *Active*.
- Ixtiyoriy, lokal: `bash supabase/tests/run-local.sh` (oddiy PostgreSQL'da RLS testlari) — "RLS testlari o'tdi".

---

## 2. Vercel (asosiy sayt)

- [ ] [vercel.com](https://vercel.com) → **Add New → Project** → GitHub'dan `Ulugbek-Ar/eduflow-crm` ni import qiling.
      Framework — Vite (avtomatik), *Production Branch* — `main`. Build sozlamalari `vercel.json` dan olinadi
      (`npm run build` — u `scripts/spa-routes.mjs` ni ham ishga tushiradi: `/app`, `/privacy`, `/terms`, `/owner`
      sahifalari, `sitemap.xml`).
- [ ] *Settings → Environment Variables* (Production va Preview):

| O'zgaruvchi | Qiymat | Majburiy |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<loyiha-id>.supabase.co` | ha (bulutli rejim) |
| `VITE_SUPABASE_ANON_KEY` | `anon public` kalit | ha |
| `VITE_SITE_URL` | `https://eduflow.uz` (oxirida `/` siz) | domen ulansa — ha |
| `VITE_SUPPORT_TELEGRAM` | `@eduflow_uz` | tavsiya |
| `VITE_SUPPORT_PHONE` | `+998 90 000 00 00` | tavsiya |
| `VITE_SUPPORT_EMAIL` | `sales@eduflow.uz` | ixtiyoriy |
| `VITE_OWNER_PASSWORD_HASH` | faqat lokal/demo `/owner` uchun (`npm run owner:password "..."`) | yo'q |

  `VITE_DEMO_ONLY` va `VITE_MAIN_SITE_URL` ni Vercel'da **bermang** — ular faqat namoyish sayti uchun.

- [ ] *Deployments* → oxirgi deploy → **Redeploy** (o'zgaruvchilar faqat yangi build'da kiradi).
- [ ] **Domen:** *Settings → Domains* → `eduflow.uz` va `www.eduflow.uz`. DNS: `A @ 76.76.21.21`,
      `CNAME www cname.vercel-dns.com` (Vercel ko'rsatgan qiymatlar ustun). SSL avtomatik.
      Domen ulangach `VITE_SITE_URL` ni yangilang, Supabase *Site URL* ni ham, va qayta deploy qiling.

**Tekshirish (smoke test):**

- [ ] `https://<domen>/` — landing, "14 kun bepul sinash" tugmasi `/app` ga olib boradi.
- [ ] `https://<domen>/app` — "Ro'yxatdan o'tish" va email/parol bilan kirish ko'rinadi (lokal rejimdagi "Login" emas).
- [ ] Ro'yxatdan o'ting → markaz yaratiladi → mijoz qo'shing → boshqa brauzerda kiring — mijoz ko'rinadi.
- [ ] `https://<domen>/privacy`, `/terms` — **200** (DevTools → Network), konsolda xato yo'q.
- [ ] `https://<domen>/sitemap.xml` va `/robots.txt` (oxirida `Sitemap:` qatori) ochiladi.
- [ ] DevTools → Console: CSP xatolari yo'q.

---

## 3. Birinchi platforma administratori (sotuvchi)

- [ ] O'zingiz `/app` da ro'yxatdan o'ting (yoki Supabase → *Authentication → Add user*).
- [ ] Supabase → *SQL Editor*:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'siz@domen.uz';
```

**Tekshirish:** `https://<domen>/owner` → shu email bilan kiring → markazlar ro'yxati, "+30 kun", "To'xtatish" ishlaydi.

---

## 4. GitHub Pages (namoyish sayti)

`.github/workflows/pages.yml` `main` ga har push'da `npm run check` → `npm run build:pages` → `gh-pages` branch.
Repozitoriya → *Settings → Secrets and variables → Actions → **Variables*** (Secrets emas — bular ochiq qiymatlar):

| O'zgaruvchi | Qiymat | Nima o'zgaradi |
| --- | --- | --- |
| `MAIN_SITE_URL` | `https://eduflow.uz` | "Bepul sinash" va tarif tugmalari asosiy saytning `/app` sahifasiga olib boradi |
| `SUPPORT_TELEGRAM` | `@eduflow_uz` | footer, Yordam, "Ulanish uchun ariza" → Telegram |
| `SUPPORT_PHONE` | `+998 90 000 00 00` | ariza → qo'ng'iroq / nusxa |
| `SUPPORT_EMAIL` | `sales@eduflow.uz` | ariza → email |

- `MAIN_SITE_URL` bo'lmasa: asosiy tugma — "Demo'ni ko'rish", ikkinchisi — "Ulanish uchun ariza".
- Hech qanday `SUPPORT_*` bo'lmasa: ariza tugmasi yashiriladi, faqat demo qoladi; workflow `::warning::` chiqaradi.
- [ ] O'zgaruvchilarni qo'shgach: *Actions → GitHub Pages → Run workflow*.

**Tekshirish (smoke test):**

- [ ] `https://ulugbek-ar.github.io/eduflow-crm/app` → **200** (ilgari 404 edi), "Demo'ni ko'rish" ishlaydi.
- [ ] `/eduflow-crm/privacy`, `/terms`, `/owner` → 200; noma'lum manzil → 404.
- [ ] Landing'da "Bepul sinash" asosiy saytga olib boradi (yoki ariza oynasi ochiladi), footer'da kontaktlar ko'rinadi.

> GitHub Pages pastki papkada (`/eduflow-crm/`) joylashgani uchun `robots.txt` **ishlamaydi** — qidiruv tizimlari uni faqat
> domen ildizidan o'qiydi. Shuning uchun `/app` va `/owner` sahifalarida `<meta name="robots" content="noindex">` bor.
> Asosiy (Vercel) saytda `robots.txt` odatdagidek ishlaydi.

---

## 5. Sotuvdan oldingi oxirgi tekshiruv

- [ ] `src/constants/plans.ts` dagi narxlar — haqiqiy narxlaringiz.
- [ ] `/privacy` va `/terms` matnlari — yurist ko'rib chiqqan (hozir namuna).
- [ ] Bulutli rejimda: administrator → xodim qo'shish (vaqtinchalik parol) → xodim kiradi → parolni almashtiradi.
- [ ] O'qituvchi: *O'qituvchilar* → "Kirish yaratish" → o'qituvchi kiradi → faqat o'z guruhlari va davomati ko'rinadi.
- [ ] JSON zaxira yuklab olinadi va boshqa brauzerda tiklanadi.
- [ ] Telefonda (390 px) asosiy oqim: lid → guruhga qo'shish → davomat → to'lov → chek.

---

## 6. Onlayn to'lov: Payme va Click (ixtiyoriy, faqat bulutli rejim)

Ota-ona eslatmadagi havola yoki Payme/Click ilovasi orqali o'quvchi telefoni bilan to'laydi — to'lov
markaz kassasiga **avtomatik kirim** bo'lib tushadi (karta, "To'langan", o'quvchining guruhiga bog'lanadi), ilovada
bir daqiqa ichida ko'rinadi va bildirishnoma chiqadi. Kalitlar faqat serverda (`integration_secrets`, ilovaga yopiq).

- [ ] Migratsiya qo'llangan bo'lsin (`supabase db push` — `20261108000000_online_payments.sql`). **Avval migratsiya,
      keyin yangi frontend** (Vercel deploy).
- [ ] Funksiyalarni joylang (Payme va Click o'z kaliti/imzosi bilan tekshiriladi — Supabase JWT o'chiq, `supabase/config.toml`):

```bash
supabase functions deploy integrations
```

```bash
supabase functions deploy payme --no-verify-jwt
```

```bash
supabase functions deploy click --no-verify-jwt
```

**Payme** ([business.paycom.uz](https://business.paycom.uz) — kassa yaratilgan bo'lsin):

- [ ] Ilovada *Sozlamalar → Integratsiyalar → Payme*: **Merchant ID** (kassa id, 24 belgi) va **kassa kaliti** →
      "Payme'ni ulash". Test (sandbox) kaliti va MXIK (IKPU) kodi — ixtiyoriy (MXIK berilsa, Payme fiskal chek uchun
      `detail` oladi).
- [ ] Payme kabinetida kassa sozlamalari: **Endpoint** — ilova ko'rsatgan manzil
      (`https://<loyiha>.supabase.co/functions/v1/payme?org=<markaz id>`), **hisob maydoni** — `phone`
      ("Telefon raqami", 9 xona).
- [ ] Sandbox ([test.paycom.uz](https://test.paycom.uz)): endpoint va test kaliti bilan barcha ssenariylar (CheckPerform,
      Create, Perform, Cancel, CheckTransaction, GetStatement) o'tishini tekshiring, so'ng kassani ishchi rejimga o'tkazing.

**Click** ([merchant.click.uz](https://merchant.click.uz) — xizmat yaratilgan bo'lsin):

- [ ] Ilovada *Sozlamalar → Integratsiyalar → Click*: **Service ID**, **Merchant ID** va **Secret key** → "Click'ni ulash".
- [ ] Click kabinetida **Prepare URL** va **Complete URL** — ikkalasi ham ilova ko'rsatgan manzil
      (`https://<loyiha>.supabase.co/functions/v1/click?org=<markaz id>`). Hisob (`merchant_trans_id`) — o'quvchi telefoni.

Tekshirish: qarzdor o'quvchiga eslatma oching — matnda to'lov havolasi bo'ladi; sandbox'da to'lab ko'ring, bir
daqiqada *Moliya*da "Karta · Payme" (yoki Click) kirimi va jurnalda "Payme" nomidan yozuv paydo bo'ladi.

---

## 7. SMS eslatmalar: Eskiz.uz (ixtiyoriy, faqat bulutli rejim)

Qarzdorlarga SMS — eslatma oynasidan ("SMS yuborish") yoki **har kuni ertalab avtomatik**. Telefon raqami server
tomonda mijoz kartasidan olinadi, har SMS jurnalga (`sms_log`) va amallar jurnaliga yoziladi. Eskiz login va paroli
faqat serverda.

- [ ] [my.eskiz.uz](https://my.eskiz.uz) da hisob oching va balansni to'ldiring. **Eslatma matnini moderatsiyaga
      yuboring** (Sozlamalar → O'quv jarayoni'dagi shablon bilan bir xil); sinov hisobidan faqat
      `This is test from Eskiz` matni yuboriladi. Jo'natuvchi nomi (masalan, markaz nomi) — Eskiz tasdiqlaganidan keyin.
- [ ] Migratsiya: `supabase db push` (`20261108000001_sms.sql`).
- [ ] Ilovada *Sozlamalar → SMS (Eskiz)*: email, parol, jo'natuvchi (standart `4546`) → "Eskiz'ni ulash" — server
      Eskiz'ga kirib tekshiradi. "Sinov SMS" bilan o'z raqamingizga yuborib ko'ring.

**Avtomatik eslatma (har kuni 09:00, Toshkent):**

- [ ] Kalit va funksiya:

```bash
supabase secrets set CRON_SECRET=<uzun-tasodifiy-satr>
```

```bash
supabase functions deploy cron --no-verify-jwt
```

- [ ] *Database → Extensions*: `pg_cron` va `pg_net` ni yoqing, so'ng *SQL Editor* (04:00 UTC = 09:00 Toshkent):

```sql
select cron.schedule('eduflow-avtomatik-eslatma', '0 4 * * *', $$
  select net.http_post(
    url := 'https://<loyiha>.supabase.co/functions/v1/cron',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<uzun-tasodifiy-satr>"}'::jsonb,
    body := '{"task": "reminders"}'::jsonb
  );
$$);
```

- [ ] Ilovada *Sozlamalar → SMS → Avtomatik eslatma*: yoqing, "necha kunda bir marta" (3–30) va tilni tanlang.
      Server har kuni to'lov muddati o'tgan o'quvchilarga (oxirgi N kunda SMS olmaganlariga, ko'pi bilan 300 ta)
      shablon bo'yicha xabar yuboradi; onlayn to'lov ulangan bo'lsa — havola bilan. Qarz ilova bilan aynan bir xil
      hisoblanadi (`supabase/functions/_shared/generated/engine.js`).
