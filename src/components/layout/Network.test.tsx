// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { renderSignedIn } from '../../test/helpers'

afterEach(() => vi.restoreAllMocks())

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'))
  })
}

describe('Internet holati', () => {
  it('uzilsa tasma chiqadi, qaytsa xabar', async () => {
    await renderSignedIn()
    expect(screen.queryByText('Internet yo\'q.')).toBeNull()
    setOnline(false)
    expect(screen.getByText('Internet yo\'q.')).toBeTruthy()
    expect(screen.getByText(/ma'lumotlar shu brauzerda saqlanadi/)).toBeTruthy()
    setOnline(true)
    expect(screen.queryByText('Internet yo\'q.')).toBeNull()
    expect(await screen.findByText('Internet qaytdi')).toBeTruthy()
  })
})

describe('Xato oynasi', () => {
  function Boom({ message }: { message: string }): never {
    throw new Error(message)
  }

  it('bo\'lak yuklanmasa — tushunarli matn va "Qayta yuklash"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary compact>
        <Boom message="Failed to fetch dynamically imported module: /assets/App.js" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Bo\'lim yuklanmadi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Qayta yuklash/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Qayta urinish' })).toBeNull()
  })

  it('boshqa xatoda — "Qayta urinish" bo\'limni qayta chizadi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary compact>
        <Boom message="x is undefined" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Kutilmagan xato yuz berdi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Qayta urinish' })).toBeTruthy()
  })
})
