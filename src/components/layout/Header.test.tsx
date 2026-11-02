// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, seedCredentials, seedSession } from '../../test/helpers'

describe('Birinchi ishga tushish va demo rejim', () => {
  it('"Demo ma\'lumot" tanlansa belgi chiqadi, tasdiqlangach tozalanadi', async () => {
    await seedCredentials()
    seedSession()
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /Demo ma'lumot bilan tanishish/ }))

    expect(await screen.findByText('Demo ma\'lumot')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('apex:customers') ?? '[]')).toHaveLength(15)

    await user.click(screen.getByRole('button', { name: /Demo ma'lumotni tozalash/ }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Demo ma\'lumotni tozalash' })
    await user.click(within(confirm).getByRole('button', { name: 'Tozalash' }))

    expect(screen.queryByText('Demo ma\'lumot')).toBeNull()
    expect(localStorage.getItem('apex:customers')).toBe('[]')
    expect(localStorage.getItem('apex:demo')).toBe('false')
  })

  it('"Bo\'sh boshlash" — demo belgisi yo\'q, baza bo\'sh', async () => {
    await seedCredentials()
    seedSession()
    const { user } = renderApp()
    await user.click(await screen.findByRole('button', { name: /Bo'sh boshlash/ }))
    expect(await screen.findByRole('heading', { name: 'Umumiy ko\'rinish' })).toBeTruthy()
    expect(screen.queryByText('Demo ma\'lumot')).toBeNull()
    expect(localStorage.getItem('apex:customers')).toBe('[]')
  })
})
