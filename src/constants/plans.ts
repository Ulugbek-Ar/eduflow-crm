import { tr } from '../i18n'

// Tariflar — landing narxlar jadvali va super-admin paneli uchun yagona manba.
// DIQQAT: narxlar namunaviy — sotuvdan oldin o'zingizning haqiqiy narxlaringizni shu yerga yozing
export type PlanId = 'trial' | 'standard' | 'pro'

export interface Plan {
  id: PlanId
  name: string
  // Oylik narx, so'mda (0 — bepul)
  priceMonthly: number
  // Davomiyligi (faqat sinov uchun), kun
  trialDays?: number
  // Xodimlar chegarasi (null — cheksiz)
  staffLimit: number | null
  features: string[]
  highlighted?: boolean
}

export const TRIAL_DAYS = 14

export const PLANS: Plan[] = [
  {
    id: 'trial',
    name: tr('Sinov'),
    priceMonthly: 0,
    trialDays: TRIAL_DAYS,
    staffLimit: 3,
    features: [
      tr('Barcha imkoniyatlar 14 kun'),
      tr('3 tagacha xodim'),
      tr('Karta talab qilinmaydi'),
      tr('Ma\'lumotni keyin ham saqlab qolasiz'),
    ],
  },
  {
    id: 'standard',
    name: tr('Standart'),
    priceMonthly: 199_000,
    staffLimit: 5,
    highlighted: true,
    features: [
      tr('5 tagacha xodim va rollar'),
      tr('Mijozlar va to\'lovlar cheksiz'),
      tr('Chek, qarzdorlar, hisobotlar'),
      tr('Amallar jurnali va savatcha'),
      tr('Telegram orqali yordam'),
    ],
  },
  {
    id: 'pro',
    name: tr('Pro'),
    priceMonthly: 399_000,
    staffLimit: null,
    features: [
      tr('Cheksiz xodim'),
      tr('Bulutli saqlash — istalgan qurilmadan'),
      tr('Bir nechta filial uchun alohida markaz'),
      tr('Ma\'lumotni ko\'chirishda yordam'),
      tr('Ustuvor yordam'),
    ],
  },
]
