import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import type { CsvDelimiter, Currency, Settings } from '../../types/dashboard.types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { DataSettings } from './DataSettings'

const CURRENCIES: Record<Currency, string> = {
  UZS: 'O\'zbek so\'mi (UZS)',
  USD: 'AQSH dollari (USD)',
}

const DELIMITERS: Record<CsvDelimiter, string> = {
  ';': 'Nuqtali vergul (;) — Excel UZ/RU',
  ',': 'Vergul (,) — Excel EN, Google Sheets',
}

export function SettingsPanel() {
  const { settings, updateSettings } = useDashboard()
  const [form, setForm] = useState<Settings>(settings)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.orgName.trim()) {
      setError('Tashkilot nomini kiriting')
      return
    }
    setError('')
    updateSettings({ ...form, orgName: form.orgName.trim() })
    setSaved(true)
  }

  return (
    <div className="settings-grid">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <div className="card-head">
          <div>
            <h2>Tashkilot</h2>
            <span className="muted">Asosiy ma'lumotlar</span>
          </div>
        </div>
        <Input label="Tashkilot nomi" required value={form.orgName} error={error} onChange={(e) => update('orgName', e.target.value)} />
        <Select
          label="Valyuta"
          value={form.currency}
          onChange={(e) => update('currency', e.target.value as Currency)}
          options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: CURRENCIES[c] }))}
        />
        <Select
          label="CSV ajratgichi"
          value={form.csvDelimiter}
          onChange={(e) => update('csvDelimiter', e.target.value as CsvDelimiter)}
          options={(Object.keys(DELIMITERS) as CsvDelimiter[]).map((d) => ({ value: d, label: DELIMITERS[d] }))}
        />
        <div className="modal-actions">
          {saved && <span className="text-success">Saqlandi</span>}
          <Button type="submit" icon="save">
            Saqlash
          </Button>
        </div>
      </form>

      <section className="card" aria-labelledby="data-title">
        <div className="card-head">
          <div>
            <h2 id="data-title">Ma'lumotlar</h2>
            <span className="muted">Zaxira, tiklash va demo</span>
          </div>
        </div>
        <DataSettings />
      </section>
    </div>
  )
}
