// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
})

async function renderLegal(path: string) {
  window.history.replaceState(null, '', path)
  vi.resetModules()
  const { LegalPage } = await import('./LegalPage')
  return render(<LegalPage />)
}

describe('Huquqiy sahifalar rekvizitlari', () => {
  it('muhit o\'zgaruvchilari berilsa — [qavs] o\'rniga haqiqiy ma\'lumot', async () => {
    vi.stubEnv('VITE_LEGAL_COMPANY', '«Bilim» MChJ, STIR 123456789')
    vi.stubEnv('VITE_LEGAL_PAYMENT', 'Click, Payme')
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'info@bilim.uz')
    await renderLegal('/terms')
    expect(screen.getAllByText(/«Bilim» MChJ, STIR 123456789/).length).toBeGreaterThan(0)
    expect(screen.getByText('Click, Payme')).toBeTruthy()
    expect(screen.getAllByText(/info@bilim\.uz/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\[Kompaniya nomi/)).toBeNull()
  })

  it('berilmasa — joy [qavs]da ko\'rinadi', async () => {
    await renderLegal('/privacy')
    expect(screen.getByText('[Kompaniya nomi, STIR, manzil]')).toBeTruthy()
  })
})
