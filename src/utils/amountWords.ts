// Summa so'z bilan (cheklar uchun): 650 000 -> "Olti yuz ellik ming so'm"
const ONES = ['', 'bir', 'ikki', 'uch', 'to\'rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to\'qqiz']
const TENS = ['', 'o\'n', 'yigirma', 'o\'ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', 'to\'qson']
const SCALES = ['', 'ming', 'million', 'milliard', 'trillion']

// 0..999 -> "bir yuz yigirma besh"
function triple(n: number): string[] {
  const words: string[] = []
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  if (hundreds > 0) words.push(ONES[hundreds], 'yuz')
  if (tens > 0) words.push(TENS[tens])
  if (ones > 0) words.push(ONES[ones])
  return words
}

export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (!Number.isFinite(n)) return ''
  if (n === 0) return 'nol'
  const words: string[] = []
  let rest = n
  let scale = 0
  const groups: string[][] = []
  while (rest > 0 && scale < SCALES.length) {
    const part = rest % 1000
    if (part > 0) groups.unshift([...triple(part), SCALES[scale]].filter(Boolean))
    rest = Math.floor(rest / 1000)
    scale += 1
  }
  for (const group of groups) words.push(...group)
  return (value < 0 ? ['minus', ...words] : words).join(' ')
}

export function amountInWords(amount: number, currency: 'UZS' | 'USD'): string {
  const text = `${numberToWords(amount)} ${currency === 'UZS' ? 'so\'m' : 'AQSH dollari'}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}
