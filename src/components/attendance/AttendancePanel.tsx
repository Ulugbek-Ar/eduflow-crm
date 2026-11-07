import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useNowMinutes, useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import { lessonDates, todayLessons } from '../../utils/attendance'
import { cx } from '../../utils/cx'
import { addDays, parseDay, WEEKDAY_SHORT, weekdayOf } from '../../utils/groups'
import { EmptyState } from '../ui/EmptyState'
import { Select } from '../ui/Select'
import { LessonMarking } from './LessonMarking'
import './attendance.css'

// "Davomat" (o'qituvchi menyusida): bugungi darslar yoki oxirgi N kun ichidagi dars — katta tugmalar bilan belgilash
export function AttendancePanel() {
  const { groups, enrollments, attendance, lessonExceptions, settings, formatDate } = useDashboard()
  const today = useToday()
  const nowMinutes = useNowMinutes()
  const slots = todayLessons(groups, enrollments, attendance, lessonExceptions, today, nowMinutes)
  const active = groups.filter((g) => g.status === 'active')
  // Oxirgi N kun ichidagi darslar (o'qituvchi tahrirlay oladigan oraliq)
  const recent = active
    .flatMap((g) => lessonDates(g, addDays(today, -settings.attendanceEditDays), today, lessonExceptions, today).map((date) => ({ group: g, date })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.group.startTime.localeCompare(b.group.startTime))
  const fallback = slots.find((s) => !s.ended || s.marked < s.students) ?? slots[0]
  const [choice, setChoice] = useState('')
  const options = recent.map((r) => ({ value: `${r.group.id}|${r.date}`, label: `${r.date === today ? tr('Bugun') : `${WEEKDAY_SHORT[weekdayOf(parseDay(r.date))]}, ${r.date.slice(8, 10)}.${r.date.slice(5, 7)}`} · ${r.group.startTime} · ${r.group.name}` }))
  const selected = options.some((o) => o.value === choice) ? choice : fallback ? `${fallback.group.id}|${today}` : (options[0]?.value ?? '')
  const [groupId, date] = selected.split('|')

  if (active.length === 0) {
    return <EmptyState title={tr('Guruhlaringiz yo\'q')} description={tr('Administrator guruhga sizni o\'qituvchi qilib biriktirgach, davomatni shu yerda belgilaysiz.')} />
  }

  return (
    <div className="stack">
      {slots.length > 0 && (
        <div className="segmented lesson-tabs" role="tablist" aria-label={tr('Bugungi darslar')}>
          {slots.map((s) => (
            <button
              key={s.group.id}
              type="button"
              role="tab"
              aria-selected={selected === `${s.group.id}|${today}`}
              className={cx(selected === `${s.group.id}|${today}` && 'is-active')}
              onClick={() => setChoice(`${s.group.id}|${today}`)}
            >
              {s.group.startTime} · {s.group.name}
            </button>
          ))}
        </div>
      )}
      <section className="card" aria-labelledby="attendance-title">
        <div className="card-head">
          <div>
            <h2 id="attendance-title">{groups.find((g) => g.id === groupId)?.name ?? tr('Davomat')}</h2>
            <span className="muted">{date === today ? tr('Bugungi dars') : date ? formatDate(`${date}T12:00:00`) : ''}</span>
          </div>
        </div>
        {options.length > 0 && <Select label={tr('Dars')} value={selected} onChange={(e) => setChoice(e.target.value)} options={options} hint={tr('Bugun va oxirgi {0} kun ichidagi darslar', { 0: settings.attendanceEditDays })} />}
        {groupId && date ? <LessonMarking groupId={groupId} date={date} /> : <p className="muted">{tr('Bugun va oxirgi kunlarda dars yo\'q.')}</p>}
      </section>
    </div>
  )
}
