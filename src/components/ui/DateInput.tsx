import { tr } from '../../i18n'
import { useId, useRef, useState } from 'react'
import type { Ref } from 'react'
import { Icon } from '../../constants/navigation'
import type { DateFormat } from '../../types/dashboard.types'
import { cx, fieldDescription } from '../../utils/cx'
import { datePlaceholder, maskDate, parseDisplayDate, toDisplayDate } from '../../utils/dateInput'
import { FieldShell } from './FieldShell'

interface DateInputProps {
  label: string
  // 'YYYY-MM-DD' yoki '' (bo'sh)
  value: string
  onChange: (value: string) => void
  format?: DateFormat
  min?: string
  max?: string
  error?: string
  hint?: string
  required?: boolean
  id?: string
  className?: string
  ref?: Ref<HTMLInputElement>
}

const canShowPicker = typeof HTMLInputElement !== 'undefined' && 'showPicker' in HTMLInputElement.prototype

// Matnli sana maydoni (sozlamadagi formatda) + kalendar tugmasi (brauzerning sana tanlagichi)
export function DateInput({ label, value, onChange, format = 'dd.mm.yyyy', min, max, error, hint, required, id, className, ref }: DateInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const pickerRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => toDisplayDate(value, format))
  const [touched, setTouched] = useState(false)
  // Qiymat tashqaridan o'zgarsa (filtrni tozalash, kalendar) matn yangilanadi
  const [source, setSource] = useState(value)
  if (value !== source) {
    setSource(value)
    setText(toDisplayDate(value, format))
  }

  const invalid = touched && text !== '' && parseDisplayDate(text, format) === null
  const shownError = error ?? (invalid ? tr('Sanani {0} ko\'rinishida kiriting', { 0: datePlaceholder(format) }) : undefined)

  const handleText = (next: string) => {
    const masked = maskDate(next, format)
    setText(masked)
    if (masked === '') {
      setSource('')
      onChange('')
      return
    }
    // Chala yoki noto'g'ri sana — qiymat bo'sh (eski sana bilan filtrlanib qolmasin)
    const parsed = parseDisplayDate(masked, format) ?? ''
    if (parsed !== source) {
      setSource(parsed)
      onChange(parsed)
    }
  }

  return (
    <FieldShell id={inputId} label={label} error={shownError} hint={hint} required={required} className={cx('date-field', className)}>
      <div className="date-input">
        <input
          ref={ref}
          id={inputId}
          className={cx('input', shownError && 'has-error')}
          inputMode="numeric"
          autoComplete="off"
          placeholder={datePlaceholder(format)}
          value={text}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={fieldDescription(inputId, shownError, hint)}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {canShowPicker && (
          <button
            type="button"
            className="icon-btn date-picker-btn"
            aria-label={tr('{0}: kalendardan tanlash', { 0: label })}
            title={tr('Kalendardan tanlash')}
            onClick={() => pickerRef.current?.showPicker()}
          >
            <Icon name="calendar" size={16} />
          </button>
        )}
        <input
          ref={pickerRef}
          type="date"
          className="date-picker-native"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            setTouched(true)
            onChange(e.target.value)
          }}
        />
      </div>
    </FieldShell>
  )
}
