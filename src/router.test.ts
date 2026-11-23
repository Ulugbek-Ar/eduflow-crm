import { describe, expect, it } from 'vitest'
import { routeFromPath } from './router'

describe('marshrutlar', () => {
  it('ildiz manzilda', () => {
    expect(routeFromPath('/', '/')).toBe('landing')
    expect(routeFromPath('/app', '/')).toBe('app')
    expect(routeFromPath('/app/', '/')).toBe('app')
    expect(routeFromPath('/privacy', '/')).toBe('privacy')
    expect(routeFromPath('/terms', '/')).toBe('terms')
    // QA-15: noma'lum manzil — "Sahifa topilmadi"
    expect(routeFromPath('/nomalum', '/')).toBe('notFound')
    expect(routeFromPath('/index.html', '/')).toBe('landing')
  })

  it('pastki papkada (GitHub Pages)', () => {
    expect(routeFromPath('/eduflow-crm/', '/eduflow-crm/')).toBe('landing')
    expect(routeFromPath('/eduflow-crm', '/eduflow-crm/')).toBe('landing')
    expect(routeFromPath('/eduflow-crm/yoq-sahifa', '/eduflow-crm/')).toBe('notFound')
    expect(routeFromPath('/eduflow-crm/app', '/eduflow-crm/')).toBe('app')
    expect(routeFromPath('/eduflow-crm/terms', '/eduflow-crm/')).toBe('terms')
  })
})
