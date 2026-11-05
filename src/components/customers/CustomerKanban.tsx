import { useEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { FUNNEL_STAGES, Icon, SOURCE_LABELS, STATUS_LABELS } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import type { Customer, CustomerStatus } from '../../types/customer.types'
import { groupByStage, neighbourStage } from '../../utils/customers'
import { cx } from '../../utils/cx'
import { Dropdown } from '../ui/Dropdown'

const DRAG_TYPE = 'text/plain'

export function CustomerKanban({ customers }: { customers: Customer[] }) {
  const { updateCustomer, openModal, formatDate } = useDashboard()
  // Kuzatuvchi va kassir bosqichni o'zgartira olmaydi: sudrash va ko'chirish menyusi o'chadi
  const canEdit = useCan()('customers.edit')
  const groups = groupByStage(customers, FUNNEL_STAGES)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<CustomerStatus | null>(null)
  // Karta boshqa ustunga ko'chgach (qayta yaratiladi) fokus unga qaytariladi
  const focusAfterMove = useRef<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = focusAfterMove.current
    if (!id) return
    focusAfterMove.current = null
    boardRef.current?.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus()
  })

  const move = (customer: Customer, stage: CustomerStatus) => {
    if (customer.status === stage || !canEdit) return
    focusAfterMove.current = customer.id
    updateCustomer(customer.id, { status: stage })
  }

  const handleDrop = (event: DragEvent<HTMLElement>, stage: CustomerStatus) => {
    event.preventDefault()
    const id = event.dataTransfer.getData(DRAG_TYPE) || dragId
    const customer = customers.find((c) => c.id === id)
    if (canEdit && customer && customer.status !== stage) updateCustomer(customer.id, { status: stage })
    setDragId(null)
    setOverStage(null)
  }

  const handleCardKey = (event: KeyboardEvent<HTMLElement>, customer: Customer) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter') {
      event.preventDefault()
      openModal({ type: 'customerDetail', payload: { id: customer.id } })
      return
    }
    if (event.altKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault()
      const next = neighbourStage(customer.status, event.key === 'ArrowRight' ? 1 : -1)
      if (next) move(customer, next)
    }
  }

  return (
    <div ref={boardRef} className="kanban" aria-label="Sotuv voronkasi">
      {FUNNEL_STAGES.map((stage) => {
        const list = groups[stage]
        return (
          <section
            key={stage}
            className={cx('kanban-column', overStage === stage && 'is-over')}
            aria-labelledby={`kanban-${stage}`}
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (overStage !== stage) setOverStage(stage)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage(null)
            }}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <header className="kanban-head">
              <span className={`stage-dot stage-${stage}`} aria-hidden="true" />
              <h3 id={`kanban-${stage}`}>{STATUS_LABELS[stage]}</h3>
              <span className="kanban-count" aria-label={`${list.length} ta mijoz`}>
                {list.length}
              </span>
            </header>
            <ul className="kanban-list">
              {list.length === 0 && <li className="kanban-empty">Bu bosqichda mijoz yo'q</li>}
              {list.map((c) => (
                <li key={c.id}>
                  <article
                    className={cx('kanban-card', dragId === c.id && 'is-dragging')}
                    data-card-id={c.id}
                    tabIndex={0}
                    draggable={canEdit}
                    aria-label={`${c.name}, ${STATUS_LABELS[c.status]}. Enter — kartani ochish, Alt + strelka — bosqichni o'zgartirish`}
                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, c.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDragId(c.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverStage(null)
                    }}
                    onKeyDown={(e) => handleCardKey(e, c)}
                  >
                    <div className="kanban-card-head">
                      <button
                        type="button"
                        className="link-btn"
                        tabIndex={-1}
                        onClick={() => openModal({ type: 'customerDetail', payload: { id: c.id } })}
                      >
                        {c.name}
                      </button>
                      {canEdit && (
                        <Dropdown
                          label={`${c.name}: bosqichni tanlash`}
                          strategy="fixed"
                          trigger={(props) => (
                            <button type="button" className="icon-btn kanban-move" aria-label={`${c.name}: bosqichni o'zgartirish`} title="Bosqichni o'zgartirish" {...props}>
                              <Icon name="move" size={14} />
                            </button>
                          )}
                          sections={[
                            {
                              label: 'Bosqich',
                              items: FUNNEL_STAGES.map((s) => ({
                                id: s,
                                label: STATUS_LABELS[s],
                                checked: c.status === s,
                                onSelect: () => move(c, s),
                              })),
                            },
                          ]}
                        />
                      )}
                    </div>
                    <dl className="kanban-meta">
                      <div>
                        <dt className="sr-only">Telefon</dt>
                        <dd className="nowrap">{c.phone}</dd>
                      </div>
                      <div>
                        <dt className="sr-only">Kurs</dt>
                        <dd>{c.course || '—'}</dd>
                      </div>
                    </dl>
                    <div className="kanban-foot">
                      <span className="kanban-source">{SOURCE_LABELS[c.source]}</span>
                      <span className="muted">{formatDate(c.createdAt)}</span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
