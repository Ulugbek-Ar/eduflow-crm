// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotFoundPage } from './NotFoundPage'

describe('QA-15: 404 sahifa', () => {
  it('"Sahifa topilmadi", bosh sahifa va kirish havolalari, noindex', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('heading', { name: 'Sahifa topilmadi' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Bosh sahifa' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Kirish' }).getAttribute('href')).toBe('/app')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  })
})
