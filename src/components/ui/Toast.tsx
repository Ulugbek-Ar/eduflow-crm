import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { ToastContext } from '../../hooks/useToast'
import type { ToastApi, ToastTone } from '../../hooks/useToast'
import { createId } from '../../utils/format'
import { IconButton } from './Button'

interface ToastMessage {
  id: string
  tone: ToastTone
  message: string
}

const DURATION = 4000
const MAX_VISIBLE = 4
const TONE_ICON: Record<ToastTone, IconName> = { success: 'checkCircle', error: 'alert', info: 'info' }

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION)
    return () => window.clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : undefined}>
      <Icon name={TONE_ICON[toast.tone]} size={18} />
      <p>{toast.message}</p>
      <IconButton icon="close" label="Yopish" onClick={() => onDismiss(toast.id)} />
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const push = (tone: ToastTone, message: string) => {
    setToasts((list) => [...list, { id: createId('n'), tone, message }].slice(-MAX_VISIBLE))
  }

  const dismiss = (id: string) => setToasts((list) => list.filter((t) => t.id !== id))

  const api: ToastApi = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }

  return (
    <ToastContext value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-label="Bildirishnomalar">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  )
}
