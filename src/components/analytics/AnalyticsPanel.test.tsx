// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeCustomer, makeTransaction, plain, renderSignedIn } from '../../test/helpers'

const today = new Date().toISOString()

async function openAnalytics(data: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Tahlil va hisobotlar' }))
  await screen.findByRole('region', { name: 'Manbalar samaradorligi' })
  return view
}

const data = {
  customers: [
    makeCustomer({ id: 'a', source: 'instagram', status: 'paid', createdAt: today, phone: '+998 90 000 00 01' }),
    makeCustomer({ id: 'b', source: 'instagram', status: 'new', createdAt: today, phone: '+998 90 000 00 02' }),
  ],
  transactions: [
    makeTransaction({ id: 't1', customerId: 'a', amount: 600_000, date: today }),
    makeTransaction({ id: 't2', customerId: 'a', amount: 200_000, date: today }),
    makeTransaction({
      id: 'm1',
      type: 'expense',
      category: 'marketing',
      source: 'instagram',
      customerId: undefined,
      customerName: undefined,
      amount: 200_000,
      date: today,
      note: '=HYPERLINK("x")',
    }),
  ],
}

describe('Tahlil va hisobotlar', () => {
  it('O\'rtacha chek va manbalar jadvali (chiqim 0 bo\'lsa "—")', async () => {
    await openAnalytics(data)
    const kpis = screen.getByRole('region', { name: /Tahlil ko'rsatkichlari/ })
    expect(plain(within(kpis).getByRole('heading', { name: 'O\'rtacha chek (AOV)' }).nextElementSibling?.textContent)).toBe('400 000 so\'m')

    const table = screen.getByRole('table', { name: 'Manbalar samaradorligi' })
    const cells = (name: string) => within(within(table).getByText(name).closest('tr') as HTMLElement).getAllByRole('cell').slice(1).map((c) => plain(c.textContent))
    // Lidlar, To'lov qildi, Konversiya, Chiqim, CPL, ROI
    expect(cells('Instagram')).toEqual(['2', '1', '50,0%', '200 000 so\'m', '100 000 so\'m', '+300,0%'])
    expect(cells('Telegram')).toEqual(['0', '0', '—', '0 so\'m', '—', '—'])
  })

  it('4 xil hisobot CSV va Excel ko\'rinishida yuklanadi, CSV injection himoyasi saqlanadi', async () => {
    const files: Array<{ name: string; blob: Blob }> = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      files.push({ name: '', blob: blob as Blob })
      return 'blob:test'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      files[files.length - 1].name = this.download
    })
    const { user } = await openAnalytics(data)
    for (const title of ['Mijozlar', 'Tranzaksiyalar', 'Qarzdorlar', 'Manbalar hisoboti']) {
      await user.click(screen.getByRole('button', { name: `${title} — CSV` }))
    }
    await user.click(screen.getByRole('button', { name: 'Manbalar hisoboti — Excel' }))
    expect(files.map((f) => f.name.replace(/-\d{4}-\d{2}-\d{2}/, ''))).toEqual([
      'eduflow-mijozlar.csv',
      'eduflow-tranzaksiyalar.csv',
      'eduflow-qarzdorlar.csv',
      'eduflow-manbalar.csv',
      'eduflow-manbalar.xls',
    ])
    const transactionsCsv = await files[1].blob.text()
    expect(transactionsCsv).toContain('\'=HYPERLINK')
    const sourcesCsv = await files[3].blob.text()
    expect(sourcesCsv.split('\r\n')[0]).toContain('Manba;Lidlar;To\'lov qildi;Konversiya, %;Marketing chiqimi;CPL;Kirim;ROI, %')
    expect(sourcesCsv).toContain('Instagram;2;1;50;200000;100000;800000;300')
    // Chiqim 0 bo'lgan manbada CPL va ROI bo'sh katak
    expect(sourcesCsv).toContain('Telegram;0;0;;0;;0;')
  })
})

describe('Umumiy CPL va manbasiz marketing chiqimi', () => {
  it('umumiy CPL barcha marketing chiqimidan; manbasiz chiqim alohida ko\'rsatiladi', async () => {
    await openAnalytics({
      customers: data.customers,
      transactions: [
        ...data.transactions,
        makeTransaction({ id: 'm2', type: 'expense', category: 'marketing', customerId: undefined, customerName: undefined, amount: 100_000, date: today }),
      ],
    })
    const kpis = screen.getByRole('region', { name: /Tahlil ko'rsatkichlari/ })
    // (200 000 + 100 000) / 2 ta lid
    expect(plain(within(kpis).getByText(/Umumiy CPL/).textContent)).toBe('Umumiy CPL: 150 000 so\'m')
    expect(plain(screen.getByText(/Manbasi ko'rsatilmagan marketing chiqimi/).textContent)).toContain('100 000 so\'m')
  })
})

describe('Voronka va kurslar bo\'yicha tushum', () => {
  it('davr lidlari bosqichlar bo\'yicha va kurslar tushumi', async () => {
    await openAnalytics(data)
    const funnel = screen.getByRole('region', { name: 'Sotuv voronkasi' })
    expect(within(funnel).getByRole('progressbar', { name: 'To\'lov qildi ulushi' }).getAttribute('aria-valuenow')).toBe('50')
    expect(within(funnel).getByRole('progressbar', { name: 'Yangi ulushi' }).getAttribute('aria-valuenow')).toBe('50')
    const table = screen.getByRole('table', { name: 'Kurslar bo\'yicha tushum' })
    const first = within(table).getAllByRole('row')[1]
    expect(within(first).getAllByRole('cell').map((c) => plain(c.textContent))).toEqual(['Ingliz tili (IELTS)', '1', '800 000 so\'m', '650 000 so\'m'])
  })
})
