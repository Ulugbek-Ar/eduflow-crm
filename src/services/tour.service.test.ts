// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { clearDemoStorage, setStorageNamespace } from './storage.service'
import { isTourDone, markTourDone } from './tour.service'

afterEach(() => {
  setStorageNamespace('main')
  localStorage.clear()
})

describe('Tanishtiruv — har odamga bir marta', () => {
  it('demo markazda: demo xotirasi tozalansa (qayta kirish) ham qayta chiqmaydi', () => {
    setStorageNamespace('demo')
    expect(isTourDone('demo')).toBe(false)
    markTourDone('demo')
    clearDemoStorage()
    setStorageNamespace('demo')
    expect(isTourDone('demo')).toBe(true)
  })

  it('har xodim alohida: biri ko\'rgani boshqasiga ta\'sir qilmaydi', () => {
    markTourDone('u-1')
    expect(isTourDone('u-1')).toBe(true)
    expect(isTourDone('u-2')).toBe(false)
  })
})
