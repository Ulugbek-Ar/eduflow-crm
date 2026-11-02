// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LOGIN_LOCK_KEY, MAX_ATTEMPTS } from '../../services/loginLock.service'
import { renderApp, seedCredentials, TEST_LOGIN, TEST_PASSWORD } from '../../test/helpers'

async function submit(user: ReturnType<typeof renderApp>['user'], login: string, password: string) {
  await user.clear(screen.getByLabelText('Login'))
  await user.type(screen.getByLabelText('Login'), login)
  await user.type(screen.getByLabelText('Parol'), password)
  await user.click(screen.getByRole('button', { name: 'Kirish' }))
}

describe('LoginScreen', () => {
  it('to\'g\'ri parol bilan kiradi (birinchi kirishda tanlov ekrani)', async () => {
    await seedCredentials()
    const { user } = renderApp()
    await submit(user, TEST_LOGIN, TEST_PASSWORD)
    expect(await screen.findByRole('heading', { name: 'Xush kelibsiz!' })).toBeTruthy()
  })

  it('noto\'g\'ri parolda xato va qolgan urinishlar soni', async () => {
    await seedCredentials()
    const { user } = renderApp()
    await submit(user, TEST_LOGIN, 'xato-parol')
    expect((await screen.findByRole('alert')).textContent).toBe(`Login yoki parol noto'g'ri. Yana ${MAX_ATTEMPTS - 1} ta urinish qoldi`)
    expect((screen.getByLabelText('Parol') as HTMLInputElement).value).toBe('')
  })

  it(`${MAX_ATTEMPTS} ta xatodan keyin bloklanadi va blok sahifa qayta ochilganda ham saqlanadi`, async () => {
    await seedCredentials()
    const { user, unmount } = renderApp()
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await submit(user, TEST_LOGIN, `xato-${i}`)
      expect(await screen.findByText(`Login yoki parol noto'g'ri. Yana ${MAX_ATTEMPTS - i} ta urinish qoldi`)).toBeTruthy()
    }
    await submit(user, TEST_LOGIN, 'xato-oxirgi')
    expect(await screen.findByText(/Kirish vaqtincha bloklandi/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('30 soniya')
    expect((screen.getByRole('button', { name: 'Kirish' }) as HTMLButtonElement).disabled).toBe(true)
    expect(JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY) ?? '{}')).toMatchObject({ lockCount: 1 })

    // "Sahifani yangilash": komponent qaytadan yaratiladi, blok localStorage'dan tiklanadi
    unmount()
    renderApp()
    expect(screen.getByRole('alert').textContent).toContain('Kirish vaqtincha bloklandi')
    expect((screen.getByRole('button', { name: 'Kirish' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('blok paytida to\'g\'ri parol ham qabul qilinmaydi', async () => {
    await seedCredentials()
    localStorage.setItem(LOGIN_LOCK_KEY, JSON.stringify({ failures: 0, lockCount: 2, lockedUntil: Date.now() + 60_000 }))
    renderApp()
    expect(screen.getByRole('alert').textContent).toMatch(/1 daqiqa|60 soniya|59 soniya/)
    expect((screen.getByRole('button', { name: 'Kirish' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
