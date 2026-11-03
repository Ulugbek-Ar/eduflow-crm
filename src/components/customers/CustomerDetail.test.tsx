// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, renderSignedIn } from '../../test/helpers'

const stored = () => JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ status: string; paidAt?: string }>

async function openDetail(data: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
  const jadval = await screen.findByRole('button', { name: 'Jadval' })
  await view.user.click(jadval)
  await view.user.click(await screen.findByRole('button', { name: 'Aziza Karimova kartasi' }))
  return { ...view, drawer: await screen.findByRole('dialog', { name: 'Aziza Karimova' }) }
}

describe('Mijoz kartasi: bosqich va o\'qish muddati', () => {
  it('bosqich kartaning o\'zida o\'zgaradi; "To\'lov qildi" ga o\'tilganda sana yoziladi, chiqilganda o\'chadi', async () => {
    const { user, drawer } = await openDetail({ customers: [makeCustomer({ status: 'thinking' })] })
    await user.selectOptions(within(drawer).getByLabelText('Bosqichni o\'zgartirish'), 'paid')
    expect(stored()[0].status).toBe('paid')
    expect(stored()[0].paidAt?.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
    expect(within(drawer).getByText('To\'lov qildi', { selector: 'dt' })).toBeTruthy()
    const [ielts] = createMockCourses()
    expect(within(drawer).getByText(`1-oy / ${ielts.durationMonths}`)).toBeTruthy()

    await user.selectOptions(within(drawer).getByLabelText('Bosqichni o\'zgartirish'), 'cancelled')
    expect(stored()[0]).not.toHaveProperty('paidAt')
  })

  it('kurs muddati tugagan bo\'lsa "Tugagan" va qarz yo\'q', async () => {
    const longAgo = new Date()
    longAgo.setMonth(longAgo.getMonth() - 12)
    const { drawer } = await openDetail({ customers: [makeCustomer({ status: 'paid', paidAt: longAgo.toISOString() })] })
    expect(within(drawer).getByText('Tugagan (6 oy)')).toBeTruthy()
    expect(within(drawer).queryByText(/Qarz/)).toBeNull()
  })
})
