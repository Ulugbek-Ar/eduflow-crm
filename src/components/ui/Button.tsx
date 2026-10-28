import type { ButtonHTMLAttributes, Ref } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { cx } from '../../utils/cx'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
  icon?: IconName
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'primary', size = 'md', icon, className, type = 'button', children, ref, ...rest }: ButtonProps) {
  return (
    <button ref={ref} type={type} className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  tone?: 'default' | 'danger'
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ icon, label, tone = 'default', className, type = 'button', ref, ...rest }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('icon-btn', tone === 'danger' && 'danger', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}
