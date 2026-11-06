import { tr } from '../i18n'
// Atamalar oddiy so'z bilan: "?" tugmasi bosilganda ko'rinadi
export const GLOSSARY = {
  lead: { term: tr('Lid'), text: tr('Markazga qiziqqan, lekin hali to\'lov qilmagan odam (qo\'ng\'iroq qilgan, yozgan, ro\'yxatdan o\'tgan).') },
  conversion: { term: tr('Konversiya'), text: tr('100 ta liddan nechtasi to\'lov qilgani. Masalan, 20% — har 5 ta liddan bittasi o\'quvchi bo\'ldi.') },
  cpl: { term: tr('CPL'), text: tr('Bitta lid necha pulga tushgani: reklamaga ketgan pul ÷ shu reklamadan kelgan lidlar soni. Qancha kam bo\'lsa, shuncha yaxshi.') },
  roi: { term: tr('ROI'), text: tr('Reklama o\'zini oqladimi. 0% — sarflangan pul qaytdi; 100% — ikki baravar qaytdi; manfiy — zarar.') },
  aov: { term: tr('O\'rtacha chek'), text: tr('Bitta to\'lovning o\'rtacha summasi: jami to\'langan pul ÷ to\'lovlar soni.') },
  funnel: { term: tr('Voronka'), text: tr('Lid qaysi bosqichda turgani: Yangi → Bog\'lanildi → O\'ylayapti → To\'lov qildi (yoki Rad etdi).') },
  balance: { term: tr('Kassa balansi'), text: tr('Hozir qo\'lingizda bo\'lishi kerak bo\'lgan pul: barcha to\'langan kirimlar − barcha to\'langan chiqimlar.') },
  debt: { term: tr('Qarzdor'), text: tr('O\'qiyotgan, lekin shu oygacha kurs narxini to\'liq to\'lamagan o\'quvchi. Kurs narxi va muddati Kurslar bo\'limidan olinadi.') },
} as const

export type GlossaryKey = keyof typeof GLOSSARY
