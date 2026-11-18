import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, DEMO_CONTACTS } from '../../constants/mockData'
import { createMockData } from './data'

describe('Demo va yangi markaz kontaktlari (QA-05)', () => {
  it('yangi markaz standart sozlamalarida telefon va manzil bo\'sh', () => {
    expect(DEFAULT_SETTINGS.phone).toBe('')
    expect(DEFAULT_SETTINGS.address).toBe('')
  })

  it('demo markazda namunaviy telefon va manzil saqlanadi', () => {
    const { settings } = createMockData()
    expect(settings.phone).toBe(DEMO_CONTACTS.phone)
    expect(settings.address).toBe(DEMO_CONTACTS.address)
  })
})
