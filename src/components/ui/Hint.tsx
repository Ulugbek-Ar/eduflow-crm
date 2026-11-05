import { useEffect, useId, useRef, useState } from 'react'
import { GLOSSARY } from '../../constants/glossary'
import type { GlossaryKey } from '../../constants/glossary'
import { cx } from '../../utils/cx'

// "?" tugmasi: atamaning oddiy tushuntirishi (toggletip). Esc, tashqariga bosish yoki fokus chiqsa yopiladi
export function Hint({ term, className }: { term: GlossaryKey; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  const entry = GLOSSARY[term]

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className={cx('hint', className)}>
      <button
        type="button"
        className="hint-btn"
        aria-label={`${entry.term} nima?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
        }}
      >
        ?
      </button>
      {open && (
        <span id={id} role="status" className="hint-pop">
          <strong>{entry.term}</strong> — {entry.text}
        </span>
      )}
    </span>
  )
}
