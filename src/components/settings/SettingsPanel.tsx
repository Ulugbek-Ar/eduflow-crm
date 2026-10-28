import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEFAULT_SETTINGS } from '../../constants/mockData'
import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import { dateStamp, downloadJson } from '../../services/export.service'
import type { Currency, Settings } from '../../types/dashboard.types'

const CURRENCIES: Record<Currency, string> = {
  UZS: 'O\'zbek so\'mi (UZS)',
  USD: 'AQSH dollari (USD)',
}

export function SettingsPanel() {
  const { settings, updateSettings, resetData, customers, transactions } = useDashboard()
  const confirm = useConfirm()
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

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Ma\'lumotlarni tiklash',
      message: 'Barcha o\'zgarishlar o\'chadi va demo ma\'lumotlar qaytadi. Davom etasizmi?',
      confirmLabel: 'Tiklash',
    })
    if (!ok) return
    resetData()
    setForm({ ...DEFAULT_SETTINGS })
    setSaved(false)
  }

  const handleBackup = () => {
    downloadJson(`apex-zaxira-${dateStamp()}.json`, {
      exportedAt: new Date().toISOString(),
      settings,
      customers,
      transactions,
    })
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

        <label className="field">
          <span>Tashkilot nomi *</span>
          <input
            className={`input${error ? ' has-error' : ''}`}
            value={form.orgName}
            onChange={(e) => update('orgName', e.target.value)}
          />
          {error && <small className="error">{error}</small>}
        </label>

        <label className="field">
          <span>Valyuta</span>
          <select className="input" value={form.currency} onChange={(e) => update('currency', e.target.value as Currency)}>
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
              <option key={c} value={c}>
                {CURRENCIES[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Admin login</span>
          <input className="input" value={form.adminLogin} readOnly disabled />
        </label>

        <div className="modal-actions">
          {saved && <span className="text-success">Saqlandi</span>}
          <button type="submit" className="btn btn-primary">
            <Icon name="save" size={16} />
            <span>Saqlash</span>
          </button>
        </div>
      </form>

      <div className="card form">
        <div className="card-head">
          <div>
            <h2>Ma'lumotlar</h2>
            <span className="muted">
              {customers.length} ta mijoz, {transactions.length} ta tranzaksiya brauzerda saqlangan
            </span>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <strong>JSON zaxira</strong>
            <p className="muted">Barcha ma'lumotlarni bitta faylga yuklab olish</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleBackup}>
            <Icon name="download" size={16} />
            <span>Yuklab olish</span>
          </button>
        </div>

        <div className="setting-row">
          <div>
            <strong>Ma'lumotlarni tiklash</strong>
            <p className="muted">Barcha o'zgarishlar o'chadi va demo ma'lumotlar qaytadi</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={handleReset}>
            <Icon name="refresh" size={16} />
            <span>Tiklash</span>
          </button>
        </div>
      </div>
    </div>
  )
}
