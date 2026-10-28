import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from '../../constants/navigation'
import { cx } from '../../utils/cx'
import { IconButton } from './Button'
import { FieldShell } from './FieldShell'

export interface ComboboxOption {
  value: string
  label: string
  description?: string
}

interface ComboboxProps {
  label: string
  options: readonly ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  hint?: string
}

const MAX_VISIBLE = 50

export function Combobox({ label, options, value, onChange, placeholder, emptyText = 'Hech narsa topilmadi', hint }: ComboboxProps) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((o) => o.value === value)
  const needle = query.trim().toLowerCase()
  const filtered = options
    .filter((o) => !needle || `${o.label} ${o.description ?? ''}`.toLowerCase().includes(needle))
    .slice(0, MAX_VISIBLE)
  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0))

  const choose = (option: ComboboxOption) => {
    onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) setOpen(true)
        else setActive(Math.min(activeIndex + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(Math.max(activeIndex - 1, 0))
        break
      case 'Enter':
        if (open && filtered[activeIndex]) {
          event.preventDefault()
          choose(filtered[activeIndex])
        }
        break
      case 'Escape':
        if (open) {
          // Modalning o'zi yopilib ketmasligi uchun
          event.stopPropagation()
          setOpen(false)
          setQuery('')
        }
        break
    }
  }

  return (
    <FieldShell id={id} label={label} hint={hint}>
      <div className="combobox">
        <Icon name="search" size={16} className="combobox-icon" />
        <input
          id={id}
          className="input combobox-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          autoComplete="off"
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected?.label ?? placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setQuery('')
          }}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <IconButton icon="close" label="Tanlovni tozalash" className="combobox-clear" onClick={() => onChange('')} />
        )}
        {open && (
          <ul id={listId} role="listbox" className="combobox-list" aria-label={label}>
            {filtered.length === 0 ? (
              <li className="combobox-empty">{emptyText}</li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={cx('combobox-option', index === activeIndex && 'is-active')}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </FieldShell>
  )
}
