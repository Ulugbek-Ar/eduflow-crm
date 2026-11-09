import { useEffect, useState } from 'react'
import { callIntegrations, telegramLinkCount } from '../../data/integrations'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'
import { Button } from '../ui/Button'
import { CopyField } from '../ui/CopyField'

const ERRORS: Record<string, string> = {
  forbidden: tr('Bu amal uchun ruxsatingiz yo\'q'),
  'not-configured': tr('Telegram bot ulanmagan (Sozlamalar → Telegram bot)'),
  customer: tr('Bu o\'quvchi uchun havola yaratib bo\'lmadi'),
}

const serverError = (error: string) => ERRORS[error] ?? tr('Server bilan bog\'lanib bo\'lmadi. "integrations" Edge Function deploy qilinganini tekshiring (DEPLOY.md).')

// Bulutli rejim, bot ulangan: o'quvchi kartasida ota-onani botga ulash (havola) va uzish
export function ParentBot({ customerId, name, bot }: { customerId: string; name: string; bot: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [chats, setChats] = useState<number | null>(null)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void telegramLinkCount(customerId).then((count) => {
      if (alive) setChats(count ?? 0)
    })
    return () => {
      alive = false
    }
  }, [customerId])

  const makeLink = async () => {
    setBusy(true)
    setError('')
    const result = await callIntegrations({ action: 'telegram.link', customerId })
    setBusy(false)
    if (!result.ok) return setError(serverError(result.error))
    if (typeof result.data.link === 'string') setLink(result.data.link)
  }

  const share = () => {
    void navigator.share?.({ title: `@${bot}`, text: tr('{0}: davomat va to\'lovlar haqida xabarlarni Telegram\'da olish uchun havolani oching', { 0: name }), url: link }).catch(() => null)
  }

  const unlink = async () => {
    const ok = await confirm({
      title: tr('Botdan uzish'),
      message: tr('{0} bo\'yicha ota-ona chatlari botdan uziladi va xabarlar to\'xtaydi. Ota-ona keyin qayta ulanishi mumkin.', { 0: name }),
      confirmLabel: tr('Uzish'),
    })
    if (!ok) return
    setBusy(true)
    const result = await callIntegrations({ action: 'telegram.unlink', customerId })
    setBusy(false)
    if (!result.ok) return setError(serverError(result.error))
    setChats(0)
    toast.success(tr('Botdan uzildi'))
  }

  return (
    <section className="parent-bot" aria-labelledby={`parent-bot-${customerId}`}>
      <h3 id={`parent-bot-${customerId}`} className="detail-subtitle">
        {tr('Ota-ona Telegram\'i')}
      </h3>
      <p className="parent-bot-status">
        {chats === null ? tr('Yuklanmoqda...') : chats > 0 ? tr('Botga ulangan: {0} ta chat', { 0: chats }) : tr('Hali ulanmagan')}
      </p>
      <p className="small-note muted">{tr('Ota-ona @{0} botida dars qoldirilganda va to\'lov qabul qilinganda xabar oladi, qarz, davomat va jadvalni so\'raydi.', { 0: bot })}</p>
      {link && <CopyField label={tr('Ulash havolasi (ota-onaga yuboring)')} value={link} />}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="toolbar">
        {!link && (
          <Button variant="ghost" icon="userPlus" disabled={busy} onClick={() => void makeLink()}>
            {tr('Ulash havolasi')}
          </Button>
        )}
        {link && typeof navigator.share === 'function' && (
          <Button variant="ghost" icon="arrowUpRight" onClick={share}>
            {tr('Ulashish')}
          </Button>
        )}
        {chats !== null && chats > 0 && (
          <Button variant="ghost" icon="ban" disabled={busy} onClick={() => void unlink()}>
            {tr('Botdan uzish')}
          </Button>
        )}
      </div>
    </section>
  )
}
