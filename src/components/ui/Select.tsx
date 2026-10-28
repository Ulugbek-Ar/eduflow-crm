import { useId } from 'react'
import type { Ref, SelectHTMLAttributes } from 'react'
import { cx, fieldDescription } from '../../utils/cx'
import type { SelectOption } from '../../utils/cx'
import { FieldShell } from './FieldShell'


interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string
  options: readonly SelectOption[]
  error?: string
  hint?: string
  hideLabel?: boolean
  ref?: Ref<HTMLSelectElement>
}

export function Select({ label, options, error, hint, hideLabel, id, className, ref, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const control = (
    <select
      ref={ref}
      id={selectId}
      className={cx('input', error && 'has-error', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={fieldDescription(selectId, error, hint)}
      aria-label={hideLabel ? label : undefined}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
  if (hideLabel) return control
  return (
    <FieldShell id={selectId} label={label} error={error} hint={hint} required={rest.required}>
      {control}
    </FieldShell>
  )
}
