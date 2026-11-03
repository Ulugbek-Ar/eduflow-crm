import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { cx } from '../../utils/cx'
import { fixedMenuPosition } from '../../utils/menuPosition'

export interface DropdownItem {
  id: string
  label: string
  description?: string
  icon?: IconName
  // Tanlov guruhi uchun (masalan, mavzu): menuitemradio sifatida chiqadi
  checked?: boolean
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
  // Menyu tepasidagi ma'lumot bloki (masalan, profil ismi) — fokuslanmaydi
  header?: ReactNode
  // 'fixed' — scroll konteyner ichida (masalan, Kanban) menyu kesilmasligi uchun viewport bo'yicha joylashadi:
  // pastda joy bo'lmasa tepaga ochiladi, sahifa scroll bo'lsa yopiladi
  strategy?: 'absolute' | 'fixed'
}

export function Dropdown({ label, trigger, sections, align = 'right', header, strategy = 'absolute' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const triggerEl = rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
    if (strategy === 'fixed' && menu && triggerEl) {
      const { top, left } = fixedMenuPosition(triggerEl.getBoundingClientRect(), menu.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, align)
      menu.style.top = `${top}px`
      menu.style.left = `${left}px`
    }
    // preventScroll: fokus sahifani surmasin (fixed menyu scroll'da yopiladi)
    menu?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true })
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onScroll = (event: Event) => {
      if (!menu?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    if (strategy === 'fixed') {
      window.addEventListener('scroll', onScroll, true)
      window.addEventListener('resize', onScroll)
    }
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, strategy, align])

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
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
          className={cx('dropdown-menu', align === 'left' && 'align-left', strategy === 'fixed' && 'is-fixed')}
          onKeyDown={handleKeyDown}
        >
          {header}
          {sections.map((section) => (
            <div key={section.label} role="group" aria-label={section.label} className="dropdown-section">
              <div className="dropdown-heading" aria-hidden="true">
                {section.label}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  tabIndex={-1}
                  className={cx('dropdown-item', item.checked && 'is-checked')}
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
                  {item.checked && <Icon name="check" size={16} className="dropdown-check" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
