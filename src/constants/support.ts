// Sotuvchi (yordam xizmati) kontaktlari — deploy paytida muhit o'zgaruvchilari bilan beriladi
// (VITE_SUPPORT_TELEGRAM, VITE_SUPPORT_PHONE, VITE_SUPPORT_EMAIL). Bo'sh bo'lsa Yordam bo'limida
// "administratorga murojaat qiling" deyiladi. vite.config.ts bu faylni o'qimaydi (import.meta.env faqat ilovada)
export const SUPPORT_CONTACTS = {
  telegram: import.meta.env.VITE_SUPPORT_TELEGRAM ?? '',
  phone: import.meta.env.VITE_SUPPORT_PHONE ?? '',
  email: import.meta.env.VITE_SUPPORT_EMAIL ?? '',
}
