// Oddiy marshrutlash (kutubxonasiz): / — landing, /app — boshqaruv paneli, /privacy va /terms — huquqiy sahifalar.
// Sayt pastki papkada joylashsa (GitHub Pages: /eduflow-crm/) — BASE_URL hisobga olinadi
export type Route = 'landing' | 'app' | 'privacy' | 'terms' | 'owner'

const ROUTES: Record<Exclude<Route, 'landing'>, string> = { app: 'app', privacy: 'privacy', terms: 'terms', owner: 'owner' }

function base(): string {
  const value = import.meta.env.BASE_URL || '/'
  return value.endsWith('/') ? value : `${value}/`
}

export function routeFromPath(pathname: string, prefix = base()): Route {
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\/+/, '')
  const first = path.split('/')[0]?.toLowerCase() ?? ''
  if (first === 'app' || first === 'index.html') return first === 'app' ? 'app' : 'landing'
  if (first === 'privacy') return 'privacy'
  if (first === 'terms') return 'terms'
  if (first === 'owner') return 'owner'
  return 'landing'
}

export function currentRoute(): Route {
  return routeFromPath(window.location.pathname)
}

// Ichki havolalar: base bilan (masalan, /eduflow-crm/app)
export function routeHref(route: Route, query = ''): string {
  const path = route === 'landing' ? '' : ROUTES[route]
  return `${base()}${path}${query}`
}
