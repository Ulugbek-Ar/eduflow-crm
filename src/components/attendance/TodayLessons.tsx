import { useDashboard } from '../../context/useDashboard'
import { useNowMinutes, useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import { absentStreaks, attendanceRate, rateLabel, recordsFor, todayLessons } from '../../utils/attendance'
import type { LessonSlot } from '../../utils/attendance'
import { cx } from '../../utils/cx'
import { addDays, minutesOf } from '../../utils/groups'
import { Badge } from '../ui/Badge'
import './attendance.css'

function lessonState(slot: LessonSlot, nowMinutes: number): { label: string; tone: 'paid' | 'warning' | 'neutral' | 'contacted' } {
  if (slot.students === 0) return { label: tr('O\'quvchi yo\'q'), tone: 'neutral' }
  if (slot.marked >= slot.students) return { label: tr('Belgilangan'), tone: 'paid' }
  if (slot.marked > 0) return { label: tr('Belgilangan {0}/{1}', { 0: slot.marked, 1: slot.students }), tone: 'contacted' }
  if (slot.ended) return { label: tr('Belgilanmagan'), tone: 'warning' }
  return minutesOf(slot.group.startTime) <= nowMinutes ? { label: tr('Davom etmoqda'), tone: 'contacted' } : { label: tr('Hali boshlanmagan'), tone: 'neutral' }
}

// "Bugungi darslar": vaqt, guruh, o'qituvchi, xona, davomat belgilangan yoki yo'q
export function TodayLessons({ title = tr('Bugungi darslar') }: { title?: string }) {
  const { groups, enrollments, attendance, lessonExceptions, teachers, openModal } = useDashboard()
  const today = useToday()
  const nowMinutes = useNowMinutes()
  const slots = todayLessons(groups, enrollments, attendance, lessonExceptions, today, nowMinutes)
  const teacherName = (id?: string) => teachers.find((t) => t.id === id)?.name ?? tr('O\'qituvchi biriktirilmagan')

  return (
    <section className="card" aria-labelledby="today-lessons-title">
      <div className="card-head">
        <div>
          <h2 id="today-lessons-title">{title}</h2>
          <span className="muted">{slots.length > 0 ? tr('{0} ta dars', { 0: slots.length }) : tr('Bugun dars yo\'q')}</span>
        </div>
      </div>
      {slots.length === 0 ? (
        <p className="muted">{tr('Jadval bo\'yicha bugun dars rejalashtirilmagan.')}</p>
      ) : (
        <ul className="lesson-cards">
          {slots.map((slot) => {
            const state = lessonState(slot, nowMinutes)
            return (
              <li key={slot.group.id} className={cx('lesson-card', state.tone === 'warning' && 'is-unmarked')}>
                <span className="lesson-time">
                  {slot.group.startTime}
                  <small>{slot.group.endTime}</small>
                </span>
                <span>
                  <button type="button" className="link-btn" onClick={() => openModal({ type: 'groupDetail', payload: { id: slot.group.id, tab: 'attendance' } })}>
                    {slot.group.name}
                  </button>
                  <span className="meta cell-block">
                    {teacherName(slot.group.teacherId)}
                    {slot.group.room ? ` · ${slot.group.room}` : ''} · {tr('{0} o\'quvchi', { 0: slot.students })}
                  </span>
                </span>
                <Badge tone={state.tone}>{state.label}</Badge>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// O'qituvchi uchun "Bugun": darslar, guruhlarim, oxirgi 30 kun davomati va ketma-ket kelmayotganlar
export function TeacherToday() {
  const { groups, enrollments, attendance, ownTeacher, getCustomerName, openModal } = useDashboard()
  const today = useToday()
  const active = groups.filter((g) => g.status === 'active')
  const students = new Set(enrollments.filter((e) => active.some((g) => g.id === e.groupId)).map((e) => e.customerId)).size
  const rate = attendanceRate(recordsFor(attendance, { from: addDays(today, -30), to: today }))
  const streaks = absentStreaks(enrollments, attendance, today)
  return (
    <div className="stack">
      {!ownTeacher && (
        <p className="notice notice-warning" role="status">
          {tr('Hisobingiz hali o\'qituvchi yozuviga bog\'lanmagan. Administrator "O\'qituvchilar" bo\'limida kirishni bog\'lagach, guruhlaringiz shu yerda ko\'rinadi.')}
        </p>
      )}
      <div className="summary-grid">
        <div className="card summary">
          <small>{tr('Mening guruhlarim')}</small>
          <strong>{active.length}</strong>
        </div>
        <div className="card summary">
          <small>{tr('O\'quvchilar')}</small>
          <strong>{students}</strong>
        </div>
        <div className="card summary">
          <small>{tr('Davomat (30 kun)')}</small>
          <strong>{rateLabel(rate)}</strong>
        </div>
      </div>
      <TodayLessons title={tr('Bugungi darslarim')} />
      {streaks.length > 0 && (
        <section className="card" aria-labelledby="streaks-title">
          <h2 id="streaks-title">{tr('Ketma-ket kelmayotganlar')}</h2>
          <ul className="student-groups">
            {streaks.map((s) => (
              <li key={`${s.groupId}:${s.customerId}`}>
                <span>
                  <strong>{getCustomerName(s.customerId)}</strong>
                  <small className="muted cell-block">{groups.find((g) => g.id === s.groupId)?.name}</small>
                </span>
                <button type="button" className="link-btn" onClick={() => openModal({ type: 'groupDetail', payload: { id: s.groupId, tab: 'attendance' } })}>
                  {tr('{0} dars kelmadi', { 0: s.count })}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
