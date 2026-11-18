import { useState } from 'react'
import { Icon } from '../../constants/navigation'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import type { GroupStatus, Weekday } from '../../types/group.types'
import { cx } from '../../utils/cx'
import { formatNumber } from '../../utils/format'
import { allConflicts } from '../../utils/groupForm'
import { GROUP_STATUS_LABELS, hasLessonOn, scheduleLabel, seatsTaken, WEEKDAY_LONG, WEEKDAYS } from '../../utils/groups'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Select } from '../ui/Select'
import { Capacity } from './Capacity'
import './groups.css'

type StatusFilter = GroupStatus | 'all'

// "Guruhlar": kurs, o'qituvchi, kunlar va vaqt, xona, sig'im (12/15), holat va "bugun dars bor" belgisi
export function GroupsPanel() {
  const { groups, courses, teachers, enrollments, search, openModal, ownTeacher, branches, branchFilter, getBranch } = useDashboard()
  // "Barcha filiallar" ko'rinishida guruh qaysi filialda ekani kurs yonida yoziladi
  const showBranch = !branchFilter && branches.length > 1
  const can = useCan()
  const today = useToday()
  const [course, setCourse] = useState('all')
  const [teacher, setTeacher] = useState('all')
  const [day, setDay] = useState<Weekday | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const canEdit = can('groups.edit')
  const conflicts = allConflicts(groups)

  const query = search.trim().toLowerCase()
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? '—'
  const teacherName = (id?: string) => (id ? (teachers.find((t) => t.id === id)?.name ?? '—') : tr('Biriktirilmagan'))
  const visible = groups
    .filter(
      (g) =>
        (status === 'all' || g.status === status) &&
        (course === 'all' || g.courseId === course) &&
        (teacher === 'all' || (teacher === 'none' ? !g.teacherId : g.teacherId === teacher)) &&
        (day === 'all' || g.days.includes(day)) &&
        (!query || `${g.name} ${courseName(g.courseId)} ${teacherName(g.teacherId)} ${g.room}`.toLowerCase().includes(query)),
    )
    .sort((a, b) => Number(hasLessonOn(b, today)) - Number(hasLessonOn(a, today)) || a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name))

  const active = groups.filter((g) => g.status === 'active')
  const seats = active.reduce((sum, g) => sum + seatsTaken(g.id, enrollments, today), 0)
  const capacity = active.reduce((sum, g) => sum + g.capacity, 0)
  const todayCount = active.filter((g) => hasLessonOn(g, today)).length
  const filtered = course !== 'all' || teacher !== 'all' || day !== 'all' || status !== 'active' || Boolean(query)

  return (
    <div className="stack">
      <div className="summary-grid">
        <div className="card summary">
          <small>{ownTeacher ? tr('Mening guruhlarim') : tr('Faol guruhlar')}</small>
          <strong>{formatNumber(active.length)}</strong>
        </div>
        <div className="card summary">
          <small>{tr('O\'quvchilar (joylar)')}</small>
          <strong>
            {formatNumber(seats)} <span className="muted small-value">/ {formatNumber(capacity)}</span>
          </strong>
        </div>
        <div className="card summary">
          <small>{tr('Bugun darslar')}</small>
          <strong>{formatNumber(todayCount)}</strong>
        </div>
      </div>

      <section className="card" aria-labelledby="groups-title">
        <div className="card-head">
          <div>
            <h2 id="groups-title">{ownTeacher ? tr('Mening guruhlarim') : tr('Guruhlar')}</h2>
            <span className="muted">{tr('{0} ta (jami {1})', { 0: visible.length, 1: groups.length })}</span>
          </div>
          {canEdit && (
            <Button icon="plus" onClick={() => openModal({ type: 'group' })}>
              {tr('Yangi guruh')}
            </Button>
          )}
        </div>

        <div className="group-filters">
          <Select
            label={tr('Kurs')}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            options={[{ value: 'all', label: tr('Barcha kurslar') }, ...courses.filter((c) => groups.some((g) => g.courseId === c.id)).map((c) => ({ value: c.id, label: c.name }))]}
          />
          {!ownTeacher && (
            <Select
              label={tr('O\'qituvchi')}
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              options={[{ value: 'all', label: tr('Barchasi') }, ...teachers.map((t) => ({ value: t.id, label: t.name })), { value: 'none', label: tr('Biriktirilmagan') }]}
            />
          )}
          <Select
            label={tr('Kun')}
            value={day}
            onChange={(e) => setDay(e.target.value as Weekday | 'all')}
            options={[{ value: 'all', label: tr('Har kuni') }, ...WEEKDAYS.map((d) => ({ value: d, label: WEEKDAY_LONG[d] }))]}
          />
          <Select
            label={tr('Holat')}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            options={[{ value: 'all', label: tr('Barchasi') }, ...(Object.keys(GROUP_STATUS_LABELS) as GroupStatus[]).map((s) => ({ value: s, label: GROUP_STATUS_LABELS[s] }))]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            variant={groups.length === 0 ? 'empty' : 'search'}
            title={groups.length === 0 ? (ownTeacher ? tr('Sizga hali guruh biriktirilmagan') : branchFilter ? tr('Bu filialda hali guruh yo\'q') : tr('Hali guruh yo\'q')) : tr('Hech narsa topilmadi')}
            description={
              groups.length === 0
                ? ownTeacher
                  ? tr('Administrator guruhga o\'qituvchi sifatida sizni tanlagach, guruh shu yerda ko\'rinadi.')
                  : tr('Guruh oching: kurs, o\'qituvchi, dars kunlari, vaqti va xonasi. Keyin o\'quvchilarni qo\'shasiz.')
                : tr('Filtrlarni yoki qidiruvni o\'zgartirib ko\'ring.')
            }
            action={
              groups.length === 0 && canEdit ? (
                <Button icon="plus" onClick={() => openModal({ type: 'group' })}>
                  {tr('Guruh ochish')}
                </Button>
              ) : (
                filtered && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCourse('all')
                      setTeacher('all')
                      setDay('all')
                      setStatus('active')
                    }}
                  >
                    {tr('Filtrlarni tozalash')}
                  </Button>
                )
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{tr('Guruh')}</th>
                  <th scope="col">{tr('O\'qituvchi')}</th>
                  <th scope="col">{tr('Kunlar va vaqt')}</th>
                  <th scope="col" className="col-optional">
                    {tr('Xona')}
                  </th>
                  <th scope="col">{tr('Sig\'im')}</th>
                  <th scope="col">{tr('Holat')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => {
                  const lessonToday = hasLessonOn(g, today)
                  const clash = conflicts.get(g.id)
                  return (
                    <tr key={g.id} className={cx(g.status !== 'active' && 'is-muted')}>
                      <td data-label={tr('Guruh')}>
                        <span>
                          <button type="button" className="link-btn" onClick={() => openModal({ type: 'groupDetail', payload: { id: g.id } })}>
                            {g.name}
                          </button>
                          {lessonToday && (
                            <span className="today-badge">
                              <Icon name="clock" size={12} />
                              {tr('Bugun {0}', { 0: g.startTime })}
                            </span>
                          )}
                          {clash && (
                            <span className="conflict-badge" title={tr('Jadvalda ziddiyat: {0}', { 0: clash.map((c) => c.group.name).join(', ') })}>
                              <Icon name="alert" size={12} />
                              {tr('Ziddiyat')}
                            </span>
                          )}
                        </span>
                        <small className="cell-sub">
                          {courseName(g.courseId)}
                          {showBranch && g.branchId ? ` · ${getBranch(g.branchId)?.name ?? ''}` : ''}
                        </small>
                      </td>
                      <td data-label={tr('O\'qituvchi')}>{g.teacherId ? teacherName(g.teacherId) : <span className="muted">{tr('Biriktirilmagan')}</span>}</td>
                      <td data-label={tr('Kunlar va vaqt')} className="nowrap">
                        {scheduleLabel(g)}
                      </td>
                      <td data-label={tr('Xona')} className="col-optional">
                        {g.room || '—'}
                      </td>
                      <td data-label={tr('Sig\'im')}>
                        <Capacity taken={seatsTaken(g.id, enrollments, today)} capacity={g.capacity} />
                      </td>
                      <td data-label={tr('Holat')}>
                        <Badge tone={g.status === 'active' ? 'paid' : 'neutral'}>{GROUP_STATUS_LABELS[g.status]}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
