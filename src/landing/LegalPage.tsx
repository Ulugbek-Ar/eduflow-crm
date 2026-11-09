import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { APP_NAME } from '../constants/app'
import { BrandMark } from '../components/ui/BrandMark'
import { getLang, tr } from '../i18n'
import { currentRoute, routeHref } from '../router'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import './landing.css'

// Huquqiy matnlar — NAMUNA. [Kvadrat qavs] ichidagilarni o'zingizniki bilan almashtiring va yurist bilan tekshiring
const UPDATED = '2026-11-06'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Privacy() {
  return (
    <>
      <h1>Maxfiylik siyosati</h1>
      <p className="muted">Oxirgi yangilanish: {UPDATED}</p>
      <Section title="1. Umumiy qoidalar">
        <p>
          Ushbu siyosat {APP_NAME} xizmati (keyingi o'rinlarda — «Xizmat») foydalanuvchilari va ular kiritadigan shaxsga doir ma'lumotlar
          qanday yig'ilishi, saqlanishi va himoya qilinishini tushuntiradi. Xizmat egasi: <strong>[Kompaniya nomi, STIR, manzil]</strong>.
        </p>
        <p>Siyosat O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuni talablariga muvofiq tuzilgan.</p>
      </Section>
      <Section title="2. Qanday ma'lumotlar yig'iladi">
        <ul>
          <li>Hisob ma'lumotlari: markaz nomi, xodimlarning ismi, lavozimi, logini (parollar faqat shifrlangan xesh ko'rinishida).</li>
          <li>Markaz o'zi kiritadigan ma'lumotlar: mijozlar (ism, telefon, email, kurs, izoh), to'lovlar va xarajatlar.</li>
          <li>Texnik ma'lumotlar: kirish vaqti, brauzer va qurilma turi, amallar jurnali.</li>
        </ul>
      </Section>
      <Section title="3. Ma'lumotlardan foydalanish maqsadi">
        <p>
          Ma'lumotlar faqat Xizmatni ko'rsatish uchun ishlatiladi: hisob yuritish, hisobotlar, xavfsizlik va yordam. Ma'lumotlar uchinchi
          shaxslarga sotilmaydi va reklama uchun berilmaydi.
        </p>
      </Section>
      <Section title="4. Ma'lumot egasi va operator">
        <p>
          Markaz o'z mijozlarining shaxsga doir ma'lumotlari uchun mas'ul (egasi/operatori) hisoblanadi va ularni qonuniy asosda
          (jumladan, mijozning roziligi bilan) kiritishi shart. Xizmat egasi bu ma'lumotlarni markaz topshirig'i bo'yicha qayta ishlaydi.
        </p>
      </Section>
      <Section title="5. Saqlash joyi va muddati">
        <p>
          Lokal rejimda ma'lumotlar foydalanuvchi brauzerida saqlanadi. Bulutli rejimda — <strong>[server joylashuvi]</strong>dagi
          serverlarda. O'zbekiston fuqarolarining shaxsga doir ma'lumotlari qonunchilik talabiga ko'ra O'zbekiston hududidagi
          serverlarda saqlanishi lozim — bulutli rejimni yoqishdan oldin buni tekshiring.
        </p>
        <p>Hisob o'chirilgach ma'lumotlar <strong>[30]</strong> kun ichida o'chiriladi (qonun talab qilgan hollar bundan mustasno).</p>
      </Section>
      <Section title="6. Himoya">
        <p>
          Parollar PBKDF2 algoritmi bilan xeshlanadi, ulanish HTTPS orqali, har bir xodim faqat roliga mos ma'lumotni ko'radi, barcha
          muhim amallar jurnalga yoziladi.
        </p>
      </Section>
      <Section title="7. Huquqlaringiz">
        <p>
          Siz o'zingiz haqingizdagi ma'lumotni ko'rish, tuzatish, o'chirish va qayta ishlashga roziligingizni qaytarib olish huquqiga
          egasiz. Murojaat: <strong>[email yoki telefon]</strong>.
        </p>
      </Section>
      <Section title="8. O'zgarishlar">
        <p>Siyosat o'zgarsa, yangi tahriri shu sahifada e'lon qilinadi va yangilanish sanasi ko'rsatiladi.</p>
      </Section>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1>Foydalanish shartlari</h1>
      <p className="muted">Oxirgi yangilanish: {UPDATED}</p>
      <Section title="1. Taraflar va predmet">
        <p>
          Ushbu shartlar <strong>[Kompaniya nomi, STIR]</strong> (keyingi o'rinlarda — «Ijrochi») va {APP_NAME} xizmatidan
          foydalanuvchi tashkilot yoki shaxs (keyingi o'rinlarda — «Foydalanuvchi») o'rtasidagi munosabatlarni tartibga soladi.
          Ro'yxatdan o'tish shartlarga rozilik bildirishni anglatadi (ommaviy oferta).
        </p>
      </Section>
      <Section title="2. Xizmat">
        <p>
          Ijrochi Foydalanuvchiga mijozlar, to'lovlar va hisobotlarni yuritish uchun onlayn dasturdan foydalanish huquqini beradi.
          Imkoniyatlar tanlangan tarifga bog'liq.
        </p>
      </Section>
      <Section title="3. Sinov muddati va to'lov">
        <ul>
          <li>Birinchi 14 kun — bepul sinov, barcha asosiy imkoniyatlar bilan.</li>
          <li>Keyin xizmat tanlangan tarif bo'yicha oyma-oy oldindan to'lanadi: <strong>[to'lov usullari: Click, Payme, bank o'tkazmasi]</strong>.</li>
          <li>To'lov o'z vaqtida qilinmasa, hisob faqat ko'rish rejimiga o'tkazilishi mumkin; ma'lumotlar o'chirilmaydi.</li>
        </ul>
      </Section>
      <Section title="4. Foydalanuvchi majburiyatlari">
        <ul>
          <li>Kiritilgan ma'lumotlar qonuniy va to'g'ri bo'lishi, mijozlar roziligi olingan bo'lishi.</li>
          <li>Login va parollarni boshqalarga bermaslik, xodim ishdan ketsa uni bloklash.</li>
          <li>Xizmatdan noqonuniy maqsadlarda foydalanmaslik.</li>
        </ul>
      </Section>
      <Section title="5. Ijrochi majburiyatlari">
        <ul>
          <li>Xizmatning barqaror ishlashini ta'minlash (rejali ishlar haqida oldindan xabar berish).</li>
          <li>Ma'lumotlarni maxfiy saqlash va Maxfiylik siyosatiga rioya qilish.</li>
          <li>Yordam: <strong>[ish vaqti va aloqa kanali]</strong>.</li>
        </ul>
      </Section>
      <Section title="6. Javobgarlik">
        <p>
          Ijrochi Foydalanuvchi kiritgan ma'lumotlar mazmuni, shuningdek uchinchi shaxslar (internet provayderi, elektr ta'minoti) aybi bilan
          yuzaga kelgan uzilishlar uchun javob bermaydi. Lokal rejimda zaxira nusxa olish Foydalanuvchi zimmasida.
        </p>
      </Section>
      <Section title="7. Shartnomani bekor qilish">
        <p>
          Foydalanuvchi istalgan vaqtda xizmatdan voz kechishi mumkin. Ijrochi so'rov bo'yicha ma'lumotlarni JSON/Excel ko'rinishida
          beradi. To'langan davr uchun qaytarish: <strong>[shartlar]</strong>.
        </p>
      </Section>
      <Section title="8. Nizolar">
        <p>Nizolar muzokara yo'li bilan, kelishilmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq sudda hal qilinadi.</p>
      </Section>
      <Section title="9. Aloqa">
        <p>
          <strong>[Kompaniya nomi, manzil, telefon, email]</strong>
        </p>
      </Section>
    </>
  )
}

export function LegalPage() {
  const route = currentRoute()
  useEffect(() => {
    document.title = `${route === 'privacy' ? 'Maxfiylik siyosati' : 'Foydalanish shartlari'} · ${APP_NAME}`
  }, [route])

  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href={routeHref('landing')}>
          <span className="logo-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <strong>{APP_NAME}</strong>
        </a>
        <div className="lp-header-actions">
          <LanguageSwitch />
          <a className="btn btn-ghost" href={routeHref('app')}>
            {tr('Kirish')}
          </a>
        </div>
      </header>
      <main className="lp-legal" lang="uz">
        <p className="notice notice-warning">
          {tr('Bu hujjat namuna. E\'lon qilishdan oldin kvadrat qavs ichidagi ma\'lumotlarni to\'ldiring va yurist bilan tekshiring.')}
          {getLang() === 'ru' && ' Документ на узбекском языке; русская версия — по запросу.'}
        </p>
        {route === 'privacy' ? <Privacy /> : <Terms />}
        <p className="lp-legal-links">
          <a href={routeHref('landing')}>← {tr('Bosh sahifa')}</a>
          <a href={routeHref(route === 'privacy' ? 'terms' : 'privacy')}>{route === 'privacy' ? 'Foydalanish shartlari' : 'Maxfiylik siyosati'}</a>
        </p>
      </main>
    </div>
  )
}
