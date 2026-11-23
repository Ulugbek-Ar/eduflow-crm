import { useState } from 'react'
import { tr } from '../../i18n'
import { Button } from './Button'
import { Input } from './Input'

// Faqat o'qiladigan maydon + "Nusxa" tugmasi (webhook manzili, ulash havolasi)
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="copy-field">
      <Input label={label} value={value} readOnly onFocus={(e) => e.target.select()} />
      <Button
        variant="ghost"
        icon={copied ? 'check' : 'copy'}
        onClick={() => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }}
      >
        {copied ? tr('Nusxa olindi') : tr('Nusxa')}
      </Button>
    </div>
  )
}
