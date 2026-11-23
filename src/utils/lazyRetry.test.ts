// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, loadWithRetry } from './lazyRetry'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('kod bo\'lagini qayta yuklash', () => {
  it('bir marta muvaffaqiyatsiz bo\'lsa — qayta urinadi', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module')).mockResolvedValueOnce('ok')
    expect(await loadWithRetry(loader, { delayMs: 1 })).toBe('ok')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('bo\'lak topilmasa sahifa faqat bir marta yangilanadi; fon yuklashda — hech qachon', async () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location)
    const fail = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
    await expect(loadWithRetry(fail, { delayMs: 1, reload: false })).rejects.toThrow()
    expect(reload).not.toHaveBeenCalled()
    await expect(loadWithRetry(fail, { delayMs: 1 })).rejects.toThrow()
    await expect(loadWithRetry(fail, { delayMs: 1 })).rejects.toThrow()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('bo\'lak xatosini taniydi', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})
