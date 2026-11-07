import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import { exportRows } from '../../services/export.service'
import type { ExportColumn, ExportFormat } from '../../services/export.service'
import type { AttendanceStatus } from '../../types/attendance.types'
import type { Enrollment } from '../../types/group.types'
import { ATTENDANCE_KEYS, ATTENDANCE_LABELS, ATTENDANCE_SHORT, attendanceRate, lessonDates, nextStatus, rateLabel } from '../../utils/attendance'
import { cx } from '../../utils/cx'
import { enrollmentActiveOn, parseDay, WEEKDAY_SHORT, weekdayOf } from '../../utils/groups'
import { activeInMonth, monthBounds, periodLabel, shiftPeriod } from '../../utils/payroll'
import { Button, IconButton } from '../ui/Button'
import { Select } from '../ui/Select'
import { LessonMarking } from './LessonMarking'
import './attendance.css'

// Oylik davomat setkasi: o'quvchilar × dars sanalari. Katak bosilsa yoki P/A/L/E tugmalari bilan holat almashadi,
// strelkalar bilan katakdan katakka o'tiladi. Telefonda — tanlangan dars uchun katta tugmali ro'yxat
export function AttendanceGrid({ groupId }: { groupId: string }) {
  const { getGroup, enrollments, attendance, lessonExceptions, getCustomerName, markAttendance, canMarkDay, settings, logExport } = useDashboard()
  const can = useCan()
  const today = useToday()
  const narrow = useMediaQuery('(max-width: 640px)')
  const [period, setPeriod] = useState(today.slice(0, 7))
  const [view, setView] = useState<'lesson' | 'month'>('lesson')
  const [focus, setFocus] = useState<[number, number]>([0, -1])
  const group = getGroup(groupId)
  const [pickedDate, setPickedDate] = useState('')
  if (!group) return null

  const { from, to } = monthBounds(period)
  const dates = lessonDates(group, from, to, lessonExceptions, today)
  const students: Enrollment[] = enrollments
    .filter((e) => e.groupId === group.id && activeInMonth(e, from, to))
    .sort((a, b) => getCustomerName(a.customerId).localeCompare(getCustomerName(b.customerId)))
  const record = (customerId: string, date: string) => attendance.find((r) => r.groupId === group.id && r.customerId === customerId && r.date === date)
  const monthRecords = attendance.filter((r) => r.groupId === group.id && r.date >= from && r.date <= to)
  const todayIndex = dates.indexOf(today)
  const unmarkedToday = todayIndex >= 0 ? students.filter((e) => enrollmentActiveOn(e, today) && !record(e.customerId, today)) : []
  const defaultDate = todayIndex >= 0 ? today : (dates.filter((d) => d <= today).pop() ?? dates[0] ?? today)
  const lessonDate = pickedDate && dates.includes(pickedDate) ? pickedDate : defaultDate
  const [row, col] = focus
  const activeCol = col >= 0 ? col : Math.max(0, todayIndex >= 0 ? todayIndex : dates.length - 1)

  const setStatus = (customerId: string, date: string, status: AttendanceStatus) => markAttendance([{ groupId: group.id, customerId, date, status }], { silent: true })

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, r: number, c: number, customerId: string, date: string, editable: boolean) => {
    const key = event.key.toLowerCase()
    const move = (nr: number, nc: number) => {
      event.preventDefault()
      const nextRow = Math.max(0, Math.min(students.length - 1, nr))
      const nextCol = Math.max(0, Math.min(dates.length - 1, nc))
      setFocus([nextRow, nextCol])
      document.querySelector<HTMLButtonElement>(`[data-att="${group.id}:${nextRow}:${nextCol}"]`)?.focus()
    }
    if (key === 'arrowright') return move(r, c + 1)
    if (key === 'arrowleft') return move(r, c - 1)
    if (key === 'arrowdown') return move(r + 1, c)
    if (key === 'arrowup') return move(r - 1, c)
    if (editable && key in ATTENDANCE_KEYS) {
      event.preventDefault()
      setStatus(customerId, date, ATTENDANCE_KEYS[key])
    }
  }

  const exportMonth = (format: ExportFormat) => {
    const columns: ExportColumn<Enrollment>[] = [
      { header: tr('O\'quvchi'), value: (e) => getCustomerName(e.customerId), width: 180 },
      ...dates.map((d) => ({ header: d.slice(8, 10) + '.' + d.slice(5, 7), value: (e: Enrollment) => {
        const status = record(e.customerId, d)?.status
        return status ? ATTENDANCE_SHORT[status] : ''
      }, width: 40 })),
      { header: tr('Davomat, %'), value: (e) => {
        const rate = attendanceRate(monthRecords.filter((r) => r.customerId === e.customerId))
        return rate === null ? '' : Math.round(rate)
      }, type: 'number' },
    ]
    exportRows(`davomat-${group.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${period}`, students, columns, format, { delimiter: settings.csvDelimiter, sheetName: tr('Davomat') })
    logExport(`${tr('Davomat')}: ${group.name}, ${periodLabel(period)} — ${format === 'csv' ? 'CSV' : 'Excel'}`)
  }

  const monthRate = attendanceRate(monthRecords)

  return (
    <div className="att">
      <div className="att-toolbar">
        <div className="toolbar" role="group" aria-label={tr('Oy')}>
          <IconButton icon="chevronLeft" label={tr('Oldingi oy')} onClick={() => setPeriod(shiftPeriod(period, -1))} />
          <strong>{periodLabel(period)}</strong>
          <IconButton icon="chevronRight" label={tr('Keyingi oy')} disabled={period >= today.slice(0, 7)} onClick={() => setPeriod(shiftPeriod(period, 1))} />
          <span className="muted">{tr('Oy bo\'yicha: {0}', { 0: rateLabel(monthRate) })}</span>
        </div>
        <div className="toolbar">
          {!narrow && todayIndex >= 0 && unmarkedToday.length > 0 && canMarkDay(group.id, today) && (
            <Button size="sm" icon="checkCircle" onClick={() => markAttendance(unmarkedToday.map((e) => ({ groupId: group.id, customerId: e.customerId, date: today, status: 'present' })))}>
              {unmarkedToday.length === students.filter((e) => enrollmentActiveOn(e, today)).length ? tr('Hammasi keldi') : tr('Qolganlari keldi ({0})', { 0: unmarkedToday.length })}
            </Button>
          )}
          {can('reports.export') && students.length > 0 && (
            <>
              <Button size="sm" variant="ghost" icon="download" onClick={() => exportMonth('csv')}>
                CSV
              </Button>
              <Button size="sm" variant="ghost" icon="sheet" onClick={() => exportMonth('xls')}>
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {dates.length === 0 || students.length === 0 ? (
        <p className="muted">{dates.length === 0 ? tr('Bu oyda dars yo\'q.') : tr('Bu oyda guruhda o\'quvchi bo\'lmagan.')}</p>
      ) : narrow && view === 'lesson' ? (
        <div className="stack">
          <div className="toolbar">
            <Select
              label={tr('Dars')}
              value={lessonDate}
              onChange={(e) => setPickedDate(e.target.value)}
              options={dates.map((d) => ({ value: d, label: `${WEEKDAY_SHORT[weekdayOf(parseDay(d))]}, ${d.slice(8, 10)}.${d.slice(5, 7)}${d === today ? ` — ${tr('bugun')}` : ''}` }))}
            />
            <Button size="sm" variant="ghost" icon="sheet" onClick={() => setView('month')}>
              {tr('Oy jadvali')}
            </Button>
          </div>
          <LessonMarking groupId={group.id} date={lessonDate} />
        </div>
      ) : (
        <>
          {narrow && (
            <Button size="sm" variant="ghost" icon="list" onClick={() => setView('lesson')}>
              {tr('Dars bo\'yicha belgilash')}
            </Button>
          )}
          <div className="att-scroll">
            <table className="att-grid" aria-label={tr('Davomat: {0}, {1}', { 0: group.name, 1: periodLabel(period) })}>
              <thead>
                <tr>
                  <th scope="col" className="att-name">
                    {tr('O\'quvchi')}
                  </th>
                  {dates.map((d) => (
                    <th key={d} scope="col" className={cx('att-day', d === today && 'is-today')}>
                      {d.slice(8, 10)}
                      <small>{WEEKDAY_SHORT[weekdayOf(parseDay(d))]}</small>
                    </th>
                  ))}
                  <th scope="col" className="att-rate">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((e, r) => {
                  const name = getCustomerName(e.customerId)
                  return (
                    <tr key={e.id}>
                      <th scope="row" className="att-name" title={name}>
                        {name}
                      </th>
                      {dates.map((d, c) => {
                        if (!enrollmentActiveOn(e, d)) {
                          return (
                            <td key={d} className="att-out" aria-label={tr('{0} — {1}: guruhda emas', { 0: name, 1: d })}>
                              —
                            </td>
                          )
                        }
                        const status = record(e.customerId, d)?.status
                        const editable = canMarkDay(group.id, d)
                        return (
                          <td key={d}>
                            <button
                              type="button"
                              className={cx('att-cell', status && `is-${status}`)}
                              data-att={`${group.id}:${r}:${c}`}
                              tabIndex={r === row && c === activeCol ? 0 : -1}
                              disabled={!editable}
                              aria-label={`${name} — ${d.slice(8, 10)}.${d.slice(5, 7)}: ${status ? ATTENDANCE_LABELS[status] : tr('belgilanmagan')}`}
                              title={editable ? tr('Bosing yoki P / L / A / E') : tr('Bu kunni o\'zgartira olmaysiz')}
                              onFocus={() => setFocus([r, c])}
                              onClick={() => setStatus(e.customerId, d, nextStatus(status))}
                              onKeyDown={(event) => onKeyDown(event, r, c, e.customerId, d, editable)}
                            >
                              {status ? ATTENDANCE_SHORT[status] : '·'}
                            </button>
                          </td>
                        )
                      })}
                      <td className="att-rate">{rateLabel(attendanceRate(monthRecords.filter((x) => x.customerId === e.customerId)))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="att-legend" aria-hidden="true">
            {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((s) => (
              <span key={s}>
                <span className={cx('att-cell', `is-${s}`)}>{ATTENDANCE_SHORT[s]}</span>
                {ATTENDANCE_LABELS[s]}
              </span>
            ))}
            <span>{tr('Klaviatura: strelkalar, P / L / A / E')}</span>
          </div>
        </>
      )}
    </div>
  )
}
