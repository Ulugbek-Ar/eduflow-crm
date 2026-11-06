import { useEffect } from 'react'
import { APP_NAME } from '../constants/app'
import { Icon } from '../constants/navigation'
import type { IconName } from '../constants/navigation'
import { PLANS, TRIAL_DAYS } from '../constants/plans'
import { SUPPORT_CONTACTS } from '../constants/support'
import { tr } from '../i18n'
import { routeHref } from '../router'
import { formatNumber } from '../utils/format'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import './landing.css'

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

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'kanban', title: tr('Lidlar voronkasi'), text: tr('Har bir qo\'ng\'iroq va so\'rov yo\'qolmaydi: Yangi → Bog\'lanildi → O\'ylayapti → To\'lov qildi.') },
  { icon: 'receipt', title: tr('To\'lov va chek'), text: tr('To\'lovni bir daqiqada yozing va 80 mm yoki A4 chek chop eting — summa so\'z bilan.') },
  { icon: 'alert', title: tr('Qarzdorlar avtomatik'), text: tr('Kurs narxi va muddatiga qarab kim qancha qarzligi o\'zi hisoblanadi.') },
  { icon: 'dollar', title: tr('Kassa va xarajatlar'), text: tr('Ijara, maosh, reklama — kassada qancha pul borligini doim bilasiz.') },
  { icon: 'barChart', title: tr('Hisobotlar'), text: tr('Qaysi reklama o\'zini oqladi, qaysi kurs ko\'p daromad keltiradi — Excel\'ga bir tugmada.') },
  { icon: 'shield', title: tr('Xodimlar va rollar'), text: tr('Menejer, kassir, kuzatuvchi — har biri faqat o\'ziga kerakli narsani ko\'radi.') },
  { icon: 'activity', title: tr('Amallar jurnali'), text: tr('Kim qachon nima qilgani yozib boriladi. O\'chirilgan narsa 30 kun savatchada turadi.') },
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
    a: tr('Ha. Ulanishda yordam beramiz: mijozlar va to\'lovlarni ko\'chirib beramiz.'),
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
          <Icon name="logo" size={20} />
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

  const contacts = [
    SUPPORT_CONTACTS.telegram && { label: 'Telegram', value: SUPPORT_CONTACTS.telegram, href: `https://t.me/${SUPPORT_CONTACTS.telegram.replace(/^@/, '')}` },
    SUPPORT_CONTACTS.phone && { label: tr('Telefon'), value: SUPPORT_CONTACTS.phone, href: `tel:${SUPPORT_CONTACTS.phone.replace(/\s/g, '')}` },
    SUPPORT_CONTACTS.email && { label: 'Email', value: SUPPORT_CONTACTS.email, href: `mailto:${SUPPORT_CONTACTS.email}` },
  ].filter((c): c is { label: string; value: string; href: string } => Boolean(c))

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
              {tr('Lidlar, to\'lovlar, qarzdorlar, kassa va hisobotlar — daftar va Excel\'siz. Administrator 10 daqiqada o\'rganadi.')}
            </p>
            <div className="lp-cta">
              <a className="btn btn-primary lp-btn-lg" href={routeHref('app')}>
                {tr('{0} kun bepul sinash', { 0: TRIAL_DAYS })}
              </a>
              <a className="btn btn-ghost lp-btn-lg" href={routeHref('app', '?demo=1')}>
                <Icon name="play" size={16} />
                {tr('Demo\'ni ko\'rish')}
              </a>
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
                <a className={plan.highlighted ? 'btn btn-primary' : 'btn btn-ghost'} href={routeHref('app')}>
                  {plan.id === 'trial' ? tr('Bepul boshlash') : tr('Sinovdan boshlash')}
                </a>
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
            <a className="btn btn-primary lp-btn-lg" href={routeHref('app')}>
              {tr('{0} kun bepul sinash', { 0: TRIAL_DAYS })}
            </a>
            <a className="btn btn-ghost lp-btn-lg" href={routeHref('app', '?demo=1')}>
              {tr('Demo\'ni ko\'rish')}
            </a>
          </div>
          {contacts.length > 0 && (
            <ul className="lp-contacts" aria-label={tr('Bog\'lanish')}>
              {contacts.map((c) => (
                <li key={c.label}>
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
        <nav aria-label={tr('Huquqiy ma\'lumot')}>
          <a href={routeHref('privacy')}>{tr('Maxfiylik siyosati')}</a>
          <a href={routeHref('terms')}>{tr('Foydalanish shartlari')}</a>
          <a href={routeHref('app')}>{tr('Kirish')}</a>
        </nav>
      </footer>
    </div>
  )
}
