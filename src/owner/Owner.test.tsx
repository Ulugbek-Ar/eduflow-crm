// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { plain } from '../test/helpers'
import { OwnerConsole } from './OwnerConsole'
import { extendPatch, localTenantsRepository, monthlyRevenue, OWNER_TENANTS_KEY, sampleTenants, tenantDaysLeft } from './tenants'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

const DAY = 86_400_000

describe('Markazlar (hisob-kitob)', () => {
  it('oylik tushum: faqat faol, to\'lovli va muddati o\'tmagan', () => {
    const now = Date.now()
    const tenants = sampleTenants(now)
    // Pro 399 000 + Standart (2 ta faol, muddati o'tmagan) 199 000 × 2; muddati o'tgan va bloklangan kirmaydi
    expect(monthlyRevenue(tenants, now)).toBe(399_000 + 2 * 199_000)
  })

  it('+30 kun: muddati o\'tgan bo\'lsa bugundan, aks holda tugash sanasidan', () => {
    const now = Date.now()
    const [pro, , , , , expired] = sampleTenants(now)
    expect(tenantDaysLeft({ ...pro, ...extendPatch(pro, 30, now) }, now)).toBe(71)
    expect(tenantDaysLeft({ ...expired, ...extendPatch(expired, 30, now) }, now)).toBe(30)
    expect(Math.abs(Date.parse(extendPatch(expired, 30, now).paidUntil ?? '') - (now + 30 * DAY))).toBeLessThan(1000)
  })
})

describe('Sotuvchi paneli', () => {
  it('demo: ko\'rsatkichlar, filtr, tarif almashtirish, uzaytirish va to\'xtatish', async () => {
    const user = userEvent.setup()
    const repo = localTenantsRepository()
    render(<OwnerConsole repo={repo} />)
    expect(await screen.findByText('Demo: namunaviy markazlar')).toBeTruthy()
    const kpis = screen.getByRole('region', { name: 'Umumiy ko\'rsatkichlar' })
    expect(plain(kpis.textContent)).toContain('797 000 so\'m')

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(9)
    await user.selectOptions(screen.getByLabelText('Holat'), 'expiring')
    expect(within(table).getAllByRole('row').map((r) => r.querySelector('strong')?.textContent).filter(Boolean)).toEqual(['English Hub', 'Matematika markazi'])

    await user.selectOptions(screen.getByLabelText('Holat'), 'all')
    const row = within(table).getByText('Zukko Akademiya').closest('tr') as HTMLElement
    await user.selectOptions(within(row).getByLabelText('Zukko Akademiya: tarif'), 'pro')
    expect(await screen.findByText('Zukko Akademiya: tarif o\'zgartirildi')).toBeTruthy()
    await user.click(within(row).getByRole('button', { name: 'Zukko Akademiya: 30 kunga uzaytirish' }))
    await user.click(within(row).getByRole('button', { name: 'To\'xtatish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'To\'xtatish' }))
    expect(await within(row).findByText('Bloklangan')).toBeTruthy()

    const stored = (JSON.parse(localStorage.getItem(OWNER_TENANTS_KEY) ?? '[]') as Array<{ name: string; plan: string; status: string; paidUntil: string }>).find((t) => t.name === 'Zukko Akademiya')
    expect(stored).toMatchObject({ plan: 'pro', status: 'blocked' })
    expect(tenantDaysLeft(stored as never)).toBe(48)
  })
})
