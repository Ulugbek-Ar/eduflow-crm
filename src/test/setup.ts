// Har testdan keyin: sahifa manzilidagi bo'lim (#finance ...) keyingi testga o'tmasin — DashboardContext uni o'qiydi
import { afterEach } from 'vitest'

afterEach(() => {
  if (typeof window !== 'undefined' && window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search)
})
