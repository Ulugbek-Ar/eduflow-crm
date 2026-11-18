import { describe, expect, it } from 'vitest'
import { deliverOutbox, isOutboxItem, OUTBOX_MAX_ATTEMPTS, OUTBOX_STALE_MS } from '../../supabase/functions/_shared/outbox'
import type { OutboxContext, OutboxItem } from '../../supabase/functions/_shared/outbox'
import type { Lang, TelegramResult } from '../../supabase/functions/_shared/telegram'

const NOW = Date.parse('2026-11-08T10:00:00Z')

const item = (patch: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 1,
  customerId: 'c1',
  kind: 'absence',
  payload: { group_id: 'g1', date: '2026-11-08' },
  createdAt: new Date(NOW - 10 * 60_000).toISOString(),
  attempts: 0,
  ...patch,
})

function context(patch: Partial<OutboxContext> = {}) {
  const sent: Array<{ chatId: number; text: string; lang: Lang }> = []
  const unlinked: Array<[string, number]> = []
  const ctx: OutboxContext = {
    now: NOW,
    today: '2026-11-08',
    currency: 'UZS',
    enabled: { absence: true, payment: true },
    customers: new Map([
      ['c1', 'Aziza'],
      ['c2', 'Bobur'],
    ]),
    groups: new Map([['g1', 'IELTS — kechki']]),
    chats: new Map([
      ['c1', [{ chatId: 77, lang: 'uz' as Lang }, { chatId: 88, lang: 'ru' as Lang }]],
      ['c2', [{ chatId: 99, lang: 'uz' as Lang }]],
    ]),
    stillValid: () => true,
    send: async (chatId, text, lang): Promise<TelegramResult> => {
      sent.push({ chatId, text, lang })
      return { ok: true, status: 200, description: '' }
    },
    unlink: async (customerId, chatId) => {
      unlinked.push([customerId, chatId])
    },
    ...patch,
  }
  return { ctx, sent, unlinked }
}

describe('xabarlar navbati (Telegram bot)', () => {
  it('dars qoldirildi: har bir ota-ona chatiga o\'z tilida; to\'lov — Payme belgisi bilan', async () => {
    const { ctx, sent } = context()
    const outcomes = await deliverOutbox([item(), item({ id: 2, customerId: 'c2', kind: 'payment', payload: { amount: 650_000, provider: 'payme', transaction_id: 't1' } })], ctx)
    expect(outcomes).toEqual([
      { id: 1, done: true, delivered: 2, error: null },
      { id: 2, done: true, delivered: 1, error: null },
    ])
    expect(sent).toEqual([
      { chatId: 77, text: '⚠️ Aziza bugun darsga kelmadi (IELTS — kechki).', lang: 'uz' },
      { chatId: 88, text: '⚠️ Aziza сегодня не пришёл(ла) на урок (IELTS — kechki).', lang: 'ru' },
      { chatId: 99, text: '✅ To\'lov qabul qilindi: 650 000 so\'m (Payme) — Bobur. Rahmat!', lang: 'uz' },
    ])
  })

  it('yuborilmaydi: eskirgan, o\'chirilgan turdagi, savatchadagi o\'quvchi, bekor qilingan va bog\'lanmagan', async () => {
    const { ctx, sent } = context({
      enabled: { absence: true, payment: false },
      stillValid: (i) => i.id !== 4,
      chats: new Map(),
    })
    const outcomes = await deliverOutbox(
      [
        item({ id: 1, createdAt: new Date(NOW - OUTBOX_STALE_MS - 1).toISOString() }),
        item({ id: 2, kind: 'payment', payload: { amount: 1 } }),
        item({ id: 3, customerId: 'trash' }),
        item({ id: 4 }),
        item({ id: 5 }),
      ],
      ctx,
    )
    expect(outcomes.map((o) => [o.id, o.done, o.error])).toEqual([
      [1, true, 'stale'],
      [2, true, 'disabled'],
      [3, true, 'customer'],
      [4, true, 'cancelled'],
      [5, true, 'not-linked'],
    ])
    expect(sent).toHaveLength(0)
  })

  it('bot bloklangan (403) — bog\'lanish uziladi; tarmoq xatosi — qayta urinish, 3-martada to\'xtaydi', async () => {
    const blocked = context({ send: async () => ({ ok: false, status: 403, description: 'Forbidden: bot was blocked by the user' }) })
    expect(await deliverOutbox([item()], blocked.ctx)).toEqual([{ id: 1, done: true, delivered: 0, error: 'blocked' }])
    expect(blocked.unlinked).toEqual([
      ['c1', 77],
      ['c1', 88],
    ])

    const down = context({ send: async () => null })
    expect(await deliverOutbox([item()], down.ctx)).toEqual([{ id: 1, done: false, delivered: 0, error: 'network' }])
    expect((await deliverOutbox([item({ attempts: OUTBOX_MAX_ATTEMPTS - 1 })], down.ctx))[0].done).toBe(true)

    // Bir chatga yetdi, ikkinchisi xato — tayyor hisoblanadi (takror yuborilmaydi)
    const partial = context({ send: async (chatId) => (chatId === 77 ? { ok: true, status: 200, description: '' } : { ok: false, status: 429, description: 'Too Many Requests' }) })
    expect(await deliverOutbox([item()], partial.ctx)).toEqual([{ id: 1, done: true, delivered: 1, error: null }])
  })

  it('qatorni tekshirish (type guard) va boshqa kun — sana bilan', async () => {
    expect(isOutboxItem(item())).toBe(true)
    expect(isOutboxItem({ ...item(), kind: 'sms' })).toBe(false)
    expect(isOutboxItem({ ...item(), payload: null })).toBe(false)
    const { ctx, sent } = context({ chats: new Map([['c1', [{ chatId: 77, lang: 'uz' as Lang }]]]) })
    await deliverOutbox([item({ payload: { group_id: 'g1', date: '2026-11-06' } })], ctx)
    expect(sent[0].text).toBe('⚠️ Aziza 06.11.2026 kuni darsga kelmadi (IELTS — kechki).')
  })
})
