// Tanishtiruv qadamlari: har biri ekrandagi bitta elementni ko'rsatadi
export interface TourStep {
  // Birinchi ko'rinib turgan element tanlanadi (kompyuter / telefon uchun har xil)
  selectors: string[]
  title: string
  text: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    selectors: ['.mobile-nav', '.sidebar-nav'],
    title: 'Bo\'limlar',
    text: 'Mijozlar, moliya, kurslar va hisobotlar shu menyuda. Rolingizga qarab faqat kerakli bo\'limlar ko\'rinadi.',
  },
  {
    selectors: ['.mobile-nav-add', '.header-add'],
    title: 'Qo\'shish',
    text: 'Yangi mijoz, to\'lov yoki xarajatni shu tugma bilan yozasiz. Kompyuterda N tugmasi — yangi mijoz.',
  },
  {
    selectors: ['.search-toggle', '.header .search'],
    title: 'Qidiruv',
    text: 'Mijozni ismi yoki telefoni, to\'lovni summasi bo\'yicha toping. Kompyuterda Ctrl+K.',
  },
  {
    selectors: ['.period-bar .segmented'],
    title: 'Davr',
    text: 'Raqamlar qaysi vaqt uchun ko\'rsatilishini tanlang: bugun, 7 kun, shu oy yoki shu yil.',
  },
  {
    selectors: ['[data-tour="help"]', '.mobile-nav-item:last-child'],
    title: 'Yordam',
    text: 'Savol tug\'ilsa — Yordam bo\'limida oddiy javoblar, atamalar lug\'ati va bog\'lanish. Tanishtiruvni u yerdan qayta ko\'rish mumkin.',
  },
]
