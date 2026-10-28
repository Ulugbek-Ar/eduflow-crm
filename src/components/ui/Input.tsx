import { useId } from 'react'
import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react'
import { cx, fieldDescription } from '../../utils/cx'
import { FieldShell } from './FieldShell'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  ref?: Ref<HTMLInputElement>
}

export function Input({ label, error, hint, id, className, ref, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint} required={rest.required}>
      <input
        ref={ref}
        id={inputId}
        className={cx('input', error && 'has-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescription(inputId, error, hint)}
        {...rest}
      />
    </FieldShell>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, id, className, ...rest }: TextareaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint} required={rest.required}>
      <textarea
        id={inputId}
        className={cx('input', 'textarea', error && 'has-error', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescription(inputId, error, hint)}
        {...rest}
      />
    </FieldShell>
  )
}
