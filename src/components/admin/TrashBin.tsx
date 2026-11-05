import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useConfirm } from '../../hooks/useConfirm'
import { daysLeft, TRASH_KIND_LABELS, TRASH_RETENTION_DAYS, trashTitle } from '../../services/trash.service'
import type { TrashEntry } from '../../services/trash.service'
import { formatDateTimeWith } from '../../utils/format'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

export function TrashBin() {
  const { trash, restoreFromTrash, purgeFromTrash, emptyTrash, money, settings } = useDashboard()
  const confirm = useConfirm()
  // "Qolgan kunlar" bir marta hisoblanadi (render paytida Date.now() chaqirilmaydi)
  const [now] = useState(Date.now)
  const sorted = [...trash].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))

  const purge = async (entry: TrashEntry) => {
    const ok = await confirm({
      title: 'Butunlay o\'chirish',
      message: `"${trashTitle(entry, money)}" butunlay o'chiriladi. Buni ortga qaytarib bo'lmaydi.`,
      confirmLabel: 'Butunlay o\'chirish',
    })
    if (ok) purgeFromTrash(entry.kind, entry.id)
  }

  const purgeAll = async () => {
    const ok = await confirm({
      title: 'Savatchani tozalash',
      message: `Savatchadagi ${trash.length} ta yozuv butunlay o'chiriladi. Buni ortga qaytarib bo'lmaydi.`,
      confirmLabel: 'Hammasini o\'chirish',
    })
    if (ok) emptyTrash()
  }

  return (
    <section className="card" aria-label="Savatcha">
      <div className="card-head">
        <div>
          <h2>Savatcha</h2>
          <span className="muted">O'chirilgan mijoz, to'lov va kurslar {TRASH_RETENTION_DAYS} kun saqlanadi, keyin o'zi yo'qoladi</span>
        </div>
        {trash.length > 0 && (
          <div className="toolbar">
            <Button variant="danger" icon="trash" onClick={purgeAll}>
              Savatchani tozalash
            </Button>
          </div>
        )}
      </div>
      {sorted.length === 0 ? (
        <EmptyState title="Savatcha bo'sh" description="O'chirilgan yozuvlar shu yerga tushadi va 30 kun ichida tiklash mumkin." />
      ) : (
        <ul className="trash-list">
          {sorted.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} className="trash-item">
              <span className="trash-info">
                <span className="trash-title">
                  <Badge tone="neutral">{TRASH_KIND_LABELS[entry.kind]}</Badge>
                  <strong>{trashTitle(entry, money)}</strong>
                </span>
                <small className="muted">
                  O'chirgan: {entry.deletedBy || '—'} · {formatDateTimeWith(entry.deletedAt, settings.dateFormat)} · {daysLeft(entry, now)} kun qoldi
                </small>
              </span>
              <span className="toolbar">
                <Button size="sm" icon="refresh" onClick={() => restoreFromTrash(entry.kind, entry.id)} aria-label={`Tiklash: ${trashTitle(entry, money)}`}>
                  Tiklash
                </Button>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => purge(entry)} aria-label={`Butunlay o'chirish: ${trashTitle(entry, money)}`}>
                  <span className="hide-mobile">O'chirish</span>
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
