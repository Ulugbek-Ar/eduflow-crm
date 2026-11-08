import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../../supabase/functions/_shared/eskiz'
import { formatReports, handleUpdate, keyboardMarkup, linkCode, notificationText, parseInput, parseLinkCode, telegramApi } from '../../supabase/functions/_shared/telegram'
import type { BotStore, Lang, LinkedStudent, StudentReport } from '../../supabase/functions/_shared/telegram'

const SECRET = 'webhook-maxfiy'

const report = (patch: Partial<StudentReport> = {}): StudentReport => ({
  customerId: 'c1',
  name: 'Aziza Karimova',
  debt: 650_000,
  advance: 0,
  monthly: 650_000,
  link: 'https://checkout.paycom.uz/abc',
  currency: 'UZS',
  groups: [{ name: 'IELTS — kechki', days: ['mon', 'wed', 'fri'], startTime: '18:00', endTime: '19:30', room: '101-xona' }],
  attendance: { present: 10, late: 1, absent: 1, excused: 1, rate: 91.66, recent: [{ date: '2026-11-06', status: 'absent', group: 'IELTS — kechki' }] },
  ...patch,
})

// Xotiradagi bot ombori: telefon 901234567 — Aziza (c1)
function memoryBot() {
  const links: Array<LinkedStudent & { chatId: number }> = []
  const students: Record<string, { name: string; phone: string }> = { c1: { name: 'Aziza Karimova', phone: '901234567' }, c2: { name: 'Bobur Aliyev', phone: '931112233' } }
  const link = (customerId: string, chatId: number, lang: Lang): LinkedStudent => {
    const known = links.find((l) => l.customerId === customerId && l.chatId === chatId)
    const entry = { customerId, name: students[customerId].name, lang }
    if (!known) links.push({ ...entry, chatId })
    return entry
  }
  const store: BotStore = {
    linkByCode: async (code, chatId, lang) => {
      const id = await parseLinkCode(SECRET, code)
      return id && students[id] ? link(id, chatId, lang) : null
    },
    linkByPhone: async (phone, chatId, lang) =>
      Object.entries(students)
        .filter(([, s]) => phone.replace(/\D/g, '').endsWith(s.phone))
        .map(([id]) => link(id, chatId, lang)),
    linked: async (chatId) => links.filter((l) => l.chatId === chatId).map(({ customerId, name, lang }) => ({ customerId, name, lang })),
    unlink: async (chatId) => {
      const before = links.length
      for (let i = links.length - 1; i >= 0; i--) if (links[i].chatId === chatId) links.splice(i, 1)
      return before - links.length
    },
    setLang: async (chatId, lang) => {
      for (const l of links) if (l.chatId === chatId) l.lang = lang
    },
    reports: async (ids) => ids.map((id) => report({ customerId: id, name: students[id].name })),
  }
  return { store, links }
}

const message = (text: string, extra: Record<string, unknown> = {}) => ({ update_id: 1, message: { message_id: 1, chat: { id: 77, type: 'private' }, from: { id: 77, language_code: 'uz' }, text, ...extra } })

describe('Telegram bot (ota-onalar uchun)', () => {
  it('ulash havolasi: HMAC kod, o\'zgartirilgan kod yoki boshqa kalit — rad', async () => {
    const code = await linkCode(SECRET, 'c1')
    expect(code).toMatch(/^[0-9a-f]{12}c1$/)
    expect(await parseLinkCode(SECRET, code ?? '')).toBe('c1')
    expect(await parseLinkCode('boshqa', code ?? '')).toBeNull()
    expect(await parseLinkCode(SECRET, `${(code ?? '').slice(0, 12)}c2`)).toBeNull()
    expect(await linkCode(SECRET, 'yaroqsiz id')).toBeNull()
  })

  it('/start (kodsiz) — telefon so\'raladi; o\'zgalar kontakti rad; o\'z kontakti — ulanadi va menyu', async () => {
    const { store, links } = memoryBot()
    expect(await handleUpdate(message('/start'), store, 'Bilim Plus')).toEqual([{ chatId: 77, text: expect.stringContaining('"Bilim Plus"'), keyboard: 'contact' }])
    const foreign = await handleUpdate(message('', { contact: { phone_number: '+998901234567', user_id: 99 } }), store, 'Bilim Plus')
    expect(foreign[0].text).toContain('o\'zingizning raqamingizni')
    const own = await handleUpdate(message('', { contact: { phone_number: '+998901234567', user_id: 77 } }), store, 'Bilim Plus')
    expect(own).toEqual([{ chatId: 77, text: expect.stringContaining('✅ Ulandi: Aziza Karimova'), keyboard: 'menu' }])
    expect(links).toHaveLength(1)
    const unknown = await handleUpdate(message('', { contact: { phone_number: '+998951112233', user_id: 77 } }), store, 'Bilim Plus')
    expect(unknown[0]).toMatchObject({ keyboard: 'contact', text: expect.stringContaining('topilmadi') })
  })

  it('/start <kod> — havola orqali; noto\'g\'ri kod; guruh chatida jim', async () => {
    const { store } = memoryBot()
    const code = await linkCode(SECRET, 'c2')
    expect((await handleUpdate(message(`/start ${code}`), store, 'X'))[0]).toMatchObject({ keyboard: 'menu', text: expect.stringContaining('Bobur Aliyev') })
    expect((await handleUpdate(message('/start soxta'), store, 'X'))[0].text).toContain('Havola noto\'g\'ri')
    expect(await handleUpdate({ message: { chat: { id: -5, type: 'group' }, text: '/start' } }, store, 'X')).toEqual([])
  })

  it('tugmalar: qarz (havola bilan), davomat, jadval; til almashadi; /stop uzadi', async () => {
    const { store, links } = memoryBot()
    await handleUpdate(message('', { contact: { phone_number: '998901234567', user_id: 77 } }), store, 'X')
    expect((await handleUpdate(message('💳 Qarz'), store, 'X'))[0].text).toBe('Aziza Karimova: qarz 650 000 so\'m\nTo\'lash: https://checkout.paycom.uz/abc')
    const attendance = (await handleUpdate(message('📅 Davomat'), store, 'X'))[0].text
    expect(attendance).toContain('keldi 10, kechikdi 1, kelmadi 1, sababli 1 (92%)')
    expect(attendance).toContain('• 06.11 — Kelmadi (IELTS — kechki)')
    expect((await handleUpdate(message('🗓 Jadval'), store, 'X'))[0].text).toBe('Aziza Karimova:\n• IELTS — kechki — Du, Cho, Ju 18:00–19:30, 101-xona')
    const lang = await handleUpdate(message('🌐 Til'), store, 'X')
    expect(lang[0].text).toContain('Язык: русский')
    expect(links[0].lang).toBe('ru')
    expect((await handleUpdate(message('💳 Долг'), store, 'X'))[0].text).toContain('долг 650 000 сум')
    expect((await handleUpdate(message('/stop'), store, 'X'))[0]).toMatchObject({ keyboard: 'remove' })
    expect(links).toHaveLength(0)
    expect((await handleUpdate(message('💳 Qarz'), store, 'X'))[0].keyboard).toBe('contact')
  })

  it('hisobot matnlari: qarz yo\'q va avans, darssiz, guruhsiz; buyruqlar tahlili', () => {
    expect(formatReports('debt', [report({ debt: 0, advance: 100_000, link: null })], 'uz')).toBe('Aziza Karimova: qarz yo\'q ✅\noldindan to\'langan: 100 000 so\'m')
    expect(formatReports('attendance', [report({ attendance: { present: 0, late: 0, absent: 0, excused: 0, rate: null, recent: [] } })], 'ru')).toContain('посещаемости нет')
    expect(formatReports('schedule', [report({ groups: [] })], 'uz')).toBe('Aziza Karimova: hozir guruhda emas')
    expect(parseInput('/start@EduBot kod')).toEqual({ command: 'start', arg: 'kod' })
    expect(parseInput('/qarz').command).toBe('debt')
    expect(parseInput('salom').command).toBe('other')
  })

  it('navbat xabarlari: bugun/sana bilan qoldirilgan dars, to\'lov (Payme)', () => {
    const ctx = { name: 'Aziza', groupName: 'IELTS — kechki', currency: 'UZS', today: '2026-11-08' }
    expect(notificationText({ kind: 'absence', payload: { date: '2026-11-08' } }, ctx, 'uz')).toBe('⚠️ Aziza bugun darsga kelmadi (IELTS — kechki).')
    expect(notificationText({ kind: 'absence', payload: { date: '2026-11-06' } }, ctx, 'ru')).toBe('⚠️ Aziza не был(а) на уроке 06.11.2026 (IELTS — kechki).')
    expect(notificationText({ kind: 'payment', payload: { amount: 650000, provider: 'payme' } }, ctx, 'uz')).toBe('✅ To\'lov qabul qilindi: 650 000 so\'m (Payme) — Aziza. Rahmat!')
  })

  it('Bot API: sendMessage tugmalar bilan, xato tavsifi', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> })
      return url.endsWith('/sendMessage') ? new Response(JSON.stringify({ ok: false, description: 'Forbidden: bot was blocked by the user' }), { status: 403 }) : new Response(JSON.stringify({ ok: true, result: { username: 'edu_bot' } }))
    }
    const api = telegramApi('123:abc', fetchImpl)
    expect(await api.getMe()).toMatchObject({ ok: true, result: { username: 'edu_bot' } })
    const sent = await api.sendMessage(77, 'Salom', 'contact', 'uz')
    expect(sent).toMatchObject({ ok: false, status: 403, description: 'Forbidden: bot was blocked by the user' })
    expect(calls[1]).toEqual({ url: 'https://api.telegram.org/bot123:abc/sendMessage', body: { chat_id: 77, text: 'Salom', disable_web_page_preview: true, reply_markup: keyboardMarkup('contact', 'uz') } })
    expect(keyboardMarkup('remove', 'ru')).toEqual({ remove_keyboard: true })
  })
})
