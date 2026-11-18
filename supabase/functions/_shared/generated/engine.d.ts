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
  attendance?: Row[]
}

export interface CustomerReport {
  customerId: string
  name: string
  debt: number
  advance: number
  monthly: number
  link: string | null
  currency: string
  groups: Array<{ name: string; days: string[]; startTime: string; endTime: string; room: string }>
  attendance: { present: number; late: number; absent: number; excused: number; rate: number | null; recent: Array<{ date: string; status: string; group: string }> }
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

export declare function customerReports(rows: OrgRows, customerIds: readonly string[], options: { now: Date; lang: 'uz' | 'ru' }): CustomerReport[]

export declare function tashkentNow(utcMs: number): Date
