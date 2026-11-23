import { tr } from '../../i18n'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { TOUR_STEPS } from '../../constants/tour'
import type { TourStep } from '../../constants/tour'
import { Button } from '../ui/Button'

function visibleTarget(step: TourStep): HTMLElement | null {
  for (const selector of step.selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
    }
  }
  return null
}

const PAD = 6

// Qisqa tanishtiruv: element atrofida yorug' ramka va yonida izoh. Esc yoki "O'tkazib yuborish" — yopiladi
export function ProductTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1

  // Joylashuv: element ko'rinmasa (yoki telefonda yo'q bo'lsa) izoh ekran o'rtasida chiqadi
  useLayoutEffect(() => {
    const update = () => {
      const target = visibleTarget(step)
      setRect(target ? target.getBoundingClientRect() : null)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  useEffect(() => {
    cardRef.current?.focus()
  }, [index])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Karta va ramka transform bilan joylashadi (left/top emas): qadamlar almashganda layout shift yo'q (QA-11)
  const cardStyle = (): CSSProperties => {
    if (!rect) return { transform: 'translate(calc(50vw - 50%), calc(50vh - 50%))' }
    const width = Math.min(320, window.innerWidth - 32)
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16)
    // Pastda joy bo'lsa — ostida, bo'lmasa — ustida
    const below = rect.bottom + 180 < window.innerHeight
    return below
      ? { transform: `translate(${left}px, ${rect.bottom + PAD + 8}px)`, width }
      : { transform: `translate(${left}px, ${rect.top - PAD - 8}px) translateY(-100%)`, width }
  }

  return createPortal(
    <div className="tour" role="presentation">
      {rect ? (
        <div
          className="tour-spot"
          aria-hidden="true"
          style={{ transform: `translate(${rect.left - PAD}px, ${rect.top - PAD}px)`, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div ref={cardRef} className="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-text" tabIndex={-1} style={cardStyle()}>
        <small className="muted">
          {index + 1} / {TOUR_STEPS.length}
        </small>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-text">{step.text}</p>
        <div className="tour-actions">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tr('O\'tkazib yuborish')}
          </Button>
          <span className="toolbar">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                {tr('Orqaga')}
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
              {last ? tr('Tushunarli') : tr('Keyingi')}
            </Button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
