// Ikki ro'yxat orasidagi farq: qo'shilgan/o'zgargan (upsert) va olib tashlangan (savatchaga) yozuvlar.
// Holat o'zgarganda butun ro'yxat emas, faqat farq serverga yuboriladi
export interface Changes<T> {
  upserts: T[]
  removedIds: string[]
}

export function diffById<T extends { id: string }>(prev: readonly T[], next: readonly T[]): Changes<T> {
  if (prev === next) return { upserts: [], removedIds: [] }
  const before = new Map(prev.map((item) => [item.id, item]))
  const after = new Set(next.map((item) => item.id))
  const upserts = next.filter((item) => {
    const old = before.get(item.id)
    return old === undefined || (old !== item && JSON.stringify(old) !== JSON.stringify(item))
  })
  const removedIds = prev.filter((item) => !after.has(item.id)).map((item) => item.id)
  return { upserts, removedIds }
}
