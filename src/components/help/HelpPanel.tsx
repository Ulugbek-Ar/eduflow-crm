import { GLOSSARY } from '../../constants/glossary'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { SUPPORT_CONTACTS } from '../../constants/support'
import { useDashboard } from '../../context/useDashboard'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'

// Oddiy savollar — oddiy javoblar. Texnik so'zlarsiz, qadam-baqadam
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Yangi mijozni qanday qo\'shaman?',
    a: '"Qo\'shish" → "Yangi mijoz". Ism, telefon va kursni yozing, "Qo\'shish"ni bosing. Mijoz "Yangi" bosqichida paydo bo\'ladi.',
  },
  {
    q: 'To\'lovni qanday qabul qilaman?',
    a: '"Qo\'shish" → "To\'lov qabul qilish". Summani yozing, mijozni tanlang va "Saqlash"ni bosing. Qarzdorlar ro\'yxatidagi "To\'lov" tugmasi summani o\'zi to\'ldiradi.',
  },
  {
    q: 'Mijoz "To\'lov qildi" bosqichiga qachon o\'tadi?',
    a: 'Mijoz kartasida yoki ro\'yxatdagi rangli bosqich tugmasini bosib, "To\'lov qildi"ni tanlang. Kanban ko\'rinishida kartani sudrab ham o\'tkazish mumkin.',
  },
  {
    q: 'Qarzdorlar qanday hisoblanadi?',
    a: 'Kursning oylik narxi × o\'qigan oylar soni − to\'langan summa. Shuning uchun Kurslar bo\'limida har kursning narxi va davomiyligini to\'g\'ri kiriting.',
  },
  {
    q: 'Xato o\'chirib yubordim. Qaytarsa bo\'ladimi?',
    a: 'Ha. O\'chirilgandan keyin pastda "Bekor qilish" tugmasi chiqadi. Keyinroq bo\'lsa — Boshqaruv → Savatcha: o\'chirilgan narsalar 30 kun saqlanadi.',
  },
  {
    q: 'Xodimni qanday qo\'shaman va unga nima ko\'rinadi?',
    a: 'Boshqaruv → Xodimlar → "Xodim qo\'shish". Rol tanlang: Menejer — mijozlar va to\'lov qabul qilish; Kassir — moliya va hisobotlar; Kuzatuvchi — faqat ko\'rish. Vaqtinchalik parolni xodimga bering.',
  },
  {
    q: 'Parolni unutdim',
    a: 'Administrator Boshqaruv → Xodimlar ro\'yxatida "Parolni tiklash"ni bosadi va sizga yangi vaqtinchalik parol beradi.',
  },
  {
    q: 'Ma\'lumotlar qayerda saqlanadi? Yo\'qolib qolmaydimi?',
    a: 'Lokal rejimda — shu kompyuter brauzerida. Brauzer tozalansa yo\'qoladi, shuning uchun haftada bir marta Sozlamalar → Ma\'lumotlar → "JSON zaxira" oling. Bulutli rejimda (Supabase) ma\'lumot serverda saqlanadi va istalgan qurilmadan kirish mumkin.',
  },
  {
    q: 'Hisobotni Excel\'da qanday olaman?',
    a: 'Tahlil va hisobotlar → "Hisobotlarni yuklab olish": mijozlar, tranzaksiyalar, qarzdorlar va manbalar — CSV yoki Excel.',
  },
]

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl + K', 'Qidiruvga o\'tish'],
  ['N', 'Yangi mijoz'],
  ['Esc', 'Ochiq oynani yopish'],
  ['Enter', 'Formani saqlash'],
]

interface Contact {
  icon: IconName
  label: string
  value: string
  href: string
}

export function HelpPanel() {
  const { startTour } = useDashboard()
  const { mode } = useAuth()
  const contacts: Contact[] = []
  if (SUPPORT_CONTACTS.telegram) {
    contacts.push({ icon: 'mail', label: 'Telegram', value: SUPPORT_CONTACTS.telegram, href: `https://t.me/${SUPPORT_CONTACTS.telegram.replace(/^@/, '')}` })
  }
  if (SUPPORT_CONTACTS.phone) contacts.push({ icon: 'phone', label: 'Telefon', value: SUPPORT_CONTACTS.phone, href: `tel:${SUPPORT_CONTACTS.phone.replace(/\s/g, '')}` })
  if (SUPPORT_CONTACTS.email) contacts.push({ icon: 'mail', label: 'Email', value: SUPPORT_CONTACTS.email, href: `mailto:${SUPPORT_CONTACTS.email}` })

  return (
    <div className="stack">
      <section className="card help-hero" aria-labelledby="help-title">
        <div>
          <h2 id="help-title">Qanday yordam kerak?</h2>
          <p className="muted">Ko'p beriladigan savollar, atamalar lug'ati va tezkor tugmalar. Qisqa tanishtiruvni ham qayta ko'rish mumkin.</p>
        </div>
        <Button icon="play" onClick={startTour}>
          Tanishtiruvni ko'rish
        </Button>
      </section>

      <section className="card" aria-labelledby="faq-title">
        <h2 id="faq-title">Ko'p beriladigan savollar</h2>
        <div className="faq">
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

      <div className="split-grid">
        <section className="card" aria-labelledby="glossary-title">
          <h2 id="glossary-title">Atamalar lug'ati</h2>
          <dl className="glossary">
            {Object.values(GLOSSARY).map((entry) => (
              <div key={entry.term}>
                <dt>{entry.term}</dt>
                <dd>{entry.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="shortcuts-title">
            <h2 id="shortcuts-title">Tezkor tugmalar</h2>
            <ul className="shortcut-list">
              {SHORTCUTS.map(([keys, label]) => (
                <li key={keys}>
                  <kbd>{keys}</kbd>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="contact-title">
            <h2 id="contact-title">Bog'lanish</h2>
            {contacts.length > 0 ? (
              <ul className="contact-list">
                {contacts.map((c) => (
                  <li key={c.label}>
                    <Icon name={c.icon} size={16} />
                    <span className="muted">{c.label}:</span>
                    <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                      {c.value}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {mode === 'demo' ? 'Bu demo. Ulanish va narxlar bo\'yicha sotuvchi bilan bog\'laning.' : 'Savol bo\'lsa, markazingiz administratoriga murojaat qiling.'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
