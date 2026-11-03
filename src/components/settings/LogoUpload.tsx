import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { isLogoDataUrl, LOGO_MAX_BYTES } from '../../utils/guards'
import { Button } from '../ui/Button'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface LogoUploadProps {
  value: string
  logoText: string
  onChange: (value: string) => void
}

// Logotip data URL sifatida sozlamalarda saqlanadi (JSON zaxiraga ham kiradi); yo'q bo'lsa harfli logo
export function LogoUpload({ value, logoText, onChange }: LogoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Faqat PNG, JPG, WEBP, GIF yoki SVG rasm')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError(`Rasm hajmi 200 KB dan oshmasligi kerak (hozir ${Math.ceil(file.size / 1024)} KB)`)
      return
    }
    const dataUrl = await readAsDataUrl(file).catch(() => '')
    if (!isLogoDataUrl(dataUrl)) {
      setError('Rasmni o\'qib bo\'lmadi')
      return
    }
    onChange(dataUrl)
  }

  return (
    <div className="logo-upload">
      <span className="logo-mark logo-preview" aria-hidden="true">
        {value ? <img src={value} alt="" className="logo-image" /> : <span className="logo-text">{logoText || '—'}</span>}
      </span>
      <div className="logo-upload-body">
        <strong id="logo-upload-label">Logotip</strong>
        <small className="muted">PNG, JPG, WEBP yoki SVG, 200 KB gacha. Yuklanmasa harfli logo ko'rinadi.</small>
        <div className="toolbar">
          <Button size="sm" variant="ghost" icon="image" onClick={() => fileRef.current?.click()}>
            {value ? 'Almashtirish' : 'Rasm yuklash'}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => onChange('')}>
              Olib tashlash
            </Button>
          )}
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label="Logotip rasmini tanlash" onChange={handleFile} />
    </div>
  )
}
