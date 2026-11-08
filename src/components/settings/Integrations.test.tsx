// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockCourses, DEFAULT_SETTINGS } from '../../constants/mockData'
import { makeCustomer, makeTransaction, renderSignedIn } from '../../test/helpers'

// Bulutli rejim taqlidi: markaz id'si va "integrations" Edge Function'i (server javoblari)
const server = vi.hoisted(() => ({
  status: {} as Record<string, Record<string, unknown>>,
  calls: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../hooks/useCloudOrg', () => ({ useCloudOrgId: () => '11111111-2222-3333-4444-555555555555' }))
vi.mock('../../data/integrations', () => ({
  integrationStatus: async () => server.status,
  functionUrl: (name: string, org: string) => `https://loyiha.supabase.co/functions/v1/${name}?org=${org}`,
  callIntegrations: async (body: Record<string, unknown>) => {
    server.calls.push(body)
    const secret = (body.secret ?? {}) as Record<string, string>
    if (body.action === 'save' && body.provider === 'payme' && (secret.key ?? '').length < 10) return { ok: false, error: 'invalid', field: 'key' }
    if (body.action === 'save') server.status[String(body.provider)] = { configured: true, key: '…alit' }
    if (body.action === 'remove') delete server.status[String(body.provider)]
    return { ok: true, data: {} }
  },
}))

const storedSettings = () => JSON.parse(localStorage.getItem('apex:settings') ?? '{}') as Record<string, unknown>
const PAYME = '5e730e8e0b852a417aa49ceb'

beforeEach(() => {
  server.status = {}
  server.calls = []
})

describe('Integratsiyalar (bulutli rejim)', () => {
  it('Payme: endpoint manzili, server xatosi maydon bilan, ulash — merchant id sozlamaga, kalit faqat serverga', async () => {
    const { user } = await renderSignedIn()
    await user.click(screen.getByRole('button', { name: 'Sozlamalar' }))
    const card = await screen.findByRole('region', { name: 'Onlayn to\'lov (Payme, Click)' })
    const payme = await within(card).findByRole('region', { name: 'Payme' })
    expect(within(payme).getByText('Ulanmagan')).toBeTruthy()
    expect((within(payme).getByLabelText('Endpoint manzili (Payme kabinetiga kiriting)') as HTMLInputElement).value).toBe(
      'https://loyiha.supabase.co/functions/v1/payme?org=11111111-2222-3333-4444-555555555555',
    )

    await user.type(within(payme).getByLabelText('Merchant ID (kassa id)'), 'xato')
    await user.click(within(payme).getByRole('button', { name: 'Payme\'ni ulash' }))
    expect(within(payme).getByRole('alert').textContent).toContain('Merchant ID — 24 belgili kod')

    await user.clear(within(payme).getByLabelText('Merchant ID (kassa id)'))
    await user.type(within(payme).getByLabelText('Merchant ID (kassa id)'), PAYME.toUpperCase())
    await user.type(within(payme).getByLabelText('Kassa kaliti'), 'qisqa')
    await user.click(within(payme).getByRole('button', { name: 'Payme\'ni ulash' }))
    expect((await within(payme).findByRole('alert')).textContent).toContain('Kassa kaliti 10–200 belgi')
    expect(storedSettings().paymeMerchantId).toBe('')

    await user.clear(within(payme).getByLabelText('Kassa kaliti'))
    await user.type(within(payme).getByLabelText('Kassa kaliti'), 'juda-maxfiy-kalit')
    await user.click(within(payme).getByRole('button', { name: 'Payme\'ni ulash' }))
    expect(await within(payme).findByText('Ulangan')).toBeTruthy()
    expect(server.calls.at(-1)).toEqual({ action: 'save', provider: 'payme', secret: { key: 'juda-maxfiy-kalit', testKey: '', ikpu: '' } })
    expect(storedSettings().paymeMerchantId).toBe(PAYME)
    // Kalit brauzer xotirasiga yozilmaydi
    expect(JSON.stringify(localStorage)).not.toContain('juda-maxfiy-kalit')
  })

  it('qarz eslatmasida to\'lov havolasi (Payme): telefon va qarz summasi; belgini olsa — havolasiz', async () => {
    const [ielts] = createMockCourses()
    const { user } = await renderSignedIn({
      customers: [makeCustomer({ course: ielts.name, status: 'paid' })],
      transactions: [makeTransaction({ id: 't1', amount: 150_000, date: new Date().toISOString() })],
      settings: { ...DEFAULT_SETTINGS, paymeMerchantId: PAYME },
    })
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await user.click(await screen.findByRole('button', { name: 'Aziza Karimova: eslatma' }))
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov eslatmasi: Aziza Karimova' })
    const text = () => (within(dialog).getByLabelText('Xabar matni') as HTMLTextAreaElement).value
    const link = /https:\/\/checkout\.paycom\.uz\/(\S+)/.exec(text())
    expect(link).not.toBeNull()
    expect(atob(link?.[1] ?? '')).toBe(`m=${PAYME};ac.phone=901234567;a=50000000;l=uz`)
    expect(text()).toContain('To\'lov havolasi:')
    await user.click(within(dialog).getByRole('checkbox', { name: /To'lov havolasini qo'shish/ }))
    expect(text()).not.toContain('checkout.paycom.uz')
  })
})
