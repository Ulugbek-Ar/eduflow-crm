// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockCourses, DEFAULT_SETTINGS } from '../../constants/mockData'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

// Bulutli rejim taqlidi: "integrations" Edge Function'i va SMS jurnali
const server = vi.hoisted(() => ({
  status: {} as Record<string, Record<string, unknown>>,
  calls: [] as Array<Record<string, unknown>>,
  log: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../hooks/useCloudOrg', () => ({ useCloudOrgId: () => '11111111-2222-3333-4444-555555555555' }))
vi.mock('../../data/integrations', () => ({
  integrationStatus: async () => server.status,
  recentSms: async () => server.log,
  functionUrl: (name: string) => `https://loyiha.supabase.co/functions/v1/${name}`,
  callIntegrations: async (body: Record<string, unknown>) => {
    server.calls.push(body)
    const secret = (body.secret ?? {}) as Record<string, string>
    if (body.action === 'save' && body.provider === 'eskiz') {
      if (secret.password !== 'togri-parol') return { ok: false, error: 'invalid', field: 'password' }
      server.status.eskiz = { configured: true, email: secret.email, from: secret.from }
      return { ok: true, data: {} }
    }
    if (body.action === 'sms.test') {
      server.log.unshift({ id: 1, customerId: null, phone: '998901234567', text: String(body.text), kind: 'test', status: 'sent', error: null, createdAt: new Date().toISOString() })
      return { ok: true, data: { id: 'sms-1' } }
    }
    if (body.action === 'sms.send') return { ok: true, data: { sent: (body.messages as unknown[]).length, failed: 0, failures: [] } }
    return { ok: true, data: {} }
  },
}))

const storedSettings = () => JSON.parse(localStorage.getItem('apex:settings') ?? '{}') as Record<string, unknown>

beforeEach(() => {
  server.status = {}
  server.calls = []
  server.log = []
})

describe('SMS (Eskiz) — bulutli rejim', () => {
  it('ulash (noto\'g\'ri parol — xato), avtomatik eslatma jadvali, sinov SMS va jurnal', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const card = await screen.findByRole('region', { name: 'SMS (Eskiz)' })
    const eskiz = await within(card).findByRole('region', { name: 'Eskiz' })
    expect(within(eskiz).getByText('Ulanmagan')).toBeTruthy()

    await user.type(within(eskiz).getByLabelText('Eskiz email'), 'markaz@mail.uz')
    await user.type(within(eskiz).getByLabelText('Eskiz paroli'), 'xato')
    await user.click(within(eskiz).getByRole('button', { name: 'Eskiz\'ni ulash' }))
    expect((await within(card).findByRole('alert')).textContent).toContain('Eskiz login yoki paroli noto\'g\'ri')

    await user.clear(within(eskiz).getByLabelText('Eskiz paroli'))
    await user.type(within(eskiz).getByLabelText('Eskiz paroli'), 'togri-parol')
    await user.click(within(eskiz).getByRole('button', { name: 'Eskiz\'ni ulash' }))
    expect(await within(eskiz).findByText('Ulangan')).toBeTruthy()
    expect(server.calls.at(-1)).toMatchObject({ action: 'save', provider: 'eskiz', secret: { email: 'markaz@mail.uz', password: 'togri-parol', from: '4546' } })
    expect(storedSettings().smsSender).toBe('4546')
    expect(JSON.stringify(localStorage)).not.toContain('togri-parol')

    // Avtomatik eslatma: yoqish, 3 kundan kam bo'lmaydi, til
    const auto = await within(card).findByRole('region', { name: 'Avtomatik eslatma' })
    await user.click(within(auto).getByRole('checkbox', { name: /Har kuni ertalab qarzdorlarga SMS yuborish/ }))
    await user.clear(within(auto).getByLabelText('Bir o\'quvchiga necha kunda bir marta'))
    await user.type(within(auto).getByLabelText('Bir o\'quvchiga necha kunda bir marta'), '1')
    await user.selectOptions(within(auto).getByLabelText('Xabar tili'), 'ru')
    await user.click(within(auto).getByRole('button', { name: 'Saqlash' }))
    expect(storedSettings()).toMatchObject({ autoReminders: true, autoRemindEveryDays: 3, autoRemindLang: 'ru' })

    const test = within(card).getByRole('region', { name: 'Sinov SMS' })
    await user.type(within(test).getByLabelText('Telefon'), '901234567')
    await user.click(within(test).getByRole('button', { name: 'Sinov SMS yuborish' }))
    expect(server.calls.at(-1)).toEqual({ action: 'sms.test', phone: '+998 90 123 45 67', text: 'This is test from Eskiz' })
    const log = within(card).getByRole('region', { name: 'SMS jurnali' })
    expect(await within(log).findByText('+998 90 123 45 67')).toBeTruthy()
    expect(within(log).getByText('Yuborildi')).toBeTruthy()
  })

  it('eslatma oynasidan SMS: server o\'quvchi id\'si va tayyor matn bilan yuboradi', async () => {
    const [ielts] = createMockCourses()
    const { user } = await renderSignedIn({
      customers: [makeCustomer({ course: ielts.name, status: 'paid' }), makeCustomer({ id: 'c2', name: 'Bobur Aliyev', phone: '+998 93 111 22 33', course: ielts.name, status: 'paid' })],
      transactions: [makeTransaction({ id: 't1', amount: 150_000, date: new Date().toISOString() })],
      settings: { ...DEFAULT_SETTINGS, smsSender: '4546' },
    })
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Hammasini belgilash' }))
    await user.click(screen.getByRole('button', { name: 'Tanlanganlarga eslatma (2)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Eslatma: 2 ta qarzdor' })
    await user.click(within(dialog).getByRole('button', { name: 'SMS yuborish (2)' }))
    expect(await within(dialog).findByText('2 ta SMS yuborildi')).toBeTruthy()
    const call = server.calls.at(-1) as { action: string; messages: Array<{ customerId: string; text: string }> }
    expect(call.action).toBe('sms.send')
    expect(call.messages.map((m) => m.customerId).sort()).toEqual(['c1', 'c2'])
    expect(call.messages.find((m) => m.customerId === 'c1')?.text).toContain('Assalomu alaykum, Aziza Karimova!')
  })
})
