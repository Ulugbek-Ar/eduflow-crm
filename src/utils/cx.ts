// Shartli CSS klasslarni birlashtiradi: cx('btn', active && 'is-active')
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// Maydon ostidagi xato yoki izoh matni id'si (aria-describedby uchun)
export function fieldDescription(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

export interface SelectOption {
  value: string
  label: string
}

// Record<qiymat, yorliq> dan Select variantlari ro'yxati
export function toOptions<K extends string>(labels: Record<K, string>): SelectOption[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))
}
