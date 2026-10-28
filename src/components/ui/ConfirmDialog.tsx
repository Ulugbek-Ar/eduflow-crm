import { useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmContext } from '../../hooks/useConfirm'
import type { ConfirmOptions } from '../../hooks/useConfirm'
import { Button } from './Button'
import { Modal } from './Modal'

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

interface ConfirmDialogProps {
  options: ConfirmOptions
  onResult: (value: boolean) => void
}

export function ConfirmDialog({ options, onResult }: ConfirmDialogProps) {
  const tone = options.tone ?? 'danger'
  return (
    <Modal
      title={options.title}
      onClose={() => onResult(false)}
      size="sm"
      role="alertdialog"
      footer={
        <>
          <Button variant="ghost" onClick={() => onResult(false)} data-autofocus={tone === 'danger' ? true : undefined}>
            {options.cancelLabel ?? 'Bekor qilish'}
          </Button>
          <Button variant={tone} onClick={() => onResult(true)} data-autofocus={tone === 'primary' ? true : undefined}>
            {options.confirmLabel ?? 'Tasdiqlash'}
          </Button>
        </>
      }
    >
      <p className="confirm-message">{options.message}</p>
    </Modal>
  )
}

// useConfirm() orqali chaqiriladigan, Promise qaytaradigan tasdiqlash oynasi
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      setPending({ options, resolve })
    })

  const handleResult = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }

  return (
    <ConfirmContext value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending.options} onResult={handleResult} />}
    </ConfirmContext>
  )
}
