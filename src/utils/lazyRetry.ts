// Kod bo'lagini yuklash: tarmoq uzilsa bir marta qayta uriniladi. Yangi versiya chiqqani sababli eski bo'lak
// topilmasa — sahifa bir marta o'zi yangilanadi (cheksiz aylanmaslik uchun sessionStorage belgisi bilan)
const RELOAD_FLAG = 'eduflow:chunk-reload'

export function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk/i.test(text)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// reload: false — fon rejimida oldindan yuklash (ishlayotgan foydalanuvchining sahifasi yangilanib ketmasin)
export async function loadWithRetry<T>(loader: () => Promise<T>, { retries = 1, delayMs = 800, reload = true } = {}): Promise<T> {
  try {
    const result = await loader()
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      // e'tiborsiz
    }
    return result
  } catch (error) {
    if (retries > 0) {
      await wait(delayMs)
      return loadWithRetry(loader, { retries: retries - 1, delayMs, reload })
    }
    // Internet bor, lekin bo'lak yo'q — ehtimol yangi deploy: bir marta sahifani yangilaymiz
    if (reload && isChunkLoadError(error) && navigator.onLine) {
      let reloaded = false
      try {
        reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1'
        if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, '1')
      } catch {
        reloaded = true
      }
      if (!reloaded) window.location.reload()
    }
    throw error
  }
}
