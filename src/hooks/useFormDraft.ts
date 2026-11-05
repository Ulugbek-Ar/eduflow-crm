import { useEffect, useState } from 'react'
import { readJson, removeItem, setItem } from '../services/storage.service'
import { isRecord } from '../utils/guards'

// Saqlangan qoralamadan faqat ma'lum maydonlar va to'g'ri turdagilar olinadi (buzuq qiymat formani buzmaydi)
export function mergeDraft<T extends object>(base: T, raw: unknown): T | null {
  if (!isRecord(raw)) return null
  const result = { ...base }
  let changed = false
  for (const key of Object.keys(base) as Array<keyof T & string>) {
    if (key in raw && typeof raw[key] === typeof base[key]) {
      result[key] = raw[key] as T[typeof key]
      changed = true
    }
  }
  return changed && JSON.stringify(result) !== JSON.stringify(base) ? result : null
}

// Yangi yozuv formasi qoralamasi: oyna tasodifan yopilsa ham yozilgan narsa yo'qolmaydi.
// Tahrirlashda (enabled = false) qoralama ishlatilmaydi
export function useFormDraft<T extends object>(name: string, enabled: boolean, initial: () => T) {
  const key = `apex:draft:${name}`
  const [blank] = useState(() => JSON.stringify(initial()))
  const [restored, setRestored] = useState(() => enabled && readJson(key) !== undefined && mergeDraft(initial(), readJson(key)) !== null)
  const [form, setForm] = useState<T>(() => (enabled ? mergeDraft(initial(), readJson(key)) : null) ?? initial())

  useEffect(() => {
    if (!enabled) return
    if (JSON.stringify(form) === blank) removeItem(key)
    else setItem(key, form)
  }, [enabled, form, key, blank])

  return {
    form,
    setForm,
    // Oldingi safardan qolgan qoralama tiklandi
    restored,
    discard: () => {
      removeItem(key)
      setRestored(false)
      setForm(initial())
    },
    // Saqlangandan keyin
    clear: () => removeItem(key),
  }
}
