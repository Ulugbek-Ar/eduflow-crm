import { describe, expect, it } from 'vitest'
import { contactLinks, hasSupportContacts, telegramHandle } from '../constants/support'
import { applyMessage, landingCtas, mailtoUrl, telegramShareUrl, telUrl, validateApply } from './apply'

const base = { appHref: '/app', demoHref: '/app?demo=1' }

describe('landing CTA — berk ko\'cha yo\'q', () => {
  it('asosiy sayt: bepul sinash shu saytning /app sahifasiga', () => {
    const ctas = landingCtas({ ...base, demoOnly: false, mainSiteUrl: '', hasContacts: false }, '14 kun bepul sinash')
    expect(ctas.primary).toEqual({ kind: 'link', href: '/app', label: '14 kun bepul sinash' })
    expect(ctas.secondary).toMatchObject({ href: '/app?demo=1' })
  })

  it('namoyish sayti + MAIN_SITE_URL: bepul sinash va tariflar asosiy saytning /app sahifasiga', () => {
    const ctas = landingCtas({ ...base, demoOnly: true, mainSiteUrl: 'https://eduflow.uz', hasContacts: true }, 'Sinash')
    expect(ctas.primary).toMatchObject({ kind: 'link', href: 'https://eduflow.uz/app' })
    expect(ctas.plan).toMatchObject({ kind: 'link', href: 'https://eduflow.uz/app' })
  })

  it('namoyish sayti, asosiy sayt yo\'q: demo + ariza; kontakt bo\'lmasa — faqat demo', () => {
    const withContacts = landingCtas({ ...base, demoOnly: true, mainSiteUrl: '', hasContacts: true }, 'Sinash')
    expect(withContacts.primary).toMatchObject({ kind: 'link', href: '/app?demo=1' })
    expect(withContacts.secondary).toMatchObject({ kind: 'apply' })
    expect(withContacts.plan).toMatchObject({ kind: 'apply' })
    const none = landingCtas({ ...base, demoOnly: true, mainSiteUrl: '', hasContacts: false }, 'Sinash')
    expect(none.secondary).toBeNull()
    expect(none.plan).toMatchObject({ kind: 'link', href: '/app?demo=1' })
  })
})

describe('ariza', () => {
  const form = { name: ' Dilshod ', phone: '90 123 45 67', center: 'Bilim Plus', students: '120' }

  it('tekshiruv', () => {
    expect(validateApply(form)).toEqual({})
    expect(Object.keys(validateApply({ name: '', phone: '123', center: '', students: 'ko\'p' })).sort()).toEqual(['center', 'name', 'phone', 'students'])
  })

  it('tayyor xabar va havolalar', () => {
    const text = applyMessage(form, 'EduFlow CRM')
    expect(text).toContain('Ism: Dilshod')
    expect(text).toContain('+998 90 123 45 67')
    expect(text).toContain('O\'quvchilar soni: 120')
    expect(telegramShareUrl('Salom dunyo', 'https://x.uz/')).toBe('https://t.me/share/url?url=https%3A%2F%2Fx.uz%2F&text=Salom%20dunyo')
    expect(mailtoUrl('a@b.uz', 'Ariza', 'Bir ikki')).toBe('mailto:a@b.uz?subject=Ariza&body=Bir%20ikki')
    expect(telUrl('+998 (90) 000-00-00')).toBe('tel:+998900000000')
  })

  it('faqat sozlangan kontaktlar', () => {
    expect(hasSupportContacts({ telegram: '', phone: '', email: '' })).toBe(false)
    expect(contactLinks({ telegram: 'https://t.me/eduflow_uz', phone: '', email: 'sales@eduflow.uz' }).map((c) => c.kind)).toEqual(['telegram', 'email'])
    expect(telegramHandle('@eduflow_uz')).toBe('eduflow_uz')
    expect(contactLinks({ telegram: '@eduflow_uz', phone: '', email: '' })[0]).toMatchObject({ value: '@eduflow_uz', href: 'https://t.me/eduflow_uz' })
  })
})
