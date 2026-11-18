import { lazy, Suspense, useEffect, useState } from 'react'
import { APP_NAME } from '../constants/app'
import { Icon } from '../constants/navigation'
import type { IconName } from '../constants/navigation'
import { BrandMark } from '../components/ui/BrandMark'
import { PLANS, TRIAL_DAYS } from '../constants/plans'
import { contactLinks, DEMO_ONLY, hasSupportContacts, MAIN_SITE_URL } from '../constants/support'
import { tr } from '../i18n'
import { routeHref } from '../router'
import { formatNumber } from '../utils/format'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { landingCtas } from './apply'
import type { CtaAction } from './apply'
import './landing.css'

const ApplyModal = lazy(() => import('./ApplyModal').then((m) => ({ default: m.ApplyModal })))

// Tugma yoki havola: ariza oynasini ochadi yoki manzilga olib boradi
function Cta({ action, className, onApply, icon }: { action: CtaAction; className: string; onApply: () => void; icon?: IconName }) {
  if (action.kind === 'apply') {
    return (
      <button type="button" className={className} onClick={onApply} aria-haspopup="dialog">
        {icon && <Icon name={icon} size={16} />}
        {action.label}
      </button>
    )
  }
  return (
    <a className={className} href={action.href}>
      {icon && <Icon name={icon} size={16} />}
      {action.label}
    </a>
  )
}

const asset = (name: string) => `${import.meta.env.BASE_URL}landing/${name}`

// Skrinshot: WebP (telefon uchun kichik, kompyuter uchun katta), eski brauzerlar uchun JPEG
const HERO_SIZES = '(max-width: 860px) calc(100vw - 32px), 620px'
const SHOT_SIZES = '(max-width: 860px) calc(100vw - 32px), 460px'

function Shot(props: { name: string; widths: number[]; width: number; height: number; alt: string; sizes: string; priority?: boolean }) {
  return (
    <picture>
      <source type="image/webp" srcSet={props.widths.map((w) => `${asset(`${props.name}-${w}.webp`)} ${w}w`).join(', ')} sizes={props.sizes} />
      <img
        src={asset(`${props.name}.jpg`)}
        width={props.width}
        height={props.height}
        alt={props.alt}
        decoding="async"
        {...(props.priority ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
      />
    </picture>
  )
}

const AUDIENCE: Array<{ icon: IconName; title: string }> = [
  { icon: 'book', title: tr('O\'quv markazlari') },
  { icon: 'globe', title: tr('Til kurslari') },
  { icon: 'monitor', title: tr('IT va dasturlash maktablari') },
  { icon: 'user', title: tr('Repetitorlar') },
  { icon: 'calendar', title: tr('Abituriyent tayyorlov') },
]

// Har bir da'vo ishlaydigan funksiyaga mos (README → "Bo'limlar")
const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'kanban', title: tr('Lidlar voronkasi'), text: tr('Har bir qo\'ng\'iroq va so\'rov yo\'qolmaydi: Yangi → Bog\'lanildi → O\'ylayapti → To\'lov qildi.') },
  { icon: 'layers', title: tr('Guruhlar'), text: tr('Sig\'im, xona va vaqt ziddiyatlari tekshiriladi. O\'quvchini ko\'chirish, pauza, chegirma va individual narx.') },
  { icon: 'calendar', title: tr('Dars jadvali'), text: tr('Hafta kunlari yoki xonalar bo\'yicha jadval, ziddiyatlar qizil bilan belgilanadi, A4 chop etish.') },
  { icon: 'checkSquare', title: tr('Davomat'), text: tr('O\'qituvchi telefonda bir bosishda belgilaydi: keldi, kelmadi, kechikdi, sababli. Oylik setka va foiz.') },
  { icon: 'receipt', title: tr('To\'lov va chek'), text: tr('Guruh va oy tanlanadi, summa qoldiq bilan o\'zi to\'ladi. 80 mm yoki A4 chek — summa so\'z bilan.') },
  { icon: 'alert', title: tr('Qarzdorlar va eslatmalar'), text: tr('Qarz har bir guruh bo\'yicha o\'zi hisoblanadi. Qarzdorga tayyor matn — nusxa, Telegram yoki SMS.') },
  { icon: 'briefcase', title: tr('O\'qituvchi maoshi'), text: tr('Belgilangan summa, tushumdan foiz yoki o\'quvchi boshiga — oylik hisob, to\'lash va eksport.') },
  { icon: 'barChart', title: tr('Kassa va hisobotlar'), text: tr('Kirim, chiqim va balans; qaysi reklama o\'zini oqladi — CSV va Excel\'ga bir tugmada.') },
  { icon: 'card', title: tr('Payme va Click'), text: tr('Ota-ona havola orqali to\'laydi — to\'lov kassaga o\'zi tushadi, qarz darhol yangilanadi. Bulutli rejimda.') },
  { icon: 'mail', title: tr('SMS va avtomatik eslatma'), text: tr('Eskiz orqali qarzdorlarga SMS — bir tugmada yoki har kuni ertalab avtomatik, to\'lov havolasi bilan.') },
  { icon: 'bell', title: tr('Ota-onalar boti'), text: tr('Telegram\'da: farzandi darsga kelmasa va to\'lov qabul qilinsa xabar; qarz, davomat va jadval — botda.') },
  { icon: 'building', title: tr('Filiallar'), text: tr('Bir nechta manzil: har filial bo\'yicha guruh, kassa va hisobot; xodim faqat o\'z filialini ko\'radi.') },
  { icon: 'upload', title: tr('Excel\'dan import'), text: tr('Eski ro\'yxatni CSV yoki Excel\'dan ko\'chiring: ustunlar o\'zi moslashadi, takrorlar oldindan ko\'rinadi.') },
  { icon: 'shield', title: tr('Xodimlar va rollar'), text: tr('Administrator, menejer, kassir, o\'qituvchi, kuzatuvchi — har biri faqat o\'ziga kerakli narsani ko\'radi.') },
  { icon: 'activity', title: tr('Jurnal va savatcha'), text: tr('Kim qachon nima qilgani yozib boriladi. O\'chirilgan narsa 30 kun savatchada turadi.') },
  { icon: 'phone', title: tr('Telefonda qulay'), text: tr('Pastki menyu, katta tugmalar, qorong\'i mavzu. O\'zbek va rus tilida.') },
]

const BENEFITS: Array<{ value: string; text: string }> = [
  { value: tr('1 daqiqa'), text: tr('to\'lovni yozib, chek berish') },
  { value: tr('0 ta'), text: tr('yo\'qolgan lid — har biri voronkada') },
  { value: tr('30 kun'), text: tr('xato o\'chirilganini qaytarish mumkin') },
]

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: tr('O\'rnatish kerakmi?'),
    a: tr('Yo\'q. Brauzerda ochiladi — kompyuter, planshet yoki telefonda. Ro\'yxatdan o\'tish 2 daqiqa.'),
  },
  {
    q: tr('Ma\'lumotlarim xavfsizmi?'),
    a: tr('Parollar shifrlangan holda saqlanadi, har bir xodim faqat o\'z roliga kerakli narsani ko\'radi, barcha amallar jurnalga yoziladi. Bulutli rejimda ma\'lumotlar serverda saqlanadi.'),
  },
  {
    q: tr('Excel\'dagi eski ro\'yxatimni ko\'chirsa bo\'ladimi?'),
    a: tr('Ha. Mijozlar bo\'limidagi "Import" CSV yoki Excel faylni o\'qiydi: ustunlar o\'zi moslashadi, takror va xatoli qatorlar oldindan ko\'rinadi, xohlasangiz importni bekor qilasiz.'),
  },
  {
    q: tr('Ota-onalar to\'lovni onlayn qila oladimi?'),
    a: tr('Ha, bulutli rejimda: markaz Payme yoki Click kassasini ulaydi, ota-ona eslatmadagi havola orqali to\'laydi — to\'lov kassaga avtomatik kirim bo\'lib tushadi. Kassa shartnomasi markaz va to\'lov tizimi o\'rtasida tuziladi.'),
  },
  {
    q: tr('Bir nechta filialim bor — mos keladimi?'),
    a: tr('Ha. Har filial bo\'yicha guruhlar, o\'quvchilar, kassa va hisobot yuritiladi, filiallarni yonma-yon solishtirasiz; xodimni bitta filialga cheklash mumkin. Bir nechta filial — Pro tarifida.'),
  },
  {
    q: tr('O\'qituvchilar ham tizimga kiradimi?'),
    a: tr('Ha. O\'qituvchi faqat o\'z guruhlari, jadvali va davomatini ko\'radi — mijozlar telefoni va moliya unga yopiq. O\'qituvchi kirishlari tarifdagi xodimlar soniga kirmaydi.'),
  },
  {
    q: tr('Sinov muddati tugasa nima bo\'ladi?'),
    a: tr('Ma\'lumotlaringiz o\'chmaydi. Tarifni tanlaysiz va ishni davom ettirasiz.'),
  },
]

function Header() {
  return (
    <header className="lp-header">
      <a className="lp-brand" href={routeHref('landing')}>
        <span className="logo-mark" aria-hidden="true">
          <BrandMark />
        </span>
        <strong>{APP_NAME}</strong>
      </a>
      <nav className="lp-nav" aria-label={tr('Sahifa bo\'limlari')}>
        <a href="#features">{tr('Imkoniyatlar')}</a>
        <a href="#pricing">{tr('Narxlar')}</a>
        <a href="#faq">{tr('Savollar')}</a>
      </nav>
      <div className="lp-header-actions">
        <LanguageSwitch />
        <a className="btn btn-ghost" href={routeHref('app')}>
          {tr('Kirish')}
        </a>
      </div>
    </header>
  )
}

export function LandingPage() {
  useEffect(() => {
    document.title = `${APP_NAME} — ${tr('o\'quv markazlari uchun CRM')}`
  }, [])

  const [applyOpen, setApplyOpen] = useState(false)
  const contacts = contactLinks()
  const trialLabel = tr('{0} kun bepul sinash', { 0: TRIAL_DAYS })
  const ctas = landingCtas(
    { demoOnly: DEMO_ONLY, mainSiteUrl: MAIN_SITE_URL, hasContacts: hasSupportContacts(), appHref: routeHref('app'), demoHref: routeHref('app', '?demo=1') },
    trialLabel,
  )
  const openApply = () => setApplyOpen(true)
  const primaryIcon: IconName | undefined = ctas.primary.kind === 'link' && ctas.primary.href.includes('demo=1') ? 'play' : undefined

  return (
    <div className="lp">
      <a href="#main" className="skip-link">
        {tr('Asosiy kontentga o\'tish')}
      </a>
      <Header />
      <main id="main">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-text">
            <p className="lp-eyebrow">{tr('O\'quv markazlari uchun CRM')}</p>
            <h1 id="hero-title">{tr('O\'quv markazingizni bitta panelda boshqaring')}</h1>
            <p className="lp-lead">
              {tr('Lidlar, guruhlar va dars jadvali, davomat, to\'lovlar va qarzdorlar, o\'qituvchi maoshi — daftar va Excel\'siz. Administrator 10 daqiqada o\'rganadi.')}
            </p>
            <div className="lp-cta">
              <Cta action={ctas.primary} className="btn btn-primary lp-btn-lg" onApply={openApply} icon={primaryIcon} />
              {ctas.secondary && <Cta action={ctas.secondary} className="btn btn-ghost lp-btn-lg" onApply={openApply} icon={ctas.secondary.kind === 'link' ? 'play' : 'mail'} />}
            </div>
            <p className="lp-note muted">{tr('Karta talab qilinmaydi · O\'zbek va rus tilida · Telefon va kompyuterda')}</p>
          </div>
          <figure className="lp-hero-shot">
            <Shot name="overview" widths={[720, 1440]} width={1440} height={900} sizes={HERO_SIZES} priority alt={tr('Boshqaruv paneli: tushum, lidlar, konversiya va oylik grafik')} />
          </figure>
        </section>

        <section className="lp-section lp-audience" aria-labelledby="audience-title">
          <h2 id="audience-title">{tr('Kimlar uchun')}</h2>
          <ul className="lp-chips">
            {AUDIENCE.map((item) => (
              <li key={item.title}>
                <Icon name={item.icon} size={18} />
                {item.title}
              </li>
            ))}
          </ul>
        </section>

        <section id="features" className="lp-section" aria-labelledby="features-title">
          <h2 id="features-title">{tr('Kerakli hamma narsa — oddiy tilda')}</h2>
          <p className="lp-sub muted">{tr('Murakkab sozlamalar yo\'q. Har bir tugma nima qilishi yozib qo\'yilgan.')}</p>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature">
                <span className="kpi-icon tone-primary" aria-hidden="true">
                  <Icon name={f.icon} size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section lp-benefits" aria-labelledby="benefits-title">
          <h2 id="benefits-title">{tr('Nima o\'zgaradi')}</h2>
          <div className="lp-benefit-grid">
            {BENEFITS.map((b) => (
              <div key={b.text} className="lp-benefit">
                <strong>{b.value}</strong>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="shots-title">
          <h2 id="shots-title">{tr('Qanday ko\'rinadi')}</h2>
          <div className="lp-shots">
            <figure>
              <Shot name="customers" widths={[720, 1440]} width={1440} height={900} sizes={SHOT_SIZES} alt={tr('Mijozlar voronkasi (Kanban)')} />
              <figcaption>{tr('Mijozlar voronkasi')}</figcaption>
            </figure>
            <figure>
              <Shot name="finance" widths={[720, 1440]} width={1440} height={900} sizes={SHOT_SIZES} alt={tr('Moliya: kassa balansi va to\'lovlar jurnali')} />
              <figcaption>{tr('Moliya va kassa')}</figcaption>
            </figure>
            <figure className="lp-shot-phone">
              <Shot name="mobile" widths={[390]} width={390} height={844} sizes="280px" alt={tr('Telefondagi ko\'rinish')} />
              <figcaption>{tr('Telefonda')}</figcaption>
            </figure>
            <figure>
              <Shot name="schedule" widths={[720, 1440]} width={1440} height={900} sizes={SHOT_SIZES} alt={tr('Haftalik dars jadvali: guruhlar kun va vaqt bo\'yicha')} />
              <figcaption>{tr('Dars jadvali')}</figcaption>
            </figure>
            <figure>
              <Shot name="attendance" widths={[720, 1440]} width={1440} height={900} sizes={SHOT_SIZES} alt={tr('Guruh kartasi: oylik davomat setkasi')} />
              <figcaption>{tr('Guruh va davomat')}</figcaption>
            </figure>
          </div>
        </section>

        <section id="pricing" className="lp-section" aria-labelledby="pricing-title">
          <h2 id="pricing-title">{tr('Narxlar')}</h2>
          <p className="lp-sub muted">{tr('{0} kun bepul — keyin markazingizga mos tarifni tanlaysiz.', { 0: TRIAL_DAYS })}</p>
          <div className="lp-plans">
            {PLANS.map((plan) => (
              <article key={plan.id} className={plan.highlighted ? 'lp-plan is-highlighted' : 'lp-plan'} aria-labelledby={`plan-${plan.id}`}>
                {plan.highlighted && <span className="lp-plan-badge">{tr('Ko\'p tanlanadi')}</span>}
                <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
                <p className="lp-price">
                  {plan.priceMonthly === 0 ? (
                    <strong>{tr('Bepul')}</strong>
                  ) : (
                    <>
                      <strong>{formatNumber(plan.priceMonthly)}</strong> {tr('so\'m / oy')}
                    </>
                  )}
                </p>
                <p className="muted">{plan.trialDays ? tr('{0} kun', { 0: plan.trialDays }) : plan.staffLimit ? tr('{0} tagacha xodim', { 0: plan.staffLimit }) : tr('Cheksiz xodim')}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Icon name="check" size={16} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Cta
                  action={ctas.plan.kind === 'link' && ctas.plan.label === trialLabel ? { ...ctas.plan, label: plan.id === 'trial' ? tr('Bepul boshlash') : tr('Sinovdan boshlash') } : ctas.plan}
                  className={plan.highlighted ? 'btn btn-primary' : 'btn btn-ghost'}
                  onApply={openApply}
                />
              </article>
            ))}
          </div>
          <p className="lp-note muted">{tr('Narxlar so\'mda, oylik to\'lov. Yillik to\'lovda chegirma — kelishiladi.')}</p>
        </section>

        <section id="faq" className="lp-section" aria-labelledby="faq-title">
          <h2 id="faq-title">{tr('Ko\'p beriladigan savollar')}</h2>
          <div className="faq lp-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>
                  <span>{item.q}</span>
                  <Icon name="chevronDown" size={16} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-section lp-final" aria-labelledby="final-title">
          <h2 id="final-title">{tr('Bugunoq boshlang')}</h2>
          <p>{tr('Ro\'yxatdan o\'ting, kurslaringizni kiriting va birinchi to\'lovni yozing — hammasi 10 daqiqada.')}</p>
          <div className="lp-cta">
            <Cta action={ctas.primary} className="btn btn-primary lp-btn-lg" onApply={openApply} />
            {ctas.secondary && <Cta action={ctas.secondary} className="btn btn-ghost lp-btn-lg" onApply={openApply} />}
          </div>
          {contacts.length > 0 && (
            <ul className="lp-contacts" aria-label={tr('Bog\'lanish')}>
              {contacts.map((c) => (
                <li key={c.kind}>
                  <span className="muted">{c.label}:</span>{' '}
                  <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                    {c.value}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="lp-footer">
        <span>
          © {APP_NAME} · {tr('O\'zbekistonda ishlab chiqilgan')}
        </span>
        {contacts.length > 0 && (
          <ul className="lp-footer-contacts" aria-label={tr('Sotuvchi bilan bog\'lanish')}>
            {contacts.map((c) => (
              <li key={c.kind}>
                <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  <Icon name={c.kind === 'phone' ? 'phone' : 'mail'} size={14} />
                  {c.value}
                </a>
              </li>
            ))}
          </ul>
        )}
        <nav aria-label={tr('Huquqiy ma\'lumot')}>
          <a href={routeHref('privacy')}>{tr('Maxfiylik siyosati')}</a>
          <a href={routeHref('terms')}>{tr('Foydalanish shartlari')}</a>
          <a href={routeHref('app')}>{tr('Kirish')}</a>
        </nav>
      </footer>
      {applyOpen && (
        <Suspense fallback={null}>
          <ApplyModal onClose={() => setApplyOpen(false)} siteUrl={typeof window === 'undefined' ? '' : `${window.location.origin}${routeHref('landing')}`} />
        </Suspense>
      )}
    </div>
  )
}
