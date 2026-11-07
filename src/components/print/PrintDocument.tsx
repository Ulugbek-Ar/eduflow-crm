import { useEffect, useEffectEvent } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import type { PaperSize } from '../../utils/receipt'

// Qog'oz o'lchami: A4, A4 albom (dars jadvali) yoki 80 mm termoprinter lentasi (balandligi mazmunga qarab)
type PrintSize = PaperSize | 'a4-landscape'

const PAGE_RULE: Record<PrintSize, string> = {
  a4: '@page { size: A4; margin: 14mm; }',
  'a4-landscape': '@page { size: A4 landscape; margin: 8mm; }',
  thermal: '@page { size: 80mm auto; margin: 3mm; }',
}

// Chop etish: hujjat sahifaga qo'shiladi, faqat u chop etiladi (qolgani yashiriladi), tugagach o'chadi
export function PrintDocument({ size, onDone, children }: { size: PrintSize; onDone: () => void; children: ReactNode }) {
  const done = useEffectEvent(onDone)
  useEffect(() => {
    document.body.classList.add('is-printing')
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      done()
    }
    window.addEventListener('afterprint', finish)
    // Hujjat chizilgandan keyin chop etish oynasi ochiladi
    const frame = window.requestAnimationFrame(() => {
      try {
        window.print()
      } catch {
        // Brauzer chop etishni qo'llamasa — oyna yopiladi
      }
      // Ba'zi brauzerlar afterprint yubormaydi: print() qaytgach ham yopamiz
      window.setTimeout(finish, 500)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', finish)
      document.body.classList.remove('is-printing')
    }
  }, [])

  return createPortal(
    <div className={`print-root print-${size}`}>
      <style>{PAGE_RULE[size]}</style>
      {children}
    </div>,
    document.body,
  )
}
