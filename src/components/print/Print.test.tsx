// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'

const course = { id: 'k1', name: 'Ingliz tili', type: 'course' as const, durationMonths: 6, monthlyPrice: 650_000, activeGroups: 1, status: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }

describe('To\'lov cheki', () => {
  it('to\'lov yozilgach toast\'dagi "Chek" — summa so\'z bilan va kim qabul qilgani', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer({ course: 'Ingliz tili' })], courses: [course] })
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await user.click((await screen.findAllByRole('button', { name: 'To\'lov qabul qilish' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'To\'lov qabul qilish' })
    await user.type(within(dialog).getByLabelText(/Summa/), '650000')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    const toasts = screen.getByRole('region', { name: 'Bildirishnomalar' })
    await user.click(await within(toasts).findByRole('button', { name: 'Chek' }))

    const receipt = await screen.findByRole('article', { name: 'Chek' })
    expect(plain(receipt.textContent)).toContain('650 000 so\'m')
    expect(receipt.textContent).toContain('Olti yuz ellik ming so\'m')
    expect(receipt.textContent).toContain('Qabul qildi: Dilshod Karimov')
    expect(receipt.textContent).toMatch(/№ \d{6}-[A-Z0-9]{4}/)
  })

  it('jurnaldagi chek: qog\'oz o\'lchami eslab qolinadi, chop etish faqat chekni chiqaradi', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { user } = await renderSignedIn({
      customers: [makeCustomer({ course: 'Ingliz tili', status: 'paid', paidAt: new Date().toISOString() })],
      transactions: [makeTransaction({ amount: 300_000 })],
      courses: [course],
    })
    await user.click(screen.getByRole('button', { name: 'Moliya va kassa' }))
    await user.click(await screen.findByRole('button', { name: 'Chek' }))
    const modal = await screen.findByRole('dialog', { name: 'To\'lov cheki' })
    // Joriy oy: 650 000 kutilgan, 300 000 to'langan
    expect(plain(within(modal).getByText(/Qolgan qarz/).textContent)).toBe('Qolgan qarz: 350 000 so\'m')

    await user.click(within(modal).getByRole('button', { name: 'A4' }))
    expect(localStorage.getItem('apex:receipt-size')).toBe('"a4"')
    await user.click(within(modal).getByRole('button', { name: 'Chop etish' }))
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.body.classList.contains('is-printing')).toBe(true)
    const root = document.querySelector('.print-root') as HTMLElement
    expect(root.className).toContain('print-a4')
    expect(root.querySelector('style')?.textContent).toContain('size: A4')
    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(document.querySelector('.print-root')).toBeNull()
    expect(document.body.classList.contains('is-printing')).toBe(false)
    print.mockRestore()
  })
})

describe('Mijoz kartasini chop etish', () => {
  it('A4: ma\'lumotlar, qarz va to\'lovlar tarixi', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { user } = await renderSignedIn({
      customers: [makeCustomer({ course: 'Ingliz tili', status: 'paid', paidAt: new Date().toISOString() })],
      transactions: [makeTransaction({ amount: 300_000 })],
      courses: [course],
    })
    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Aziza Karimova kartasi' }))
    const drawer = await screen.findByRole('dialog', { name: 'Aziza Karimova' })
    await user.click(within(drawer).getByRole('button', { name: 'Chop etish' }))
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
    const card = document.querySelector('.print-root .print-card') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('Mijoz kartasi')
    expect(plain(card.textContent)).toContain('Qarz350 000 so\'m')
    expect(card.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(card.textContent).toContain('Tayyorladi: Dilshod Karimov')
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })
})
