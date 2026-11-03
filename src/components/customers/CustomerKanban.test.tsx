// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_VIEW_KEY } from './CustomerTable'
import { makeCustomer, renderSignedIn } from '../../test/helpers'

const customers = [
  makeCustomer({ id: 'c1', name: 'Aziza Karimova', status: 'new', phone: '+998 90 111 11 11' }),
  makeCustomer({ id: 'c2', name: 'Bobur Aliyev', status: 'new', phone: '+998 90 222 22 22', source: 'telegram' }),
  makeCustomer({ id: 'c3', name: 'Dilnoza Sobirova', status: 'paid', phone: '+998 90 333 33 33' }),
]

async function openKanban() {
  const view = await renderSignedIn({ customers })
  await view.user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
  await view.user.click(await screen.findByRole('button', { name: 'Kanban' }))
  return view
}

const column = (name: string) => screen.getByRole('region', { name })
const storedStatus = (id: string) =>
  (JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ id: string; status: string }>).find((c) => c.id === id)?.status

describe('Kanban (sotuv voronkasi)', () => {
  it('har bosqich ustun, sarlavhada mijozlar soni; kartada ism, telefon, kurs, manba, sana', async () => {
    await openKanban()
    expect(within(column('Yangi')).getByLabelText('2 ta mijoz')).toBeTruthy()
    expect(within(column('Bog\'lanildi')).getByLabelText('0 ta mijoz')).toBeTruthy()
    expect(within(column('To\'lov qildi')).getByLabelText('1 ta mijoz')).toBeTruthy()
    expect(within(column('Bekor qilindi')).getByText('Bu bosqichda mijoz yo\'q')).toBeTruthy()
    const card = within(column('Yangi')).getByRole('article', { name: /Bobur Aliyev/ })
    expect(within(card).getByText('+998 90 222 22 22')).toBeTruthy()
    expect(within(card).getByText(customers[1].course)).toBeTruthy()
    expect(within(card).getByText('Telegram')).toBeTruthy()
    expect(within(card).getByText('01.10.2026')).toBeTruthy()
  })

  it('tanlangan ko\'rinish saqlanadi', async () => {
    const { unmount } = await openKanban()
    expect(localStorage.getItem(CUSTOMER_VIEW_KEY)).toBe('"kanban"')
    unmount()
    const again = await renderSignedIn({ customers })
    await again.user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    expect(await screen.findByRole('region', { name: 'O\'ylayapti' })).toBeTruthy()
  })

  it('kartani sudrab boshqa bosqichga o\'tkazish', async () => {
    await openKanban()
    const card = within(column('Yangi')).getByRole('article', { name: /Aziza Karimova/ })
    const data = new Map<string, string>()
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', dropEffect: '', effectAllowed: '' }
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(column('O\'ylayapti'), { dataTransfer })
    fireEvent.drop(column('O\'ylayapti'), { dataTransfer })
    expect(within(column('O\'ylayapti')).getByRole('article', { name: /Aziza Karimova/ })).toBeTruthy()
    expect(within(column('Yangi')).getByLabelText('1 ta mijoz')).toBeTruthy()
    expect(storedStatus('c1')).toBe('thinking')
  })

  it('klaviatura: bosqich menyusi va Alt + strelka', async () => {
    const { user } = await openKanban()
    await user.click(screen.getByRole('button', { name: 'Bobur Aliyev: bosqichni o\'zgartirish' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Bog\'lanildi' }))
    expect(storedStatus('c2')).toBe('contacted')

    const card = within(column('Bog\'lanildi')).getByRole('article', { name: /Bobur Aliyev/ })
    expect(document.activeElement).toBe(card)
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    expect(storedStatus('c2')).toBe('thinking')
    expect(document.activeElement).toBe(within(column('O\'ylayapti')).getByRole('article', { name: /Bobur Aliyev/ }))
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Bobur Aliyev' })).toBeTruthy()
  })
})
