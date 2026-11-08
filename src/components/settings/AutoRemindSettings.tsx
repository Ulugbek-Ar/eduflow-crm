import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

// Bulutli rejim: kunlik avtomatik qarz eslatmasi. Server (cron) har kuni ertalab yuboradi:
// ota-onasi Telegram botga ulangan o'quvchilarga — bot orqali, qolganlarga — SMS (Eskiz ulangan bo'lsa)
export function AutoRemindSettings() {
  const { settings, updateSettings } = useDashboard()
  const toast = useToast()
  const [auto, setAuto] = useState({ enabled: settings.autoReminders, everyDays: String(settings.autoRemindEveryDays), lang: settings.autoRemindLang })
  const sms = Boolean(settings.smsSender)
  const bot = Boolean(settings.telegramBot)

  if (!sms && !bot) {
    return <p className="notice notice-info">{tr('Avval SMS (Eskiz) yoki Telegram botni ulang — avtomatik eslatma shu kanallar orqali yuboriladi.')}</p>
  }

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const everyDays = Math.min(30, Math.max(3, Math.round(Number(auto.everyDays) || 7)))
    updateSettings({ ...settings, autoReminders: auto.enabled, autoRemindEveryDays: everyDays, autoRemindLang: auto.lang }, { silent: true })
    setAuto((a) => ({ ...a, everyDays: String(everyDays) }))
    toast.success(auto.enabled ? tr('Avtomatik eslatma yoqildi') : tr('Avtomatik eslatma o\'chirildi'))
  }

  const channels = bot && sms ? tr('Ota-onasi Telegram botga ulangan o\'quvchilarga — bot orqali (bepul), qolganlarga — SMS') : bot ? tr('Faqat ota-onasi Telegram botga ulangan o\'quvchilarga (SMS ulanmagan)') : tr('SMS orqali (Telegram bot ulanmagan)')

  return (
    <form className="form" onSubmit={save} noValidate aria-label={tr('Avtomatik eslatma')}>
      <label className="check-field">
        <input type="checkbox" checked={auto.enabled} onChange={(e) => setAuto({ ...auto, enabled: e.target.checked })} />
        <span>
          {tr('Har kuni ertalab qarzdorlarga eslatma yuborish')}
          <small className="muted cell-block">{channels}</small>
          <small className="muted cell-block">{tr('To\'lov muddati o\'tgan o\'quvchilarga shablon bo\'yicha; onlayn to\'lov ulangan bo\'lsa — havola bilan')}</small>
        </span>
      </label>
      <div className="form-row">
        <Input
          label={tr('Bir o\'quvchiga necha kunda bir marta')}
          type="number"
          min={3}
          max={30}
          inputMode="numeric"
          value={auto.everyDays}
          hint={tr('3–30 kun; xodim yuborgan eslatmalar ham hisobga olinadi')}
          onChange={(e) => setAuto({ ...auto, everyDays: e.target.value })}
        />
        <Select
          label={tr('Xabar tili')}
          value={auto.lang}
          hint={bot ? tr('Botda — ota-ona tanlagan tilda') : undefined}
          onChange={(e) => setAuto({ ...auto, lang: e.target.value === 'ru' ? 'ru' : 'uz' })}
          options={[
            { value: 'uz', label: 'O\'zbekcha' },
            { value: 'ru', label: 'Русский' },
          ]}
        />
      </div>
      <div className="toolbar">
        <Button type="submit" icon="check">
          {tr('Saqlash')}
        </Button>
      </div>
    </form>
  )
}
