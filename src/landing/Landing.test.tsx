// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PLANS } from '../constants/plans'
import { plain, renderApp, seedUsers } from '../test/helpers'
import { LandingPage } from './LandingPage'
import { LegalPage } from './LegalPage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('Landing', () => {
  it('sarlavha, sinov va demo tugmalari, kimlar uchun, imkoniyatlar', () => {
    render(<LandingPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'O\'quv markazingizni bitta panelda boshqaring' })).toBeTruthy()
    const hero = screen.getByRole('region', { name: 'O\'quv markazingizni bitta panelda boshqaring' })
    expect(within(hero).getByRole('link', { name: '14 kun bepul sinash' }).getAttribute('href')).toBe('/app')
    expect(within(hero).getByRole('link', { name: /Demo'ni ko'rish/ }).getAttribute('href')).toBe('/app?demo=1')
    expect(within(screen.getByRole('region', { name: 'Kimlar uchun' })).getAllByRole('listitem').length).toBe(5)
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(8)
    // Skrinshotlar o'lchami berilgan (sahifa sakramaydi), birinchidan boshqasi kechiktirib yuklanadi
    const images = screen.getAllByRole('img')
    expect(images.every((img) => img.getAttribute('width') && img.getAttribute('height'))).toBe(true)
    expect(images.slice(1).every((img) => img.getAttribute('loading') === 'lazy')).toBe(true)
  })

  it('narxlar jadvali: sinov 14 kun bepul, Standart va Pro', () => {
    render(<LandingPage />)
    const pricing = screen.getByRole('region', { name: 'Narxlar' })
    const plans = within(pricing).getAllByRole('article')
    expect(plans).toHaveLength(PLANS.length)
    expect(plans[0].textContent).toContain('Bepul')
    expect(plans[0].textContent).toContain('14 kun')
    expect(plain(plans[1].textContent)).toContain('199 000 so\'m / oy')
    expect(plans[1].textContent).toContain('Ko\'p tanlanadi')
    expect(plans[2].textContent).toContain('Cheksiz xodim')
  })

  it('pastki qismda huquqiy sahifalar havolasi', () => {
    render(<LandingPage />)
    const legal = screen.getByRole('navigation', { name: 'Huquqiy ma\'lumot' })
    expect(within(legal).getByRole('link', { name: 'Maxfiylik siyosati' }).getAttribute('href')).toBe('/privacy')
    expect(within(legal).getByRole('link', { name: 'Foydalanish shartlari' }).getAttribute('href')).toBe('/terms')
  })
})

describe('Huquqiy sahifalar', () => {
  it('maxfiylik siyosati: namuna ogohlantirishi va qonunga havola', () => {
    window.history.replaceState(null, '', '/privacy')
    render(<LegalPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Maxfiylik siyosati' })).toBeTruthy()
    expect(screen.getByText(/yurist bilan tekshiring/)).toBeTruthy()
    expect(document.body.textContent).toContain('Shaxsga doir ma\'lumotlar to\'g\'risida')
  })

  it('foydalanish shartlari', () => {
    window.history.replaceState(null, '', '/terms')
    render(<LegalPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Foydalanish shartlari' })).toBeTruthy()
    expect(screen.getByText(/14 kun — bepul sinov/)).toBeTruthy()
  })
})

describe('Panel: /app?demo=1', () => {
  it('landing\'dagi "Demo\'ni ko\'rish" demo markazni darhol ochadi va manzilni tozalaydi', async () => {
    await seedUsers()
    window.history.replaceState(null, '', '/app?demo=1')
    renderApp()
    expect(await screen.findByRole('region', { name: 'Demo rejim' })).toBeTruthy()
    expect(window.location.search).toBe('')
  })
})
