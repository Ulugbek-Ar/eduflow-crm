// Deterministik tasodifiy sonlar: bir xil urug' — bir xil ketma-ketlik. Math.random ishlatilmaydi,
// shuning uchun demo markaz bir kun ichida har ochilganda bir xil ko'rinadi

// FNV-1a (32 bit): matn -> urug'
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// mulberry32: tez, sifatli va juda kichik generator; [0, 1) oralig'ida
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private readonly next: () => number

  constructor(seed: number | string) {
    this.next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed)
  }

  float(): number {
    return this.next()
  }

  // [min, max] oralig'idagi butun son
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  // [qiymat, og'irlik] juftliklaridan tanlash
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0)
    let roll = this.next() * total
    for (const [value, weight] of entries) {
      roll -= weight
      if (roll < 0) return value
    }
    return entries[entries.length - 1][0]
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}
