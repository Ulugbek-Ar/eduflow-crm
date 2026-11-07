import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { getLang, LANG_LABELS, tr } from '../../i18n'
import type { Lang } from '../../i18n'
import type { DebtRow } from '../../utils/debts'
import { fillTemplate, monthName, smsUrl, telegramShare } from '../../utils/reminders'
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
  const [lang, setLang] = useState<Lang>(getLang())
  const [status, setStatus] = useState('')
  const [logged, setLogged] = useState(false)
  const template = lang === 'ru' ? settings.reminderTemplateRu : settings.reminderTemplateUz
  const [now] = useState(() => new Date())
  const messageFor = (row: DebtRow) =>
    fillTemplate(template, {
      ism: row.customer.name,
      summa: money(row.debt),
      kurs: row.course.name,
      guruh: row.label,
      oy: monthName(now, lang),
      markaz: settings.orgName,
      telefon: settings.phone,
    })
  const single = rows.length === 1 ? rows[0] : null
  const text = single ? messageFor(single) : rows.map((r) => `${r.customer.name} (${r.customer.phone}):\n${messageFor(r)}`).join('\n\n')

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
