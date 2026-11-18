// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createBackup } from '../../services/storage.service'
import { authenticate } from '../../services/users.service'
import { makeCustomer, makeTransaction, renderApp, renderSignedIn, seedSession, seedUsers } from '../../test/helpers'

type User = ReturnType<typeof renderApp>['user']

async function openWizard() {
  await seedUsers()
  seedSession()
  const view = renderApp()
  await screen.findByRole('heading', { name: 'Markaz haqida' })
  return view
}

async function next(user: User) {
  await user.click(screen.getByRole('button', { name: /^(Keyingi|O'tkazib yuborish)/ }))
}

describe('Sozlash ustasi', () => {
  it('4 qadam: markaz, kurslar, xodimlar — kiritilganlar saqlanadi', async () => {
    const { user } = await openWizard()
    const name = screen.getByLabelText(/O'quv markazi nomi/)
    await user.clear(name)
    await next(user)
    expect(screen.getByText('Markaz nomini kiriting')).toBeTruthy()
    await user.type(name, 'Zukko Akademiya')
    await user.type(screen.getByLabelText('Telefon'), '712000000')
    await next(user)

    expect(screen.getByRole('heading', { name: 'Qaysi kurslar bor?' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Ingliz tili' }))
    await user.type(screen.getByLabelText('Oylik narx'), '600000')
    await user.click(screen.getByRole('button', { name: 'Qo\'shish' }))
    expect(within(screen.getByRole('list', { name: 'Qo\'shilgan kurslar' })).getByText('Ingliz tili')).toBeTruthy()
    // Bir xil nom ikki marta qo'shilmaydi
    await user.click(screen.getByRole('button', { name: 'Ingliz tili' }))
    await user.click(screen.getByRole('button', { name: 'Qo\'shish' }))
    expect(screen.getByText('Bu nomdagi kurs yoki xizmat bor')).toBeTruthy()
    await next(user)

    expect(screen.getByRole('heading', { name: 'Xodimlarni qo\'shing' })).toBeTruthy()
    await user.type(screen.getByLabelText('Ism familiya'), 'Malika Yusupova')
    await user.type(screen.getByLabelText('Login'), 'malika')
    await user.click(screen.getByRole('button', { name: 'Qo\'shish' }))
    const staff = await screen.findByRole('list', { name: 'Qo\'shilgan xodimlar' }, { timeout: 4000 })
    const password = within(staff).getByText(/^[a-zA-Z2-9]{10}$/).textContent ?? ''
    expect((await authenticate('malika', password)).ok).toBe(true)
    await next(user)

    expect(screen.getByRole('heading', { name: 'Qanday boshlaymiz?' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Boshlash' }))
    expect(await screen.findByText('Zukko Akademiya')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('apex:settings') ?? '{}')).toMatchObject({ orgName: 'Zukko Akademiya', phone: '+998 71 200 00 00' })
    expect(JSON.parse(localStorage.getItem('apex:courses') ?? '[]')).toMatchObject([{ name: 'Ingliz tili', monthlyPrice: 600_000, durationMonths: 3 }])
    expect(localStorage.getItem('apex:seeded')).toBe('true')
  })

  it('oxirgi qadamda zaxiradan tiklash', async () => {
    const { user } = await openWizard()
    for (let i = 0; i < 3; i++) await next(user)
    const backup = createBackup({
      teachers: [],
      groups: [],
      enrollments: [],
      attendance: [],
      lessonExceptions: [],
      branches: [],
      customers: [makeCustomer({ name: 'Zaxiradagi Mijoz' })],
      transactions: [makeTransaction()],
      courses: [],
      settings: JSON.parse(localStorage.getItem('apex:settings') ?? 'null') ?? { ...(await import('../../constants/mockData')).DEFAULT_SETTINGS },
    })
    const file = new File([JSON.stringify(backup)], 'zaxira.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Zaxira faylini tanlash'), file)
    expect(await screen.findByText(/zaxira\.json: 1 mijoz, 1 tranzaksiya/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Boshlash' }))
    await screen.findByRole('navigation', { name: 'Bo\'limlar' })
    expect(JSON.parse(localStorage.getItem('apex:customers') ?? '[]')).toMatchObject([{ name: 'Zaxiradagi Mijoz' }])
  })
})

describe('Tanishtiruv va boshlash ro\'yxati', () => {
  it('birinchi kirishda tanishtiruv chiqadi; o\'tkazib yuborilsa qayta chiqmaydi; Yordamdan qayta ochiladi', async () => {
    const { unmount } = await renderSignedIn()
    unmount()
    // Yangi xodim: tanishtiruv hali ko'rilmagan
    localStorage.removeItem('apex:tour')
    const view = renderApp()
    const tour = await screen.findByRole('dialog', { name: 'Bo\'limlar' })
    expect(within(tour).getByText('1 / 5')).toBeTruthy()
    await view.user.click(within(tour).getByRole('button', { name: 'Keyingi' }))
    expect(screen.getByRole('dialog', { name: 'Qo\'shish' })).toBeTruthy()
    await view.user.click(screen.getByRole('button', { name: 'O\'tkazib yuborish' }))
    expect(screen.queryByRole('dialog', { name: /Qo'shish|Bo'limlar/ })).toBeNull()
    view.unmount()

    const { user } = renderApp()
    await screen.findByRole('navigation', { name: 'Bo\'limlar' })
    expect(screen.queryByText('1 / 5')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Yordam' }))
    await user.click(await screen.findByRole('button', { name: 'Tanishtiruvni ko\'rish' }))
    expect(await screen.findByText('1 / 5')).toBeTruthy()
  })

  it('boshlash ro\'yxati bajarilganlarni belgilaydi va yashiriladi', async () => {
    const { user } = await renderSignedIn({ customers: [makeCustomer()], transactions: [] })
    const card = screen.getByRole('region', { name: /Boshlash uchun 5 qadam/ })
    expect(within(card).getByText('2 / 5 bajarildi')).toBeTruthy()
    expect(within(card).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2')
    await user.click(within(card).getAllByRole('button', { name: 'Boshlash' })[0])
    expect(await screen.findByRole('dialog', { name: 'Yangi mijoz' }).catch(() => screen.findByRole('dialog', { name: 'To\'lov qabul qilish' }))).toBeTruthy()
    await user.keyboard('{Escape}')
    await user.click(within(card).getByRole('button', { name: 'Yashirish' }))
    expect(screen.queryByRole('region', { name: /Boshlash uchun/ })).toBeNull()
  })

  it('administrator bo\'lmasa ro\'yxat ko\'rinmaydi', async () => {
    await renderSignedIn(undefined, { role: 'manager' })
    expect(screen.queryByRole('region', { name: /Boshlash uchun/ })).toBeNull()
  })
})

describe('Yordam bo\'limi', () => {
  it('savol-javob, lug\'at va tezkor tugmalar', async () => {
    const { user } = await renderSignedIn(undefined, { role: 'viewer' })
    await user.click(screen.getByRole('button', { name: 'Yordam' }))
    expect(await screen.findByRole('heading', { name: 'Ko\'p beriladigan savollar' })).toBeTruthy()
    const question = screen.getByText('Xato o\'chirib yubordim. Qaytarsa bo\'ladimi?')
    await user.click(question)
    expect((question.closest('details') as HTMLDetailsElement).open).toBe(true)
    expect(screen.getByText(/Savatcha: o'chirilgan narsalar 30 kun saqlanadi/)).toBeTruthy()
    expect(screen.getByText('CPL')).toBeTruthy()
    expect(screen.getByText('Ctrl + K')).toBeTruthy()
    expect(screen.getByText(/administratoriga murojaat qiling/)).toBeTruthy()
  })
})
