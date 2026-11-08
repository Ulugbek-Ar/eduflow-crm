import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { getLang, LANG_LABELS, tr } from '../../i18n'
import type { Lang } from '../../i18n'
import type { DebtRow } from '../../utils/debts'
import { useCloudOrgId } from '../../hooks/useCloudOrg'
import { onlinePaymentsEnabled, paymentLink } from '../../utils/paymentLinks'
import { refreshAudit } from '../../services/audit.service'
import { fillTemplate, monthName, smsSegments, smsUrl, telegramShare, withPaymentLink } from '../../utils/reminders'
import { cx } from '../../utils/cx'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Input'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// To'lov eslatmasi: Sozlamalardagi shablon (o'zbek yoki rus) bo'yicha tayyor matn. Amallar: nusxa, Telegram, SMS, qo'ng'iroq.
// Birinchi amal bajarilganda "Eslatildi" jurnalga yoziladi (qarzdorlar ro'yxatida "Oxirgi eslatma: N kun oldin")
export function ReminderDialog({ rows, onClose }: { rows: DebtRow[]; onClose: () => void }) {
  const { settings, money, logReminders } = useDashboard()
  const cloud = useCloudOrgId() !== null
  // Onlayn to'lov (bulut, Payme yoki Click ulangan): har bir xabarga shu o'quvchining to'lov havolasi
  const linksAvailable = cloud && onlinePaymentsEnabled(settings)
  // SMS (bulut, Eskiz ulangan): server yuboradi va jurnalga o'zi yozadi
  const smsAvailable = cloud && Boolean(settings.smsSender)
  const [smsBusy, setSmsBusy] = useState(false)
  const [withLink, setWithLink] = useState(true)
  const [lang, setLang] = useState<Lang>(getLang())
  const [status, setStatus] = useState('')
  const [logged, setLogged] = useState(false)
  const template = lang === 'ru' ? settings.reminderTemplateRu : settings.reminderTemplateUz
  const [now] = useState(() => new Date())
  const messageFor = (row: DebtRow) => {
    const link = linksAvailable ? paymentLink(settings, row.customer.phone, row.debt, lang) : null
    const text = fillTemplate(template, {
      ism: row.customer.name,
      summa: money(row.debt),
      kurs: row.course.name,
      guruh: row.label,
      oy: monthName(now, lang),
      markaz: settings.orgName,
      telefon: settings.phone,
      havola: link && withLink ? link : '',
    })
    return withPaymentLink(template, text, link, lang, withLink)
  }
  const single = rows.length === 1 ? rows[0] : null
  const text = single ? messageFor(single) : rows.map((r) => `${r.customer.name} (${r.customer.phone}):\n${messageFor(r)}`).join('\n\n')

  const sendSms = async () => {
    setSmsBusy(true)
    setStatus('')
    // Supabase mijozi faqat shu yerda (bulutli rejimda) yuklanadi
    const { callIntegrations } = await import('../../data/integrations')
    const result = await callIntegrations({ action: 'sms.send', messages: rows.map((r) => ({ customerId: r.customer.id, text: messageFor(r) })) })
    setSmsBusy(false)
    if (!result.ok) {
      return setStatus(result.error === 'not-configured' ? tr('SMS ulanmagan: Sozlamalar → SMS (Eskiz)') : tr('SMS yuborilmadi. Internet va Eskiz sozlamasini tekshiring.'))
    }
    const sent = Number(result.data.sent ?? 0)
    const failed = Number(result.data.failed ?? 0)
    setStatus(failed > 0 ? tr('{0} ta SMS yuborildi, {1} tasi yuborilmadi (SMS jurnalida sababi)', { 0: sent, 1: failed }) : tr('{0} ta SMS yuborildi', { 0: sent }))
    if (sent > 0) {
      setLogged(true)
      void refreshAudit()
    }
  }

  const mark = (channel: string) => {
    if (logged) return
    setLogged(true)
    logReminders(rows.map((r) => r.customer.id), channel)
  }

  return (
    <Modal
      title={single ? tr('To\'lov eslatmasi: {0}', { 0: single.customer.name }) : tr('Eslatma: {0} ta qarzdor', { 0: rows.length })}
      description={single ? `${single.label} · ${tr('Qarz: {0}', { 0: money(single.debt) })}` : tr('Matnlar bitta nusxada — har birini o\'z chatiga yuboring')}
      onClose={onClose}
      size="sm"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {tr('Yopish')}
        </Button>
      }
    >
      <div className="stack">
        <div className="segmented" role="group" aria-label={tr('Eslatma tili')}>
          {(['uz', 'ru'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} className={cx(lang === l && 'is-active')} onClick={() => setLang(l)}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
        {linksAvailable && (
          <label className="check-field">
            <input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} />
            <span>
              {tr('To\'lov havolasini qo\'shish (Payme / Click)')}
              <small className="muted cell-block">{tr('Ota-ona havola orqali to\'lasa, to\'lov kassaga avtomatik kirim bo\'ladi')}</small>
            </span>
          </label>
        )}
        <Textarea label={tr('Xabar matni')} value={text} readOnly rows={single ? 5 : 9} onFocus={(e) => e.target.select()} />
        <div className="reminder-actions">
          <Button
            icon="copy"
            data-autofocus
            onClick={async () => {
              const ok = await copy(text)
              setStatus(ok ? tr('Nusxa olindi') : tr('Nusxa olib bo\'lmadi: matnni belgilab, qo\'lda nusxa oling'))
              if (ok) mark(tr('nusxa'))
            }}
          >
            {tr('Nusxa olish')}
          </Button>
          {smsAvailable && (
            <Button variant="ghost" icon="mail" className="reminder-wide" disabled={smsBusy} onClick={() => void sendSms()}>
              {smsBusy ? tr('Yuborilmoqda…') : rows.length > 1 ? tr('SMS yuborish ({0})', { 0: rows.length }) : tr('SMS yuborish (≈{0} ta)', { 0: smsSegments(text) })}
            </Button>
          )}
          {single && (
            <>
              <a className="btn btn-ghost" href={telegramShare(text)} target="_blank" rel="noreferrer" onClick={() => mark('Telegram')}>
                {tr('Telegram')}
              </a>
              <a className="btn btn-ghost" href={smsUrl(single.customer.phone, text)} onClick={() => mark('SMS')}>
                {tr('SMS')}
              </a>
              <a className="btn btn-ghost" href={`tel:${single.customer.phone.replace(/[^\d+]/g, '')}`} onClick={() => mark(tr('qo\'ng\'iroq'))}>
                {tr('Qo\'ng\'iroq')}
              </a>
            </>
          )}
        </div>
        <p className="apply-status" role="status" aria-live="polite">
          {status || (logged ? tr('Eslatma jurnalga yozildi') : '')}
        </p>
        <p className="small-note muted">{tr('Shablonni Sozlamalar → O\'quv jarayoni bo\'limida o\'zgartirish mumkin.')}</p>
      </div>
    </Modal>
  )
}
