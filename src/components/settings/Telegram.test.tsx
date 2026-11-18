// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockCourses, DEFAULT_SETTINGS } from '../../constants/mockData'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

// Bulutli rejim taqlidi: "integrations" Edge Function'i va telegram_links jadvali
const server = vi.hoisted(() => ({
  status: {} as Record<string, Record<string, unknown>>,
  calls: [] as Array<Record<string, unknown>>,
  links: {} as Record<string, number>,
}))

const TOKEN = '123456789:AAFz-tO_kEn_Uchun_Yetarli_Uzun_Satr'

vi.mock('../../hooks/useCloudOrg', () => ({ useCloudOrgId: () => '11111111-2222-3333-4444-555555555555' }))
vi.mock('../../data/integrations', () => ({
  integrationStatus: async () => server.status,
  recentSms: async () => [],
  functionUrl: (name: string) => `https://loyiha.supabase.co/functions/v1/${name}`,
  telegramLinkCount: async (customerId: string) => server.links[customerId] ?? 0,
  callIntegrations: async (body: Record<string, unknown>) => {
    server.calls.push(body)
    const secret = (body.secret ?? {}) as Record<string, string>
    if (body.action === 'save' && body.provider === 'telegram') {
      if (secret.token !== TOKEN) return { ok: false, error: 'invalid', field: 'token' }
      server.status.telegram = { configured: true, token: '…Satr', username: 'BilimPlus_bot' }
      return { ok: true, data: { ok: true, status: server.status.telegram } }
    }
    if (body.action === 'remove') delete server.status[String(body.provider)]
    if (body.action === 'telegram.link') return { ok: true, data: { link: `https://t.me/BilimPlus_bot?start=0123456789ab${String(body.customerId)}` } }
    if (body.action === 'telegram.unlink') server.links[String(body.customerId)] = 0
    if (body.action === 'telegram.send') {
      const messages = body.messages as Array<{ customerId: string }>
      const sent = messages.filter((m) => (server.links[m.customerId] ?? 0) > 0).length
      return { ok: true, data: { sent, failed: 0, notLinked: messages.length - sent } }
    }
    return { ok: true, data: {} }
  },
}))

const storedSettings = () => JSON.parse(localStorage.getItem('apex:settings') ?? '{}') as Record<string, unknown>
const BOT = { ...DEFAULT_SETTINGS, telegramBot: 'BilimPlus_bot' }

beforeEach(() => {
  server.status = {}
  server.calls = []
  server.links = {}
})

describe('Telegram bot (bulutli rejim)', () => {
  it('ulash: noto\'g\'ri token — xato; to\'g\'ri — @username, token brauzerda saqlanmaydi; xabar turlari; o\'chirish', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const card = await screen.findByRole('region', { name: 'Telegram bot (ota-onalar uchun)' })
    const block = await within(card).findByRole('region', { name: 'Telegram bot' })
    expect(await within(block).findByText('Ulanmagan')).toBeTruthy()
    expect(within(block).getByText(/@BotFather'ni oching/)).toBeTruthy()

    await user.type(within(block).getByLabelText('Bot tokeni'), '123:xato')
    await user.click(within(block).getByRole('button', { name: 'Botni ulash' }))
    expect((await within(card).findByRole('alert')).textContent).toContain('Token noto\'g\'ri')

    await user.clear(within(block).getByLabelText('Bot tokeni'))
    await user.type(within(block).getByLabelText('Bot tokeni'), TOKEN)
    await user.click(within(block).getByRole('button', { name: 'Botni ulash' }))
    expect(await within(block).findByText('Ulangan')).toBeTruthy()
    expect(within(block).getByRole('link', { name: '@BilimPlus_bot' }).getAttribute('href')).toBe('https://t.me/BilimPlus_bot')
    expect(storedSettings().telegramBot).toBe('BilimPlus_bot')
    expect(JSON.stringify(localStorage)).not.toContain(TOKEN)

    // Xabar turlari: dars qoldirilganda — o'chiriladi, to'lov — qoladi
    const alerts = within(card).getByRole('region', { name: 'Ota-onaga xabarlar' })
    await user.click(within(alerts).getByRole('checkbox', { name: /Dars qoldirilganda/ }))
    await user.click(within(alerts).getByRole('button', { name: 'Saqlash' }))
    expect(storedSettings()).toMatchObject({ botAbsenceAlerts: false, botPaymentAlerts: true })
    expect(within(card).getByRole('region', { name: 'Ota-ona qanday ulanadi' }).textContent).toContain('Ulash havolasi')

    // Avtomatik eslatma: faqat bot ulangan — kanal shu
    const auto = screen.getByRole('region', { name: 'Avtomatik eslatma' })
    expect(within(auto).getByText('Faqat ota-onasi Telegram botga ulangan o\'quvchilarga (SMS ulanmagan)')).toBeTruthy()
    await user.click(within(auto).getByRole('checkbox', { name: /Har kuni ertalab qarzdorlarga eslatma yuborish/ }))
    await user.click(within(auto).getByRole('button', { name: 'Saqlash' }))
    expect(storedSettings().autoReminders).toBe(true)

    await user.click(within(block).getByRole('button', { name: 'O\'chirish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O\'chirish' }))
    expect(await within(block).findByText('Ulanmagan')).toBeTruthy()
    expect(server.calls.at(-1)).toEqual({ action: 'remove', provider: 'telegram' })
    // SMS ham ulanmagan — avtomatik eslatma o'chadi
    expect(storedSettings()).toMatchObject({ telegramBot: '', autoReminders: false })
    expect(within(auto).getByText(/Avval SMS \(Eskiz\) yoki Telegram botni ulang/)).toBeTruthy()
  })

  it('o\'quvchi kartasi: ulash havolasi (nusxa), ulangan bo\'lsa — botdan uzish', async () => {
    server.links = { c1: 1 }
    const { user } = await renderSignedIn({ customers: [makeCustomer({ status: 'paid' })], settings: BOT })
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Jadval' }))
    await user.click(await screen.findByRole('button', { name: 'Aziza Karimova kartasi' }))
    const drawer = await screen.findByRole('dialog', { name: 'Aziza Karimova' })
    const section = await within(drawer).findByRole('region', { name: 'Ota-ona Telegram\'i' })
    expect(await within(section).findByText('Botga ulangan: 1 ta chat')).toBeTruthy()
    expect(section.textContent).toContain('@BilimPlus_bot')

    await user.click(within(section).getByRole('button', { name: 'Ulash havolasi' }))
    const field = (await within(section).findByLabelText('Ulash havolasi (ota-onaga yuboring)')) as HTMLInputElement
    expect(field.value).toBe('https://t.me/BilimPlus_bot?start=0123456789abc1')
    expect(server.calls.at(-1)).toEqual({ action: 'telegram.link', customerId: 'c1' })

    await user.click(within(section).getByRole('button', { name: 'Botdan uzish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Uzish' }))
    expect(await within(section).findByText('Hali ulanmagan')).toBeTruthy()
    expect(server.calls.at(-1)).toEqual({ action: 'telegram.unlink', customerId: 'c1' })
  })

  it('bot ulanmagan yoki lokal sozlamada kartada blok yo\'q', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer({ status: 'paid' })] })
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Jadval' }))
    await user.click(await screen.findByRole('button', { name: 'Aziza Karimova kartasi' }))
    const drawer = await screen.findByRole('dialog', { name: 'Aziza Karimova' })
    expect(within(drawer).queryByRole('region', { name: 'Ota-ona Telegram\'i' })).toBeNull()
  })

  it('eslatma oynasidan bot orqali: bog\'langanlarga yuboriladi, qolganlari aytiladi', async () => {
    server.links = { c1: 1 }
    const [ielts] = createMockCourses()
    const { user } = await renderSignedIn({
      customers: [makeCustomer({ course: ielts.name, status: 'paid' }), makeCustomer({ id: 'c2', name: 'Bobur Aliyev', phone: '+998 93 111 22 33', course: ielts.name, status: 'paid' })],
      transactions: [makeTransaction({ id: 't1', amount: 150_000, date: new Date().toISOString() })],
      settings: BOT,
    })
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Hammasini belgilash' }))
    await user.click(screen.getByRole('button', { name: 'Tanlanganlarga eslatma (2)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Eslatma: 2 ta qarzdor' })
    expect(within(dialog).queryByRole('button', { name: /SMS yuborish/ })).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Bot orqali ota-onalarga (2)' }))
    expect(await within(dialog).findByText('Bot orqali yuborildi: 1 · ota-onasi botga ulanmagan: 1')).toBeTruthy()
    const call = server.calls.at(-1) as { action: string; messages: Array<{ customerId: string; text: string }> }
    expect(call.action).toBe('telegram.send')
    expect(call.messages.find((m) => m.customerId === 'c2')?.text).toContain('Bobur Aliyev')
  })
})
