import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import type { Group, Weekday } from '../../types/group.types'
import { cx } from '../../utils/cx'
import { allConflicts } from '../../utils/groupForm'
import { WEEKDAY_LONG, WEEKDAY_SHORT, WEEKDAYS, weekdayOf, parseDay } from '../../utils/groups'
import { courseColor, placeBlocks, timeSlots, weekDates } from '../../utils/schedule'
import { PrintDocument } from '../print/PrintDocument'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Select } from '../ui/Select'
import './schedule.css'

type Mode = 'days' | 'rooms'

interface Column {
  key: string
  label: string
  sub?: string
  today: boolean
  groups: Group[]
  // Shu ustundagi dars sanasi (bekor qilinganini ko'rsatish uchun)
  date?: string
}

const NO_ROOM = '__none__'

// Haftalik dars jadvali: Du–Ya ustunlar (yoki tanlangan kun xonalari), 08:00–21:00, 30 daqiqalik qatorlar
export function SchedulePanel() {
  const { groups, courses, teachers, lessonExceptions, openModal, settings, ownTeacher } = useDashboard()
  const today = useToday()
  const narrow = useMediaQuery('(max-width: 760px)')
  const [teacher, setTeacher] = useState('all')
  const [room, setRoom] = useState('all')
  const [course, setCourse] = useState('all')
  const [mode, setMode] = useState<Mode>('days')
  const [day, setDay] = useState<Weekday>(weekdayOf(parseDay(today)))
  const [printing, setPrinting] = useState(false)
  const dates = weekDates(today)
  const conflicts = allConflicts(groups)
  const courseIds = courses.map((c) => c.id)
  const rooms = [...new Set(groups.filter((g) => g.status === 'active').map((g) => g.room.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  const visible = groups.filter(
    (g) =>
      g.status === 'active' &&
      (!g.endDate || g.endDate >= dates.mon) &&
      g.startDate <= dates.sun &&
      (teacher === 'all' || (teacher === 'none' ? !g.teacherId : g.teacherId === teacher)) &&
      (room === 'all' || (room === NO_ROOM ? !g.room.trim() : g.room.trim() === room)) &&
      (course === 'all' || g.courseId === course),
  )
  const cancelled = (groupId: string, date?: string) => Boolean(date) && lessonExceptions.some((e) => e.groupId === groupId && e.date === date)
  const teacherName = (id?: string) => teachers.find((t) => t.id === id)?.name ?? tr('O\'qituvchi biriktirilmagan')
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? '—'

  const dayColumns: Column[] = WEEKDAYS.map((d) => ({
    key: d,
    label: WEEKDAY_SHORT[d],
    sub: `${dates[d].slice(8, 10)}.${dates[d].slice(5, 7)}`,
    today: dates[d] === today,
    groups: visible.filter((g) => g.days.includes(d)),
    date: dates[d],
  }))
  const roomColumns: Column[] = [...rooms.filter((r) => room === 'all' || r === room), ...(visible.some((g) => !g.room.trim()) ? [NO_ROOM] : [])].map((r) => ({
    key: r,
    label: r === NO_ROOM ? tr('Xonasiz') : r,
    today: false,
    groups: visible.filter((g) => g.days.includes(day) && (r === NO_ROOM ? !g.room.trim() : g.room.trim() === r)),
    date: dates[day],
  }))
  const columns = mode === 'days' ? dayColumns : roomColumns
  const usedCourses = courses.filter((c) => visible.some((g) => g.courseId === c.id))

  const block = (group: Group, date?: string, style?: CSSProperties) => {
    const clash = conflicts.get(group.id)
    const off = cancelled(group.id, date)
    return (
      <button
        key={`${group.id}:${date ?? ''}`}
        type="button"
        className={cx('lesson-block', courseColor(group.courseId, courseIds), clash && 'is-conflict', off && 'is-cancelled')}
        style={style}
        onClick={() => openModal({ type: 'groupDetail', payload: { id: group.id } })}
        aria-label={`${group.name}, ${group.startTime}–${group.endTime}, ${teacherName(group.teacherId)}${group.room ? `, ${group.room}` : ''}${clash ? `, ${tr('ziddiyat')}` : ''}${off ? `, ${tr('bekor qilingan')}` : ''}`}
        title={clash ? tr('Ziddiyat: {0}', { 0: clash.map((c) => c.group.name).join(', ') }) : undefined}
      >
        <strong>{group.name}</strong>
        <span>
          {group.startTime}–{group.endTime}
          {group.room && mode === 'days' ? ` · ${group.room}` : ''}
        </span>
        <span>{teacherName(group.teacherId)}</span>
      </button>
    )
  }

  const grid = (cols: Column[]) => (
    <div className="week" style={{ '--cols': cols.length } as CSSProperties}>
      <div className="week-head" aria-hidden="true" />
      {cols.map((c) => (
        <div key={c.key} className={cx('week-head', c.today && 'is-today')}>
          {c.label}
          {c.sub && <small>{c.sub}</small>}
        </div>
      ))}
      <div className="week-times" aria-hidden="true">
        {timeSlots().map((t, i) => (
          <div key={t} className="week-time">
            {i % 2 === 0 ? t : ''}
          </div>
        ))}
      </div>
      {cols.map((c) => (
        <div key={c.key} className={cx('week-col', c.today && 'is-today')} style={{ height: `calc(var(--slot-h) * ${timeSlots().length})` }} role="list" aria-label={`${c.label}${c.sub ? ` ${c.sub}` : ''}`}>
          {placeBlocks(c.groups).map((p) => (
            <div key={p.group.id} role="listitem">
              {block(p.group, c.date, {
                top: `calc(var(--slot-h) * ${p.top})`,
                height: `calc(var(--slot-h) * ${p.height} - 2px)`,
                left: `calc(${(100 / p.lanes) * p.lane}% + 2px)`,
                width: `calc(${100 / p.lanes}% - 4px)`,
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div className="stack">
      <section className="card" aria-labelledby="schedule-title">
        <div className="card-head">
          <div>
            <h2 id="schedule-title">{ownTeacher ? tr('Mening jadvalim') : tr('Dars jadvali')}</h2>
            <span className="muted">
              {tr('Hafta: {0} — {1}', { 0: `${dates.mon.slice(8, 10)}.${dates.mon.slice(5, 7)}`, 1: `${dates.sun.slice(8, 10)}.${dates.sun.slice(5, 7)}.${dates.sun.slice(0, 4)}` })}
              {conflicts.size > 0 && ` · ${tr('{0} ta guruhda ziddiyat', { 0: conflicts.size })}`}
            </span>
          </div>
          {!narrow && (
            <div className="toolbar">
              <div className="segmented" role="group" aria-label={tr('Ko\'rinish')}>
                <button type="button" aria-pressed={mode === 'days'} className={cx(mode === 'days' && 'is-active')} onClick={() => setMode('days')}>
                  {tr('Kunlar bo\'yicha')}
                </button>
                <button type="button" aria-pressed={mode === 'rooms'} className={cx(mode === 'rooms' && 'is-active')} onClick={() => setMode('rooms')}>
                  {tr('Xonalar bo\'yicha')}
                </button>
              </div>
              <Button variant="ghost" icon="fileText" onClick={() => setPrinting(true)}>
                {tr('Chop etish (A4)')}
              </Button>
            </div>
          )}
        </div>

        <div className="schedule-toolbar">
          {!ownTeacher && (
            <Select
              label={tr('O\'qituvchi')}
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              options={[{ value: 'all', label: tr('Barchasi') }, ...teachers.filter((t) => t.status === 'active').map((t) => ({ value: t.id, label: t.name })), { value: 'none', label: tr('Biriktirilmagan') }]}
            />
          )}
          <Select
            label={tr('Xona')}
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            options={[{ value: 'all', label: tr('Barcha xonalar') }, ...rooms.map((r) => ({ value: r, label: r })), { value: NO_ROOM, label: tr('Xonasiz') }]}
          />
          <Select
            label={tr('Kurs')}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            options={[{ value: 'all', label: tr('Barcha kurslar') }, ...courses.filter((c) => groups.some((g) => g.courseId === c.id)).map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>

        {(narrow || mode === 'rooms') && (
          <div className="day-tabs" role="tablist" aria-label={tr('Hafta kuni')}>
            {WEEKDAYS.map((d) => (
              <button key={d} type="button" role="tab" aria-selected={day === d} aria-label={WEEKDAY_LONG[d]} onClick={() => setDay(d)}>
                {WEEKDAY_SHORT[d]}
                <small>{dates[d].slice(8, 10)}</small>
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            variant={groups.length === 0 ? 'empty' : 'search'}
            title={groups.length === 0 ? tr('Jadval bo\'sh') : tr('Hech narsa topilmadi')}
            description={groups.length === 0 ? tr('Guruh ochilgach, darslar shu yerda hafta kunlari va vaqti bo\'yicha ko\'rinadi.') : tr('Filtrlarni o\'zgartirib ko\'ring.')}
          />
        ) : narrow ? (
          <ul className="day-list">
            {visible
              .filter((g) => g.days.includes(day))
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((g) => (
                <li key={g.id}>{block(g, dates[day])}</li>
              ))}
            {!visible.some((g) => g.days.includes(day)) && <li className="muted">{tr('Bu kuni dars yo\'q.')}</li>}
          </ul>
        ) : (
          <div className="schedule-scroll">{grid(columns)}</div>
        )}

        {usedCourses.length > 0 && (
          <div className="schedule-legend" aria-label={tr('Kurslar ranglari')}>
            {usedCourses.map((c) => (
              <span key={c.id} className={courseColor(c.id, courseIds)}>
                <i aria-hidden="true" />
                {courseName(c.id)}
              </span>
            ))}
            {conflicts.size > 0 && <span className="text-danger">{tr('Qizil chegara — jadvalda ziddiyat (bir xona yoki o\'qituvchi bir vaqtda)')}</span>}
          </div>
        )}
      </section>

      {printing && (
        <PrintDocument size="a4-landscape" onDone={() => setPrinting(false)}>
          <div className="schedule-print">
            <h1>
              {settings.orgName} — {tr('Dars jadvali')} ({dates.mon.slice(8, 10)}.{dates.mon.slice(5, 7)} — {dates.sun.slice(8, 10)}.{dates.sun.slice(5, 7)}.{dates.sun.slice(0, 4)})
            </h1>
            {grid(dayColumns)}
          </div>
        </PrintDocument>
      )}
    </div>
  )
}
