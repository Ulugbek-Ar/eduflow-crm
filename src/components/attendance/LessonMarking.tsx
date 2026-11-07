import { useDashboard } from '../../context/useDashboard'
import { tr } from '../../i18n'
import type { AttendanceStatus } from '../../types/attendance.types'
import { ATTENDANCE_LABELS } from '../../utils/attendance'
import { enrollmentActiveOn } from '../../utils/groups'
import { Button } from '../ui/Button'
import './attendance.css'

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

// Bir dars uchun katta tugmali ro'yxat (telefonda bugungi dars): har o'quvchi — Keldi / Kechikdi / Kelmadi / Sababli
export function LessonMarking({ groupId, date }: { groupId: string; date: string }) {
  const { enrollments, attendance, getCustomerName, markAttendance, canMarkDay } = useDashboard()
  const students = enrollments
    .filter((e) => e.groupId === groupId && enrollmentActiveOn(e, date))
    .sort((a, b) => getCustomerName(a.customerId).localeCompare(getCustomerName(b.customerId)))
  const statusOf = (customerId: string) => attendance.find((r) => r.groupId === groupId && r.customerId === customerId && r.date === date)?.status
  const editable = canMarkDay(groupId, date)
  const unmarked = students.filter((e) => !statusOf(e.customerId))

  if (students.length === 0) return <p className="muted">{tr('Bu kuni guruhda faol o\'quvchi yo\'q.')}</p>

  return (
    <div className="stack">
      {editable && unmarked.length > 0 && (
        <Button icon="checkCircle" className="btn-block" onClick={() => markAttendance(unmarked.map((e) => ({ groupId, customerId: e.customerId, date, status: 'present' })))}>
          {unmarked.length === students.length ? tr('Hammasi keldi') : tr('Qolganlari keldi ({0})', { 0: unmarked.length })}
        </Button>
      )}
      {!editable && <p className="notice notice-info">{tr('Bu kunning davomatini faqat ko\'rish mumkin.')}</p>}
      <ul className="lesson-list">
        {students.map((e) => {
          const name = getCustomerName(e.customerId)
          const current = statusOf(e.customerId)
          return (
            <li key={e.id} className="lesson-student">
              <strong>{name}</strong>
              <div className="lesson-buttons" role="group" aria-label={tr('{0}: davomat', { 0: name })}>
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`is-${status}`}
                    aria-pressed={current === status}
                    disabled={!editable}
                    onClick={() => markAttendance([{ groupId, customerId: e.customerId, date, status }], { silent: true })}
                  >
                    {ATTENDANCE_LABELS[status]}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
