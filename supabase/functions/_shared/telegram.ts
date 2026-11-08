// Ota-onalar uchun Telegram bot — sof mantiq (Deno va Vitest'da bir xil): buyruqlar, matnlar (o'zbek/rus),
// ulash havolasi kodi (HMAC), xabar matnlari va Bot API mijozi (fetch tashqaridan beriladi).
import type { FetchLike } from './eskiz.ts'
import { safeEqual } from './hash.ts'
import { isRecord } from './payments.ts'

export type Lang = 'uz' | 'ru'
export type Keyboard = 'menu' | 'contact' | 'remove'

export interface BotReply {
  chatId: number
  text: string
  keyboard: Keyboard
}

export interface LinkedStudent {
  customerId: string
  name: string
  lang: Lang
}

// generated/engine.d.ts dagi CustomerReport bilan bir xil shakl
export interface StudentReport {
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

export interface BotStore {
  linkByCode: (code: string, chatId: number, lang: Lang) => Promise<LinkedStudent | null>
  linkByPhone: (phone: string, chatId: number, lang: Lang) => Promise<LinkedStudent[]>
  linked: (chatId: number) => Promise<LinkedStudent[]>
  unlink: (chatId: number) => Promise<number>
  setLang: (chatId: number, lang: Lang) => Promise<void>
  reports: (customerIds: string[], lang: Lang) => Promise<StudentReport[]>
}

const TEXT = {
  uz: {
    welcome: (org: string) => `Assalomu alaykum! Bu "${org}" o'quv markazining boti.\nFarzandingizni ulash uchun pastdagi tugma bilan telefon raqamingizni yuboring (markazda yozilgan raqam) yoki markaz bergan havolani oching.`,
    linked: (names: string) => `✅ Ulandi: ${names}.\nEndi dars qoldirilsa va to'lov qabul qilinsa xabar olasiz. Tugmalar: qarz, davomat, jadval.`,
    notFound: 'Bu raqam bo\'yicha o\'quvchi topilmadi. Markazdan ulash havolasini so\'rang.',
    badCode: 'Havola noto\'g\'ri yoki eskirgan. Markazdan yangisini so\'rang yoki telefon raqamingizni yuboring.',
    notLinked: 'Avval farzandingizni ulang: telefon raqamingizni yuboring.',
    foreignContact: 'Iltimos, o\'zingizning raqamingizni yuboring (pastdagi tugma orqali).',
    stopped: 'Xabarlar to\'xtatildi. Qayta ulash: /start',
    lang: 'Til: o\'zbekcha 🇺🇿',
    help: 'Tugmalar: 💳 Qarz · 📅 Davomat · 🗓 Jadval · 🌐 Til. To\'xtatish: /stop',
    buttons: { debt: '💳 Qarz', attendance: '📅 Davomat', schedule: '🗓 Jadval', lang: '🌐 Til', contact: '📱 Telefon raqamni yuborish' },
    days: ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'],
    debt: (name: string, money: string) => `${name}: qarz ${money}`,
    noDebt: (name: string) => `${name}: qarz yo'q ✅`,
    advance: (money: string) => `oldindan to'langan: ${money}`,
    pay: (link: string) => `To'lash: ${link}`,
    attendance: (name: string, p: number, l: number, a: number, e: number, rate: string) => `${name} — oxirgi 30 kun: keldi ${p}, kechikdi ${l}, kelmadi ${a}, sababli ${e} (${rate})`,
    noLessons: (name: string) => `${name}: oxirgi 30 kunda davomat yo'q`,
    status: { present: 'Keldi', late: 'Kechikdi', absent: 'Kelmadi', excused: 'Sababli' } as Record<string, string>,
    schedule: (name: string) => `${name}:`,
    noGroups: (name: string) => `${name}: hozir guruhda emas`,
    room: (room: string) => `${room}`,
    absenceToday: (name: string, group: string) => `⚠️ ${name} bugun darsga kelmadi (${group}).`,
    absence: (name: string, group: string, date: string) => `⚠️ ${name} ${date} kuni darsga kelmadi (${group}).`,
    payment: (name: string, money: string, via: string) => `✅ To'lov qabul qilindi: ${money}${via} — ${name}. Rahmat!`,
    currency: 'so\'m',
  },
  ru: {
    welcome: (org: string) => `Здравствуйте! Это бот учебного центра «${org}».\nЧтобы подключить ребёнка, отправьте свой номер телефона кнопкой ниже (номер, записанный в центре) или откройте ссылку от центра.`,
    linked: (names: string) => `✅ Подключено: ${names}.\nТеперь вы будете получать сообщения о пропусках и поступивших оплатах. Кнопки: долг, посещаемость, расписание.`,
    notFound: 'По этому номеру ученик не найден. Попросите в центре ссылку для подключения.',
    badCode: 'Ссылка неверна или устарела. Попросите в центре новую или отправьте свой номер телефона.',
    notLinked: 'Сначала подключите ребёнка: отправьте свой номер телефона.',
    foreignContact: 'Пожалуйста, отправьте свой собственный номер (кнопкой ниже).',
    stopped: 'Сообщения отключены. Подключиться снова: /start',
    lang: 'Язык: русский 🇷🇺',
    help: 'Кнопки: 💳 Долг · 📅 Посещаемость · 🗓 Расписание · 🌐 Язык. Отключить: /stop',
    buttons: { debt: '💳 Долг', attendance: '📅 Посещаемость', schedule: '🗓 Расписание', lang: '🌐 Язык', contact: '📱 Отправить номер телефона' },
    days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    debt: (name: string, money: string) => `${name}: долг ${money}`,
    noDebt: (name: string) => `${name}: долга нет ✅`,
    advance: (money: string) => `оплачено вперёд: ${money}`,
    pay: (link: string) => `Оплатить: ${link}`,
    attendance: (name: string, p: number, l: number, a: number, e: number, rate: string) => `${name} — за 30 дней: был ${p}, опоздал ${l}, не был ${a}, уважительно ${e} (${rate})`,
    noLessons: (name: string) => `${name}: за последние 30 дней посещаемости нет`,
    status: { present: 'Был', late: 'Опоздал', absent: 'Не был', excused: 'Уважительно' } as Record<string, string>,
    schedule: (name: string) => `${name}:`,
    noGroups: (name: string) => `${name}: сейчас не в группе`,
    room: (room: string) => `${room}`,
    absenceToday: (name: string, group: string) => `⚠️ ${name} сегодня не пришёл(ла) на урок (${group}).`,
    absence: (name: string, group: string, date: string) => `⚠️ ${name} не был(а) на уроке ${date} (${group}).`,
    payment: (name: string, money: string, via: string) => `✅ Оплата получена: ${money}${via} — ${name}. Спасибо!`,
    currency: 'сум',
  },
} as const

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function money(amount: number, currency: string, lang: Lang): string {
  const grouped = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return currency === 'USD' ? `$${grouped}` : `${grouped} ${TEXT[lang].currency}`
}

// 'YYYY-MM-DD' -> 'DD.MM.YYYY'
const displayDate = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

type Command = 'start' | 'stop' | 'lang' | 'debt' | 'attendance' | 'schedule' | 'other'

export function parseInput(text: string): { command: Command; arg: string } {
  const value = text.trim()
  const [head, ...rest] = value.split(/\s+/)
  const lower = (head ?? '').toLowerCase().replace(/@\w+$/, '')
  const arg = rest.join(' ')
  const button = (key: 'debt' | 'attendance' | 'schedule' | 'lang') => value === TEXT.uz.buttons[key] || value === TEXT.ru.buttons[key]
  if (lower === '/start') return { command: 'start', arg }
  if (lower === '/stop') return { command: 'stop', arg: '' }
  if (lower === '/til' || lower === '/lang' || button('lang')) return { command: 'lang', arg: '' }
  if (lower === '/qarz' || lower === '/debt' || button('debt')) return { command: 'debt', arg: '' }
  if (lower === '/davomat' || button('attendance')) return { command: 'attendance', arg: '' }
  if (lower === '/jadval' || button('schedule')) return { command: 'schedule', arg: '' }
  return { command: 'other', arg: '' }
}

export function formatReports(kind: 'debt' | 'attendance' | 'schedule', reports: readonly StudentReport[], lang: Lang): string {
  const t = TEXT[lang]
  return reports
    .map((r) => {
      if (kind === 'debt') {
        const lines = [r.debt > 0 ? t.debt(r.name, money(r.debt, r.currency, lang)) : t.noDebt(r.name)]
        if (r.debt === 0 && r.advance > 0) lines.push(t.advance(money(r.advance, r.currency, lang)))
        if (r.link) lines.push(t.pay(r.link))
        return lines.join('\n')
      }
      if (kind === 'attendance') {
        const a = r.attendance
        if (a.present + a.late + a.absent + a.excused === 0) return t.noLessons(r.name)
        // attendanceRate — foizda (0–100)
        const rate = a.rate === null ? '—' : `${Math.round(a.rate)}%`
        const recent = a.recent.map((x) => `• ${displayDate(x.date).slice(0, 5)} — ${t.status[x.status] ?? x.status} (${x.group})`)
        return [t.attendance(r.name, a.present, a.late, a.absent, a.excused, rate), ...recent].join('\n')
      }
      if (r.groups.length === 0) return t.noGroups(r.name)
      const lines = r.groups.map((g) => {
        const days = WEEKDAYS.flatMap((d, i) => (g.days.includes(d) ? [t.days[i]] : [])).join(', ')
        return `• ${g.name} — ${days} ${g.startTime}–${g.endTime}${g.room ? `, ${t.room(g.room)}` : ''}`
      })
      return [t.schedule(r.name), ...lines].join('\n')
    })
    .join('\n\n')
}

// Navbatdagi xabar (cron): dars qoldirildi yoki to'lov qabul qilindi
export function notificationText(
  item: { kind: 'absence' | 'payment'; payload: Record<string, unknown> },
  ctx: { name: string; groupName: string; currency: string; today: string },
  lang: Lang,
): string {
  const t = TEXT[lang]
  if (item.kind === 'absence') {
    const date = typeof item.payload.date === 'string' ? item.payload.date.slice(0, 10) : ''
    return date === ctx.today || !date ? t.absenceToday(ctx.name, ctx.groupName) : t.absence(ctx.name, ctx.groupName, displayDate(date))
  }
  const provider = item.payload.provider === 'payme' ? ' (Payme)' : item.payload.provider === 'click' ? ' (Click)' : ''
  return t.payment(ctx.name, money(Number(item.payload.amount) || 0, ctx.currency, lang), provider)
}

export async function handleUpdate(update: unknown, store: BotStore, orgName: string): Promise<BotReply[]> {
  if (!isRecord(update) || !isRecord(update.message)) return []
  const message = update.message
  const chat = isRecord(message.chat) ? message.chat : null
  // Faqat shaxsiy chat (guruhlarda ishlamaydi)
  if (!chat || typeof chat.id !== 'number' || chat.type !== 'private') return []
  const chatId = chat.id
  const from = isRecord(message.from) ? message.from : {}
  const linked = await store.linked(chatId)
  const lang: Lang = linked[0]?.lang ?? (from.language_code === 'ru' ? 'ru' : 'uz')
  const t = TEXT[lang]
  const reply = (text: string, keyboard: Keyboard): BotReply[] => [{ chatId, text, keyboard }]
  const names = (list: readonly LinkedStudent[]) => list.map((s) => s.name).join(', ')

  if (isRecord(message.contact)) {
    const contact = message.contact
    if (typeof contact.user_id !== 'number' || contact.user_id !== from.id) return reply(t.foreignContact, 'contact')
    const students = await store.linkByPhone(String(contact.phone_number ?? ''), chatId, lang)
    return students.length > 0 ? reply(t.linked(names(students)), 'menu') : reply(t.notFound, 'contact')
  }

  const { command, arg } = parseInput(typeof message.text === 'string' ? message.text : '')
  switch (command) {
    case 'start': {
      if (arg) {
        const student = await store.linkByCode(arg, chatId, lang)
        return student ? reply(t.linked(names([...linked.filter((s) => s.customerId !== student.customerId), student])), 'menu') : reply(t.badCode, 'contact')
      }
      return linked.length > 0 ? reply(`${t.linked(names(linked))}\n\n${t.help}`, 'menu') : reply(t.welcome(orgName), 'contact')
    }
    case 'stop':
      await store.unlink(chatId)
      return reply(t.stopped, 'remove')
    case 'lang': {
      if (linked.length === 0) return reply(t.notLinked, 'contact')
      const next: Lang = lang === 'uz' ? 'ru' : 'uz'
      await store.setLang(chatId, next)
      return [{ chatId, text: `${TEXT[next].lang}\n${TEXT[next].help}`, keyboard: 'menu' }]
    }
    case 'debt':
    case 'attendance':
    case 'schedule': {
      if (linked.length === 0) return reply(t.notLinked, 'contact')
      const reports = await store.reports(
        linked.map((s) => s.customerId),
        lang,
      )
      return reply(formatReports(command, reports, lang) || t.notLinked, 'menu')
    }
    default:
      return linked.length > 0 ? reply(t.help, 'menu') : reply(t.welcome(orgName), 'contact')
  }
}

// ===== Ulash havolasi: https://t.me/<bot>?start=<kod>. Kod = HMAC-SHA256(maxfiy, mijoz id)[0..12] + mijoz id =====
const encoder = new TextEncoder()

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
  return [...signature].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const CODE_ID = /^[A-Za-z0-9_-]{1,52}$/

export async function linkCode(secret: string, customerId: string): Promise<string | null> {
  if (!CODE_ID.test(customerId)) return null
  return `${(await hmacHex(secret, customerId)).slice(0, 12)}${customerId}`
}

export async function parseLinkCode(secret: string, code: string): Promise<string | null> {
  if (!/^[0-9a-f]{12}/.test(code)) return null
  const id = code.slice(12)
  if (!CODE_ID.test(id)) return null
  const expected = (await hmacHex(secret, id)).slice(0, 12)
  return safeEqual(expected, code.slice(0, 12)) ? id : null
}

// ===== Bot API =====
export function keyboardMarkup(keyboard: Keyboard, lang: Lang): Record<string, unknown> {
  const b = TEXT[lang].buttons
  if (keyboard === 'menu') return { keyboard: [[{ text: b.debt }, { text: b.attendance }], [{ text: b.schedule }, { text: b.lang }]], resize_keyboard: true }
  if (keyboard === 'contact') return { keyboard: [[{ text: b.contact, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }
  return { remove_keyboard: true }
}

export interface TelegramResult {
  ok: boolean
  status: number
  result?: unknown
  description: string
}

export function telegramApi(token: string, fetchImpl: FetchLike) {
  const call = async (method: string, payload: Record<string, unknown>): Promise<TelegramResult> => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data: unknown = await res.json().catch(() => null)
    return {
      ok: isRecord(data) && data.ok === true,
      status: res.status,
      result: isRecord(data) ? data.result : undefined,
      description: isRecord(data) && typeof data.description === 'string' ? data.description : '',
    }
  }
  return {
    getMe: () => call('getMe', {}),
    setWebhook: (url: string, secretToken: string) => call('setWebhook', { url, secret_token: secretToken, allowed_updates: ['message'], drop_pending_updates: true }),
    deleteWebhook: () => call('deleteWebhook', {}),
    sendMessage: (chatId: number, text: string, keyboard: Keyboard | null, lang: Lang) =>
      call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...(keyboard ? { reply_markup: keyboardMarkup(keyboard, lang) } : {}) }),
  }
}
