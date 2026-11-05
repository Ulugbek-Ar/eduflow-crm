// Atamalar oddiy so'z bilan: "?" tugmasi bosilganda ko'rinadi
export const GLOSSARY = {
  lead: { term: 'Lid', text: 'Markazga qiziqqan, lekin hali to\'lov qilmagan odam (qo\'ng\'iroq qilgan, yozgan, ro\'yxatdan o\'tgan).' },
  conversion: { term: 'Konversiya', text: '100 ta liddan nechtasi to\'lov qilgani. Masalan, 20% — har 5 ta liddan bittasi o\'quvchi bo\'ldi.' },
  cpl: { term: 'CPL', text: 'Bitta lid necha pulga tushgani: reklamaga ketgan pul ÷ shu reklamadan kelgan lidlar soni. Qancha kam bo\'lsa, shuncha yaxshi.' },
  roi: { term: 'ROI', text: 'Reklama o\'zini oqladimi. 0% — sarflangan pul qaytdi; 100% — ikki baravar qaytdi; manfiy — zarar.' },
  aov: { term: 'O\'rtacha chek', text: 'Bitta to\'lovning o\'rtacha summasi: jami to\'langan pul ÷ to\'lovlar soni.' },
  funnel: { term: 'Voronka', text: 'Lid qaysi bosqichda turgani: Yangi → Bog\'lanildi → O\'ylayapti → To\'lov qildi (yoki Rad etdi).' },
  balance: { term: 'Kassa balansi', text: 'Hozir qo\'lingizda bo\'lishi kerak bo\'lgan pul: barcha to\'langan kirimlar − barcha to\'langan chiqimlar.' },
  debt: { term: 'Qarzdor', text: 'O\'qiyotgan, lekin shu oygacha kurs narxini to\'liq to\'lamagan o\'quvchi. Kurs narxi va muddati Kurslar bo\'limidan olinadi.' },
} as const

export type GlossaryKey = keyof typeof GLOSSARY
