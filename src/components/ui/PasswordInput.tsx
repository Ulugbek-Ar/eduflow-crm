import { tr } from '../../i18n'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { IconButton } from './Button'
import { Input } from './Input'

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>

// Parol maydoni: ko'z tugmasi bilan yozilganini ko'rish mumkin (telefonda xato yozmaslik uchun).
// Bitta formada bitta shunday maydon — tasdiqlash maydoni oddiy Input
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-field">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <IconButton
        icon={visible ? 'eye' : 'lock'}
        label={visible ? tr('Parolni yashirish') : tr('Parolni ko\'rsatish')}
        className="password-toggle"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      />
    </div>
  )
}
