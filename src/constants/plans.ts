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
  // Faol filiallar chegarasi (null — cheksiz)
  branchLimit: number | null
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
    branchLimit: null,
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
    branchLimit: 1,
    highlighted: true,
    features: [
      tr('5 tagacha xodim va rollar'),
      tr('O\'qituvchilar xodim limitiga kirmaydi'),
      tr('Guruhlar, jadval, davomat va maosh'),
      tr('Chek, qarzdorlar, eslatmalar, hisobotlar'),
      tr('1 ta filial'),
      tr('Amallar jurnali va savatcha'),
      tr('Telegram orqali yordam'),
    ],
  },
  {
    id: 'pro',
    name: tr('Pro'),
    priceMonthly: 399_000,
    staffLimit: null,
    branchLimit: null,
    features: [
      tr('Standart\'dagi hamma narsa'),
      tr('Cheksiz xodim'),
      tr('Bir nechta filial va filiallar hisoboti'),
      tr('Bulutli saqlash — istalgan qurilmadan'),
      tr('Payme/Click, SMS va ota-onalar boti'),
      tr('Excel\'dan ko\'chirishda yordam'),
      tr('Ustuvor yordam'),
    ],
  },
]
