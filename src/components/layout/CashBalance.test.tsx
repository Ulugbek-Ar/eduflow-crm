// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Role } from '../../types/user.types'
import { makeTransaction, renderSignedIn } from '../../test/helpers'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

const income = makeTransaction({ id: 't1', type: 'income', amount: 1_000_000 })

describe('Kassa balansi faqat administrator va kassirga ko\'rinadi', () => {
  it.each<[Role, boolean]>([
    ['admin', true],
    ['cashier', true],
    ['manager', false],
    ['viewer', false],
    ['teacher', false],
  ])('%s — ko\'radi: %s', async (role, visible) => {
    await renderSignedIn({ transactions: [income] }, { role })
    await screen.findAllByRole('navigation')
    expect(screen.queryByText('Kassa balansi') !== null).toBe(visible)
  })
})
