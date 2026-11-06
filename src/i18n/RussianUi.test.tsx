// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setDictionary } from '.'
import { renderApp, seedUsers } from '../test/helpers'
import { RU } from './ru'

afterEach(() => setDictionary('uz', null))

describe('Rus tilidagi interfeys', () => {
  it('kirish ekrani ruscha; til tugmasi bor', async () => {
    setDictionary('ru', RU)
    await seedUsers()
    renderApp()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeTruthy()
    expect(screen.getByText('Вход в панель управления')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Посмотреть демо' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Til / Язык' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Русский' }).getAttribute('aria-pressed')).toBe('true')
  })
})
