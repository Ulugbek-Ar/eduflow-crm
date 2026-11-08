// engine.js (src/server/engine.ts yig'masi) uchun qo'lda yozilgan turlar: TypeScript avtomatik, Deno — @ts-types orqali.
// API o'zgarsa shu faylni ham yangilang (src/server/engine.test.ts eksportlar ro'yxatini solishtiradi)
export type Row = Record<string, unknown>

export interface OrgRows {
  settings: unknown
  customers: Row[]
  courses: Row[]
  transactions: Row[]
  groups: Row[]
  enrollments: Row[]
}

export interface DebtorReminder {
  customerId: string
  name: string
  phone: string
  debt: number
  label: string
  text: string
}

export declare function debtorReminders(rows: OrgRows, options: { now: Date; lang: 'uz' | 'ru'; withLink: boolean }): DebtorReminder[]

export declare function tashkentNow(utcMs: number): Date
