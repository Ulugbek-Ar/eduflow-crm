import { useEffect, useState } from 'react'
import { readJson, setItem } from '../services/storage.service'

// Interfeys afzalliklari (sidebar holati, mijozlar ko'rinishi ...) uchun: localStorage'da saqlanadi.
// Saqlab bo'lmasa ham ishlaydi — qiymat faqat shu sessiyada qoladi
export function usePersistentState<T>(key: string, fallback: T, guard: (value: unknown) => value is T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = readJson(key)
    return guard(stored) ? stored : fallback
  })

  useEffect(() => {
    setItem(key, value)
  }, [key, value])

  return [value, setValue]
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
