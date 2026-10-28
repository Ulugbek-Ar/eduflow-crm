import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'

interface FieldShellProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function FieldShell({ id, label, error, hint, required, className, children }: FieldShellProps) {
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      ) : (
        hint && (
          <small id={`${id}-hint`} className="field-hint">
            {hint}
          </small>
        )
      )}
    </div>
  )
}
