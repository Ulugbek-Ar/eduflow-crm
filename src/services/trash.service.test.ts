// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { makeCustomer, makeTransaction } from '../test/helpers'
import { daysLeft, isTrashEntry, loadTrash, saveTrash, TRASH_KEY, TRASH_RETENTION_DAYS, trashTitle } from './trash.service'
import type { TrashEntry } from './trash.service'

const DAY = 86_400_000

beforeEach(() => {
  localStorage.clear()
})

describe('savatcha', () => {
  it(`${TRASH_RETENTION_DAYS} kundan eski yozuvlar avtomatik yo'qoladi`, () => {
    const now = Date.now()
    const fresh: TrashEntry = { kind: 'customer', id: 'c1', deletedAt: new Date(now - 2 * DAY).toISOString(), deletedBy: 'Dilshod', item: makeCustomer() }
    const old: TrashEntry = { kind: 'customer', id: 'c2', deletedAt: new Date(now - 31 * DAY).toISOString(), deletedBy: 'Dilshod', item: makeCustomer({ id: 'c2' }) }
    saveTrash([fresh, old])
    expect(loadTrash(now).map((e) => e.id)).toEqual(['c1'])
    expect(daysLeft(fresh, now)).toBe(28)
    expect(daysLeft({ deletedAt: new Date(now - 29.9 * DAY).toISOString() }, now)).toBe(1)
  })

  it('buzuq yozuv va noma\'lum tur tashlanadi', () => {
    localStorage.setItem(
      TRASH_KEY,
      JSON.stringify([
        { kind: 'customer', id: 'c1', deletedAt: new Date().toISOString(), deletedBy: '', item: { id: 'c1' } },
        { kind: 'robot', id: 'r1', deletedAt: new Date().toISOString(), deletedBy: '', item: {} },
      ]),
    )
    expect(loadTrash()).toEqual([])
    expect(isTrashEntry({ kind: 'transaction', id: 't1', deletedAt: new Date().toISOString(), deletedBy: 'A', item: makeTransaction() })).toBe(true)
  })

  it('nomi: mijoz ismi yoki tranzaksiya summasi', () => {
    const money = (n: number) => `${n} so'm`
    expect(trashTitle({ kind: 'transaction', id: 't1', deletedAt: '', deletedBy: '', item: makeTransaction() }, money)).toBe('Kirim: 650000 so\'m · Aziza Karimova')
  })
})
