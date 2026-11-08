import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { callIntegrations, integrationStatus, recentSms } from '../../data/integrations'
import type { ProviderStatus, SmsLogEntry } from '../../data/integrations'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'
import { formatPhone } from '../../utils/phone'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'

export const ESKIZ_TEST_TEXT = 'This is test from Eskiz'

const KIND_LABELS: Record<SmsLogEntry['kind'], string> = {
  reminder: tr('Eslatma'),
  auto: tr('Avtomatik'),
  test: tr('Sinov'),
}

function errorText(result: { error: string; field?: string }): string {
  if (result.field === 'email') return tr('Eskiz hisobining emailini kiriting')
  if (result.field === 'password') return tr('Eskiz login yoki paroli noto\'g\'ri (my.eskiz.uz hisobingiz)')
  if (result.field === 'from') return tr('Jo\'natuvchi nomi 2–11 belgi (tasdiqlangan nom yoki 4546)')
  if (result.error === 'forbidden') return tr('Bu amal uchun ruxsatingiz yo\'q')
  if (result.error === 'readonly') return tr('Tarif muddati tugagan — markaz faqat o\'qish rejimida')
  if (result.error === 'sms') return tr('SMS yuborilmadi. Sinov hisobida faqat "{0}" matni yuboriladi; boshqa matnni Eskiz moderatsiyasidan o\'tkazing.', { 0: ESKIZ_TEST_TEXT })
  return tr('Server bilan bog\'lanib bo\'lmadi. "integrations" Edge Function deploy qilinganini tekshiring (DEPLOY.md).')
}

// Bulutli rejim: SMS (Eskiz) — ulash, sinov SMS va jurnal (avtomatik eslatma — AutoRemindSettings)
export function SmsSettings() {
  const { settings, updateSettings, formatDate } = useDashboard()
  const toast = useToast()
  const confirm = useConfirm()
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [log, setLog] = useState<SmsLogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState({ email: '', password: '', from: settings.smsSender || '4546' })
  const [test, setTest] = useState({ phone: '', text: ESKIZ_TEST_TEXT })

  const load = async () => {
    const [next, entries] = await Promise.all([integrationStatus(), recentSms()])
    setStatus(next?.eskiz ?? { configured: false })
    setLog(entries ?? [])
  }

  useEffect(() => {
    let alive = true
    void Promise.all([integrationStatus(), recentSms()]).then(([next, entries]) => {
      if (!alive) return
      setStatus(next?.eskiz ?? { configured: false })
      setLog(entries ?? [])
    })
    return () => {
      alive = false
    }
  }, [])

  const connect = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await callIntegrations({ action: 'save', provider: 'eskiz', secret: account })
    setBusy(false)
    if (!result.ok) return setError(errorText(result))
    updateSettings({ ...settings, smsSender: account.from.trim() || '4546' }, { silent: true })
    setAccount((a) => ({ ...a, password: '' }))
    toast.success(tr('Eskiz SMS ulandi'))
    void load()
  }

  const disconnect = async () => {
    const ok = await confirm({
      title: tr('SMS\'ni o\'chirish'),
      message: tr('Eskiz login va paroli serverdan o\'chiriladi, SMS eslatmalar to\'xtaydi. SMS jurnali saqlanadi.'),
      confirmLabel: tr('O\'chirish'),
    })
    if (!ok) return
    setBusy(true)
    const result = await callIntegrations({ action: 'remove', provider: 'eskiz' })
    setBusy(false)
    if (!result.ok) return setError(errorText(result))
    // Bot ulangan bo'lsa avtomatik eslatma bot orqali davom etadi
    updateSettings({ ...settings, smsSender: '', autoReminders: settings.telegramBot ? settings.autoReminders : false }, { silent: true })
    toast.success(tr('O\'chirildi'))
    void load()
  }

  const sendTest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await callIntegrations({ action: 'sms.test', phone: test.phone, text: test.text })
    setBusy(false)
    if (!result.ok) return setError(errorText(result))
    toast.success(tr('Sinov SMS yuborildi'))
    void load()
  }

  const configured = status?.configured === true

  return (
    <div className="stack">
      <section className="integration" aria-label="Eskiz">
        <div className="integration-head">
          <h3>Eskiz.uz</h3>
          <Badge tone={configured ? 'paid' : 'neutral'}>{configured ? tr('Ulangan') : tr('Ulanmagan')}</Badge>
        </div>
        <form className="form" onSubmit={connect} noValidate>
          <div className="form-row">
            <Input label={tr('Eskiz email')} type="email" autoComplete="off" value={account.email} placeholder={typeof status?.email === 'string' ? status.email : 'markaz@mail.uz'} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
            <PasswordInput label={tr('Eskiz paroli')} autoComplete="off" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
          </div>
          <Input label={tr('Jo\'natuvchi nomi')} value={account.from} maxLength={11} hint={tr('Eskiz tasdiqlagan nom (masalan, markaz nomi) yoki standart 4546')} onChange={(e) => setAccount({ ...account, from: e.target.value })} />
          <div className="toolbar">
            <Button type="submit" icon="check" disabled={busy}>
              {configured ? tr('Saqlash') : tr('Eskiz\'ni ulash')}
            </Button>
            {configured && (
              <Button variant="ghost" icon="trash" disabled={busy} onClick={() => void disconnect()}>
                {tr('O\'chirish')}
              </Button>
            )}
          </div>
        </form>
      </section>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {configured && (
        <>
          <section className="integration" aria-label={tr('Sinov SMS')}>
            <h3>{tr('Sinov SMS')}</h3>
            <form className="form" onSubmit={sendTest} noValidate>
              <div className="form-row">
                <Input label={tr('Telefon')} inputMode="tel" value={test.phone} placeholder="+998 90 123 45 67" onChange={(e) => setTest({ ...test, phone: formatPhone(e.target.value) })} />
                <Input label={tr('Matn')} value={test.text} maxLength={300} onChange={(e) => setTest({ ...test, text: e.target.value })} />
              </div>
              <div className="toolbar">
                <Button type="submit" variant="ghost" icon="mail" disabled={busy}>
                  {tr('Sinov SMS yuborish')}
                </Button>
              </div>
            </form>
          </section>

          <section className="integration" aria-label={tr('SMS jurnali')}>
            <h3>{tr('SMS jurnali')}</h3>
            {log.length === 0 ? (
              <p className="muted">{tr('Hali SMS yuborilmagan.')}</p>
            ) : (
              <ul className="sms-log">
                {log.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{formatPhone(entry.phone)}</strong>
                      <small className="muted cell-block">
                        {formatDate(entry.createdAt)} · {KIND_LABELS[entry.kind]}
                      </small>
                      <small className="sms-text">{entry.status === 'failed' && entry.error ? entry.error : entry.text}</small>
                    </div>
                    <Badge tone={entry.status === 'sent' ? 'paid' : 'expense'}>{entry.status === 'sent' ? tr('Yuborildi') : tr('Xato')}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
