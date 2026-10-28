import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { cx } from '../../utils/cx'

export interface DropdownItem {
  id: string
  label: string
  description?: string
  icon?: IconName
  onSelect: () => void
}

export interface DropdownSection {
  label: string
  items: DropdownItem[]
}

interface DropdownProps {
  label: string
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-controls': string }) => ReactNode
  sections: DropdownSection[]
  align?: 'left' | 'right'
}

export function Dropdown({ label, trigger, sections, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        items[(index + 1) % items.length]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        items[(index - 1 + items.length) % items.length]?.focus()
        break
      case 'Home':
        event.preventDefault()
        items[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        items[items.length - 1]?.focus()
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(true)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="dropdown" ref={rootRef}>
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': menuId })}
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={cx('dropdown-menu', align === 'left' && 'align-left')}
          onKeyDown={handleKeyDown}
        >
          {sections.map((section) => (
            <div key={section.label} role="group" aria-label={section.label} className="dropdown-section">
              <div className="dropdown-heading" aria-hidden="true">
                {section.label}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="dropdown-item"
                  onClick={() => {
                    item.onSelect()
                    close(true)
                  }}
                >
                  {item.icon && <Icon name={item.icon} size={16} />}
                  <span>
                    {item.label}
                    {item.description && <small>{item.description}</small>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
