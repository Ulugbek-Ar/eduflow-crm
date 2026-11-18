// Sahifa bo'lagini oldindan yuklash (Vite plugin, faqat build).
// Muammo: index.js (React) yuklanib, bajarilgandan keyingina sahifa bo'lagi (App, Landing ...) so'raladi — ketma-ket ikki
// so'rov ("sharshara"). Yechim: kichik oddiy skript (route-preload-*.js) <head> da manzilga qarab kerakli bo'lak va uning
// bog'liqliklarini <link rel="modulepreload"> bilan darhol so'raydi — index.js bilan parallel. Rus tili tanlangan bo'lsa,
// lug'at ham. CSP inline skriptga ruxsat bermaydi (script-src 'self'), shuning uchun alohida fayl.
// Marshrutlar src/router.ts dagi routeFromPath bilan bir xil bo'lishi kerak

import type { Plugin } from 'vite'

// Rollup/Rolldown chiqish bo'lagidan kerakli qism
export interface BundleItem {
  type: 'chunk' | 'asset'
  fileName: string
  isEntry?: boolean
  imports?: string[]
  facadeModuleId?: string | null
  source?: string | Uint8Array
  // Vite: bo'lak bilan birga yuklanadigan CSS fayllar
  viteMetadata?: { importedCss?: Set<string> }
}

// Sahifa -> modul (manba fayl oxiri)
export const ROUTE_MODULES: Record<string, string> = {
  app: 'src/App.tsx',
  owner: 'src/owner/OwnerConsole.tsx',
  legal: 'src/landing/LegalPage.tsx',
  landing: 'src/landing/LandingPage.tsx',
}
const RU_MODULE = 'src/i18n/ru.ts'

const normalize = (id: string | null | undefined) => (id ?? '').replaceAll('\\', '/')

// bundle (Rollup OutputBundle) -> { app: ['assets/App-x.js', ...], ..., ru: [...] }
// Kirish bo'lagi (index) va u allaqachon oldindan yuklaydigan bo'laklar ro'yxatga kirmaydi
export function buildRouteMap(bundle: Record<string, BundleItem>): Record<string, string[]> {
  const chunks = Object.values(bundle).filter((item) => item.type === 'chunk')
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const entry = chunks.find((chunk) => chunk.isEntry)
  const skip = new Set<string>(entry ? [entry.fileName, ...(entry.imports ?? []), ...(entry.viteMetadata?.importedCss ?? [])] : [])
  const collect = (chunk: BundleItem) => {
    const files: string[] = []
    const seen = new Set<string>()
    const visit = (item: BundleItem | undefined) => {
      if (!item || seen.has(item.fileName)) return
      seen.add(item.fileName)
      if (!skip.has(item.fileName)) files.push(item.fileName)
      for (const css of item.viteMetadata?.importedCss ?? []) if (!skip.has(css) && !files.includes(css)) files.push(css)
      for (const dep of item.imports ?? []) visit(byFile.get(dep))
    }
    visit(chunk)
    return files
  }
  const find = (suffix: string) => chunks.find((chunk) => normalize(chunk.facadeModuleId).endsWith(suffix))
  const map: Record<string, string[]> = {}
  for (const [route, suffix] of Object.entries({ ...ROUTE_MODULES, ru: RU_MODULE })) {
    const chunk = find(suffix)
    if (chunk) map[route] = collect(chunk)
  }
  return map
}

export function preloadScript(map: Record<string, string[]>): string {
  return `// Avtomatik yaratilgan (scripts/route-preload.ts) — sahifa bo'lagini index.js bilan parallel yuklash
(function () {
  try {
    var map = ${JSON.stringify(map)}
    var base = new URL('..', document.currentScript.src).pathname
    var rest = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : location.pathname.replace(/^\\/+/, '')
    var first = rest.split('/')[0].toLowerCase()
    var route = first === 'app' ? 'app' : first === 'owner' ? 'owner' : first === 'privacy' || first === 'terms' ? 'legal' : 'landing'
    var files = (map[route] || []).slice()
    if (localStorage.getItem('apex:lang') === '"ru"') files = (map.ru || []).concat(files)
    for (var i = 0; i < files.length; i++) {
      var link = document.createElement('link')
      if (/\\.css$/.test(files[i])) {
        // Faqat oldindan yuklash: Vite bo'lakni ulaganda o'zi qo'llaydi (keshdan)
        link.rel = 'preload'
        link.as = 'style'
      } else {
        link.rel = 'modulepreload'
        link.crossOrigin = ''
      }
      link.href = base + files[i]
      document.head.appendChild(link)
    }
  } catch (e) {
    // Oldindan yuklash — faqat tezlashtirish; xato bo'lsa sahifa odatdagidek yuklanadi
  }
})()
`
}

export function routePreload(): Plugin {
  return {
    name: 'eduflow-route-preload',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const items = bundle as unknown as Record<string, BundleItem>
      const map = buildRouteMap(items)
      if (!Object.keys(map).length) return
      const ref = this.emitFile({ type: 'asset', name: 'route-preload.js', source: preloadScript(map) })
      const fileName = this.getFileName(ref)
      for (const item of Object.values(items)) {
        if (item.type !== 'asset' || !item.fileName.endsWith('.html')) continue
        const html = String(item.source)
        // Modul skriptdan oldin (oddiy skript <head> da birinchi bajariladi). Manzil base'ga nisbatan — index.html bilan bir xil
        const src = html.match(/<script type="module" crossorigin src="([^"]*)assets\//)
        if (!src) continue
        item.source = html.replace(/(\s*)<script type="module" crossorigin src=/, `$1<script src="${src[1]}${fileName}"></script>$1<script type="module" crossorigin src=`)
      }
    },
  }
}
