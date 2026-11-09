import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { callIntegrations, integrationStatus } from '../../data/integrations'
import type { ProviderStatus } from '../../data/integrations'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'
import { isRecord } from '../../utils/guards'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { PasswordInput } from '../ui/PasswordInput'

function errorText(result: { error: string; field?: string }): string {
  if (result.field === 'token') return tr('Token noto\'g\'ri. @BotFather bergan to\'liq tokenni kiriting (masalan, 123456789:AA…).')
  if (result.error === 'webhook') return tr('Telegram webhook\'ni o\'rnatib bo\'lmadi. "telegram" Edge Function deploy qilinganini tekshiring (DEPLOY.md §8).')
  if (result.error === 'forbidden') return tr('Bu amal uchun ruxsatingiz yo\'q')
  if (result.error === 'readonly') return tr('Tarif muddati tugagan — markaz faqat o\'qish rejimida')
  return tr('Server bilan bog\'lanib bo\'lmadi. "integrations" Edge Function deploy qilinganini tekshiring (DEPLOY.md).')
}

// Bulutli rejim: ota-onalar uchun Telegram bot — ulash (BotFather tokeni), xabar turlari, ota-ona qanday ulanadi
export function TelegramSettings() {
  const { settings, updateSettings } = useDashboard()
  const toast = useToast()
  const confirm = useConfirm()
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [alerts, setAlerts] = useState({ absence: settings.botAbsenceAlerts, payment: settings.botPaymentAlerts })

  useEffect(() => {
    let alive = true
    void integrationStatus().then((next) => {
      if (alive) setStatus(next?.telegram ?? { configured: false })
    })
    return () => {
      alive = false
    }
  }, [])

  const connect = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await callIntegrations({ action: 'save', provider: 'telegram', secret: { token: token.trim() } })
    setBusy(false)
    if (!result.ok) return setError(errorText(result))
    const next = isRecord(result.data.status) ? result.data.status : {}
    const username = typeof next.username === 'string' ? next.username : ''
    setStatus({ ...next, configured: true })
    setToken('')
    updateSettings({ ...settings, telegramBot: username }, { silent: true })
    toast.success(tr('Bot ulandi: @{0}', { 0: username }))
  }

  const disconnect = async () => {
    const ok = await confirm({
      title: tr('Botni o\'chirish'),
      message: tr('Bot tokeni serverdan o\'chiriladi, ota-onalarga xabarlar to\'xtaydi. Ulangan ota-onalar saqlanadi — shu botni qayta ulasangiz, xabarlar davom etadi.'),
      confirmLabel: tr('O\'chirish'),
    })
    if (!ok) return
    setBusy(true)
    const result = await callIntegrations({ action: 'remove', provider: 'telegram' })
    setBusy(false)
    if (!result.ok) return setError(errorText(result))
    setStatus({ configured: false })
    // SMS ulangan bo'lsa avtomatik eslatma SMS orqali davom etadi
    updateSettings({ ...settings, telegramBot: '', autoReminders: settings.smsSender ? settings.autoReminders : false }, { silent: true })
    toast.success(tr('O\'chirildi'))
  }

  const saveAlerts = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    updateSettings({ ...settings, botAbsenceAlerts: alerts.absence, botPaymentAlerts: alerts.payment }, { silent: true })
    toast.success(tr('Saqlandi'))
  }

  const configured = status?.configured === true
  const username = typeof status?.username === 'string' && status.username ? status.username : settings.telegramBot

  return (
    <div className="stack">
      <section className="integration" aria-label={tr('Telegram bot')}>
        <div className="integration-head">
          <h3>{tr('Telegram bot')}</h3>
          <Badge tone={configured ? 'paid' : 'neutral'}>{status === null ? tr('Yuklanmoqda...') : configured ? tr('Ulangan') : tr('Ulanmagan')}</Badge>
        </div>
        {configured && username ? (
          <p>
            {tr('Bot')}:{' '}
            <a href={`https://t.me/${username}`} target="_blank" rel="noreferrer">
              @{username}
            </a>
          </p>
        ) : (
          <ol className="steps-list">
            <li>{tr('Telegram\'da @BotFather\'ni oching va /newbot buyrug\'ini yuboring.')}</li>
            <li>{tr('Bot nomini (masalan, "Bilim Plus — ota-onalar") va username\'ini (oxiri _bot) kiriting.')}</li>
            <li>{tr('BotFather bergan tokenni shu yerga kiriting — bot darhol ishga tushadi.')}</li>
          </ol>
        )}
        <form className="form" onSubmit={connect} noValidate>
          <PasswordInput
            label={tr('Bot tokeni')}
            autoComplete="off"
            value={token}
            placeholder={typeof status?.token === 'string' ? status.token : '123456789:AA…'}
            hint={configured ? tr('Yangi token kiritsangiz, bot almashtiriladi. Bo\'sh qoldirib saqlasangiz — webhook qayta o\'rnatiladi.') : undefined}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="toolbar">
            <Button type="submit" icon="check" disabled={busy || (!configured && !token.trim())}>
              {configured ? tr('Saqlash') : tr('Botni ulash')}
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
          <section className="integration" aria-label={tr('Ota-onaga xabarlar')}>
            <h3>{tr('Ota-onaga xabarlar')}</h3>
            <form className="form" onSubmit={saveAlerts} noValidate>
              <label className="check-field">
                <input type="checkbox" checked={alerts.absence} onChange={(e) => setAlerts({ ...alerts, absence: e.target.checked })} />
                <span>
                  {tr('Dars qoldirilganda')}
                  <small className="muted cell-block">{tr('Davomatda "Kelmadi" belgilansa — bir necha daqiqada')}</small>
                </span>
              </label>
              <label className="check-field">
                <input type="checkbox" checked={alerts.payment} onChange={(e) => setAlerts({ ...alerts, payment: e.target.checked })} />
                <span>
                  {tr('To\'lov qabul qilinganda')}
                  <small className="muted cell-block">{tr('Kassada, Payme yoki Click orqali — summa bilan')}</small>
                </span>
              </label>
              <div className="toolbar">
                <Button type="submit" icon="check">
                  {tr('Saqlash')}
                </Button>
              </div>
            </form>
          </section>

          <section className="integration" aria-label={tr('Ota-ona qanday ulanadi')}>
            <h3>{tr('Ota-ona qanday ulanadi')}</h3>
            <ul className="steps-list">
              <li>{tr('O\'quvchi kartasida "Ulash havolasi" — havolani ota-onaga yuboring; u botni ochib "Start"ni bosadi.')}</li>
              <li>{tr('Yoki ota-ona botga yozib, telefon raqamini yuboradi — raqam o\'quvchi kartasidagi bilan bir xil bo\'lsa, ulanadi.')}</li>
              <li>{tr('Botda: qarz (onlayn to\'lov havolasi bilan), oxirgi 30 kun davomati, dars jadvali; til — o\'zbekcha yoki ruscha.')}</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
