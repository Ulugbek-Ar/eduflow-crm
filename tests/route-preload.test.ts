import { describe, expect, it } from 'vitest'
import { buildRouteMap, preloadScript } from '../scripts/route-preload.ts'
import type { BundleItem } from '../scripts/route-preload.ts'

const chunk = (fileName: string, extra: Partial<BundleItem> = {}): BundleItem => ({ type: 'chunk', fileName, imports: [], facadeModuleId: null, ...extra })

describe('sahifa bo\'lagini oldindan yuklash', () => {
  const bundle: Record<string, BundleItem> = {
    'assets/index.js': chunk('assets/index.js', { isEntry: true, imports: ['assets/shared.js'], facadeModuleId: '/p/index.html' }),
    'assets/shared.js': chunk('assets/shared.js'),
    'assets/App.js': chunk('assets/App.js', { facadeModuleId: '/p/src/App.tsx', imports: ['assets/shared.js', 'assets/ui.js'], viteMetadata: { importedCss: new Set(['assets/app.css']) } }),
    'assets/ui.js': chunk('assets/ui.js', { imports: ['assets/App.js'] }),
    'assets/Landing.js': chunk('assets/Landing.js', { facadeModuleId: 'C:\\p\\src\\landing\\LandingPage.tsx' }),
    'assets/ru.js': chunk('assets/ru.js', { facadeModuleId: '/p/src/i18n/ru.ts' }),
    'index.html': { type: 'asset', fileName: 'index.html', source: '' },
  }

  it('har sahifa: o\'z bo\'lagi, bog\'liqliklari va CSS; kirish bo\'lagi va u yuklaydiganlar kirmaydi; tsikl muammo emas', () => {
    const map = buildRouteMap(bundle)
    expect(map.app).toEqual(['assets/App.js', 'assets/app.css', 'assets/ui.js'])
    expect(map.landing).toEqual(['assets/Landing.js'])
    expect(map.ru).toEqual(['assets/ru.js'])
    expect(map.owner).toBeUndefined()
  })

  it('skript marshrutni router.ts bilan bir xil aniqlaydi', () => {
    const script = preloadScript({ app: ['assets/App.js'] })
    expect(script).toContain("first === 'app' ? 'app'")
    expect(script).toContain("first === 'privacy' || first === 'terms' ? 'legal'")
    expect(script).toContain("localStorage.getItem('apex:lang') === '\"ru\"'")
  })
})
