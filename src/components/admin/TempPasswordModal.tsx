import { tr } from '../../i18n'
import { useId, useState } from 'react'
import { BRAND } from '../../constants/app'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../ui/Button'
import { Modal } from '../ui/Modal'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Parol yoki login: o'qish uchun maydon + nusxa olish tugmasi
export function CopyField({ label, value, error, onRegenerate }: { label: string; value: string; error?: string; onRegenerate?: () => void }) {
  const id = useId()
  const toast = useToast()
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="copy-field">
        <input id={id} className="input mono" readOnly value={value} aria-invalid={error ? true : undefined} onFocus={(e) => e.target.select()} />
        {onRegenerate && <IconButton icon="refresh" label={tr('Boshqa parol yaratish')} onClick={onRegenerate} />}
        <IconButton
          icon="copy"
          label={tr('{0}: nusxa olish', { 0: label })}
          onClick={async () => {
            if (await copyText(value)) toast.success(tr('Nusxa olindi'))
            else toast.error(tr('Nusxa olib bo\'lmadi — matnni belgilab o\'zingiz ko\'chiring'))
          }}
        />
      </div>
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </>
  )
}

interface TempPasswordModalProps {
  title: string
  fullName: string
  login: string
  password: string
  onClose: () => void
}

// Vaqtinchalik parol faqat shu oynada bir marta ko'rinadi — keyin uni hech kim (administrator ham) ko'ra olmaydi
export function TempPasswordModal({ title, fullName, login, password, onClose }: TempPasswordModalProps) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const message = tr('{0}, {3}\'ga kirish uchun:\nLogin: {1}\nVaqtinchalik parol: {2}\nBirinchi kirishda o\'z parolingizni o\'rnatasiz.', { 0: fullName, 1: login, 2: password, 3: BRAND.shortName })

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            icon="copy"
            onClick={async () => {
              const ok = await copyText(message)
              setCopied(ok)
              if (ok) toast.success(tr('Xabar nusxalandi — xodimga yuboring'))
              else toast.error(tr('Nusxa olib bo\'lmadi — matnni o\'zingiz ko\'chiring'))
            }}
          >
            {copied ? tr('Nusxalandi') : tr('Xabarni nusxalash')}
          </Button>
          <Button icon="check" onClick={onClose} data-autofocus>
            {tr('Tayyor')}
          </Button>
        </>
      }
    >
      <div className="form">
        <p className="notice notice-warning">{tr('Bu parolni hozir xodimga bering. Oyna yopilgach, uni qayta ko\'rib bo\'lmaydi.')}</p>
        <div className="field">
          <CopyField label={tr('Login')} value={login} />
        </div>
        <div className="field">
          <CopyField label={tr('Vaqtinchalik parol')} value={password} />
        </div>
        <small className="field-hint">{tr('Xodim birinchi kirishda o\'z parolini o\'rnatadi.')}</small>
      </div>
    </Modal>
  )
}
