// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setDemoMode } from '../../services/storage.service'
import { makeCustomer, makeTransaction, renderApp, renderSignedIn, seedCredentials, seedSession } from '../../test/helpers'

describe('Birinchi ishga tushish va demo rejim', () => {
  it('haqiqiy bazadagi namunaviy ma\'lumot belgisi: tasdiqlangach tozalanadi', async () => {
    await seedCredentials()
    seedSession()
    const { unmount } = await renderSignedIn({ customers: [makeCustomer()], transactions: [makeTransaction()] })
    unmount()
    setDemoMode(true)
    const { user } = renderApp()

    expect(await screen.findByText('Demo ma\'lumot')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Demo ma'lumotni tozalash/ }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Demo ma\'lumotni tozalash' })
    await user.click(within(confirm).getByRole('button', { name: 'Tozalash' }))

    expect(screen.queryByText('Demo ma\'lumot')).toBeNull()
    expect(localStorage.getItem('apex:customers')).toBe('[]')
    expect(localStorage.getItem('apex:demo')).toBe('false')
  })

  it('sozlash ustasidan "Keyinroq sozlayman" — demo belgisi yo\'q, baza bo\'sh', async () => {
    await seedCredentials()
    seedSession()
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: 'Keyinroq sozlayman' }))
    expect(await screen.findByRole('heading', { name: 'Umumiy ko\'rinish' })).toBeTruthy()
    expect(screen.queryByText('Demo ma\'lumot')).toBeNull()
    expect(localStorage.getItem('apex:customers')).toBe('[]')
  })
})
