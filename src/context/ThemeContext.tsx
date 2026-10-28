import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { THEME_KEY, ThemeContext } from '../hooks/useTheme'
import type { ThemeContextValue, ThemePreference } from '../hooks/useTheme'
import { readJson, setItem } from '../services/storage.service'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readPreference(): ThemePreference {
  const value = readJson(THEME_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  // "system" bo'lsa atribut olib tashlanadi va CSS media query ishlaydi
  useEffect(() => {
    const root = document.documentElement
    if (preference === 'system') delete root.dataset.theme
    else root.dataset.theme = preference
    setItem(THEME_KEY, preference)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#4f46e5')
  }, [preference, resolved])

  const value: ThemeContextValue = { preference, resolved, setPreference }
  return <ThemeContext value={value}>{children}</ThemeContext>
}
