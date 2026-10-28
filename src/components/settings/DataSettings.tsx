import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import { dateStamp, downloadJson } from '../../services/export.service'
import { createBackup, parseBackup } from '../../services/storage.service'
import type { StoredData } from '../../services/storage.service'
import { formatDate } from '../../utils/format'
import { Button } from '../ui/Button'

interface ImportPreview {
  fileName: string
  data: StoredData
  dropped: number
  exportedAt?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

export function DataSettings() {
  const { customers, transactions, settings, resetData, replaceData } = useDashboard()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleBackup = () => {
    downloadJson(`apex-zaxira-${dateStamp()}.json`, createBackup({ customers, transactions, settings }))
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    setMessage('')
    setPreview(null)
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError('Fayl hajmi 10 MB dan oshmasligi kerak')
      return
    }
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPreview({ fileName: file.name, data: result.data, dropped: result.dropped, exportedAt: result.exportedAt })
  }

  const applyImport = async () => {
    if (!preview) return
    const ok = await confirm({
      title: 'Zaxirani tiklash',
      message: `Joriy ma'lumotlar (${customers.length} mijoz, ${transactions.length} tranzaksiya) zaxiradagilar bilan almashtiriladi. Davom etasizmi?`,
      confirmLabel: 'Almashtirish',
    })
    if (!ok) return
    replaceData(preview.data)
    setMessage(`Zaxira tiklandi: ${preview.data.customers.length} mijoz, ${preview.data.transactions.length} tranzaksiya`)
    setPreview(null)
  }

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Demo ma\'lumotlarga qaytarish',
      message: 'Barcha mijozlar, tranzaksiyalar va sozlamalar o\'chib, demo ma\'lumotlar qaytadi. Bu amalni ortga qaytarib bo\'lmaydi.',
      confirmLabel: 'Tiklash',
    })
    if (!ok) return
    resetData()
    setPreview(null)
    setMessage('Demo ma\'lumotlar tiklandi')
  }

  return (
    <div className="settings-rows">
      <p className="muted">
        Brauzerda saqlangan: {customers.length} ta mijoz, {transactions.length} ta tranzaksiya.
      </p>

      <div className="setting-row">
        <div>
          <strong>JSON zaxira</strong>
          <p className="muted">Barcha ma'lumot va sozlamalarni bitta faylga yuklab olish</p>
        </div>
        <Button variant="ghost" icon="download" onClick={handleBackup}>
          Yuklab olish
        </Button>
      </div>

      <div className="setting-row">
        <div>
          <strong>Zaxiradan tiklash</strong>
          <p className="muted">Avval yuklab olingan .json faylni tanlang — oldindan ko'rib, keyin tasdiqlaysiz</p>
        </div>
        <Button variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
          Faylni tanlash
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Zaxira faylini tanlash"
          onChange={handleFile}
        />
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice notice-success" role="status">
          {message}
        </p>
      )}

      {preview && (
        <div className="import-preview" role="region" aria-label="Import oldindan ko'rish">
          <strong>{preview.fileName}</strong>
          <p>
            {preview.data.customers.length} mijoz, {preview.data.transactions.length} tranzaksiya, {preview.data.settings.courses.length} kurs
            {preview.exportedAt && ` · ${formatDate(preview.exportedAt)} da yaratilgan`}
          </p>
          {preview.dropped > 0 && <p className="text-danger">{preview.dropped} ta buzuq yozuv tashlab yuboriladi</p>}
          <div className="import-actions">
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Bekor qilish
            </Button>
            <Button icon="check" onClick={applyImport}>
              Almashtirish
            </Button>
          </div>
        </div>
      )}

      <div className="setting-row">
        <div>
          <strong>Demo ma'lumotlarga qaytarish</strong>
          <p className="muted">Barcha o'zgarishlar o'chadi va demo ma'lumotlar qaytadi</p>
        </div>
        <Button variant="danger" icon="refresh" onClick={handleReset}>
          Tiklash
        </Button>
      </div>
    </div>
  )
}
