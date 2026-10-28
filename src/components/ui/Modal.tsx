import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../utils/cx'
import { IconButton } from './Button'

interface ModalProps {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dialog' | 'drawer'
  role?: 'dialog' | 'alertdialog'
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Bir vaqtda ochiq modallar soni: body scroll faqat oxirgisi yopilganda qaytariladi
let openModals = 0

export function Modal({ title, description, onClose, children, footer, size = 'md', variant = 'dialog', role = 'dialog' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openModals += 1
    document.body.classList.add('scroll-locked')

    const dialog = dialogRef.current
    const preferred = dialog?.querySelector<HTMLElement>('[data-autofocus]')
    const firstField = dialog?.querySelector<HTMLElement>('.modal-body input, .modal-body select, .modal-body textarea')
    ;(preferred ?? firstField ?? dialog)?.focus()

    return () => {
      openModals -= 1
      if (openModals === 0) document.body.classList.remove('scroll-locked')
      previous?.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={cx('modal-overlay', variant === 'drawer' && 'is-drawer')}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className={cx(variant === 'drawer' ? 'drawer' : 'modal', `modal-${size}`)}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descriptionId} className="muted">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="close" label="Yopish" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
