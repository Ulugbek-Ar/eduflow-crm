// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMockCourses } from '../../constants/mockData'
import { makeCustomer, plain, renderSignedIn } from '../../test/helpers'

const storedCourses = () => JSON.parse(localStorage.getItem('apex:courses') ?? '[]') as Array<{ name: string; status: string; monthlyPrice: number }>
const storedCustomers = () => JSON.parse(localStorage.getItem('apex:customers') ?? '[]') as Array<{ course: string }>

async function openCourses(data?: Parameters<typeof renderSignedIn>[0]) {
  const view = await renderSignedIn(data)
  await view.user.click(screen.getByRole('button', { name: 'Kurslar va xizmatlar' }))
  await screen.findByRole('region', { name: 'Kurslar va xizmatlar' })
  return view
}

const row = (name: string) => screen.getByRole('button', { name }).closest('tr') as HTMLElement

describe('Kurslar va xizmatlar', () => {
  it('ro\'yxatda talabalar, lidlar va oylik kutilayotgan tushum', async () => {
    const [ielts] = createMockCourses()
    await openCourses({
      customers: [
        makeCustomer({ id: 'a', course: ielts.name, status: 'paid', phone: '+998 90 000 00 01' }),
        makeCustomer({ id: 'b', course: ielts.name, status: 'paid', phone: '+998 90 000 00 02' }),
        makeCustomer({ id: 'c', course: ielts.name, status: 'new', phone: '+998 90 000 00 03' }),
      ],
    })
    const tr = row(ielts.name)
    expect(within(tr).getByText('6 oy')).toBeTruthy()
    expect(plain(within(tr).getByText(/650 000/).textContent)).toBe('650 000 so\'m')
    const cells = within(tr).getAllByRole('cell').map((td) => plain(td.textContent))
    expect(cells).toContain('2') // talabalar
    expect(cells).toContain('3') // lidlar
    expect(cells).toContain('1 300 000 so\'m')
    expect(plain(screen.getByText('Oylik kutilayotgan tushum').nextElementSibling?.textContent)).toBe('1 300 000 so\'m')
    // Arxivdagi kurs "Faol" filtrida ko'rinmaydi
    expect(screen.queryByRole('button', { name: 'Koreys tili' })).toBeNull()
  })

  it('yangi kurs qo\'shiladi va mijoz formasida tanlanadi', async () => {
    const { user } = await openCourses()
    await user.click(screen.getByRole('button', { name: 'Yangi kurs' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi kurs yoki xizmat' })
    await user.type(within(dialog).getByLabelText(/Nomi/), 'Koreys tili 2')
    await user.clear(within(dialog).getByLabelText(/Davomiyligi/))
    await user.type(within(dialog).getByLabelText(/Davomiyligi/), '9')
    await user.type(within(dialog).getByLabelText('Oylik narxi'), '700000')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    expect(storedCourses().at(-1)).toMatchObject({ name: 'Koreys tili 2', monthlyPrice: 700_000, status: 'active' })

    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    await user.click(await screen.findByRole('button', { name: 'Yangi mijoz' }))
    const form = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
    expect(within(within(form).getByLabelText('Kurs / xizmat')).getByRole('option', { name: 'Koreys tili 2' })).toBeTruthy()
  })

  it('takroriy nom rad etiladi', async () => {
    const { user } = await openCourses()
    await user.click(screen.getByRole('button', { name: 'Yangi kurs' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi kurs yoki xizmat' })
    await user.type(within(dialog).getByLabelText(/Nomi/), 'rus tili')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    expect(within(dialog).getByText('Bu nomdagi kurs yoki xizmat bor')).toBeTruthy()
  })

  it('nom o\'zgarsa mijozlardagi kurs nomi ham yangilanadi', async () => {
    const { user } = await openCourses({ customers: [makeCustomer({ course: 'Rus tili' })] })
    await user.click(screen.getByRole('button', { name: 'Rus tilini tahrirlash' }))
    const dialog = await screen.findByRole('dialog', { name: 'Kursni tahrirlash' })
    expect(within(dialog).getByText('Nom o\'zgarsa, 1 ta mijozdagi kurs nomi ham yangilanadi')).toBeTruthy()
    await user.clear(within(dialog).getByLabelText(/Nomi/))
    await user.type(within(dialog).getByLabelText(/Nomi/), 'Rus tili (B1)')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(storedCustomers()[0].course).toBe('Rus tili (B1)')
  })

  it('mijozi bor kursda o\'chirish yo\'q — arxivlanadi; mijozsiz kurs o\'chiriladi', async () => {
    const { user } = await openCourses({ customers: [makeCustomer({ course: 'Rus tili' })] })
    expect(screen.queryByRole('button', { name: 'Rus tilini o\'chirish' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Rus tilini arxivlash' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Arxivlash' }))
    expect(storedCourses().find((c) => c.name === 'Rus tili')?.status).toBe('archived')
    expect(storedCustomers()[0].course).toBe('Rus tili')

    await user.click(screen.getByRole('button', { name: 'Arxiv' }))
    await user.click(screen.getByRole('button', { name: 'Rus tilini arxivdan qaytarish' }))
    expect(storedCourses().find((c) => c.name === 'Rus tili')?.status).toBe('active')

    await user.click(screen.getByRole('button', { name: 'Faol' }))
    await user.click(screen.getByRole('button', { name: 'Grafik dizaynni o\'chirish' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'O\'chirish' }))
    expect(storedCourses().some((c) => c.name === 'Grafik dizayn')).toBe(false)
  })
})

describe('Narx yoki muddat kiritilmagan kurslar', () => {
  it('ogohlantirish va tahrirlash tugmalari; muddatsiz kurs "Muddatsiz" deb ko\'rsatiladi', async () => {
    const [ielts, frontend] = createMockCourses()
    const { user } = await openCourses({
      courses: [{ ...ielts, durationMonths: 0 }, { ...frontend, monthlyPrice: 0 }],
    })
    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain('2 ta kursda narx yoki muddat kiritilmagan')
    const table = screen.getAllByRole('table')[0]
    const ieltsRow = within(table).getByRole('button', { name: ielts.name }).closest('tr') as HTMLElement
    expect(within(ieltsRow).getByText('Muddatsiz')).toBeTruthy()
    await user.click(within(notice).getByRole('button', { name: frontend.name }))
    expect(await screen.findByRole('dialog', { name: 'Kursni tahrirlash' })).toBeTruthy()
  })
})
