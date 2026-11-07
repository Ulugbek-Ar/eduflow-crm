import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useAuth, useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { useToday } from '../../hooks/useToday'
import { tr } from '../../i18n'
import { exportRows } from '../../services/export.service'
import type { ExportColumn, ExportFormat } from '../../services/export.service'
import type { Teacher } from '../../types/teacher.types'
import { cx } from '../../utils/cx'
import { formatNumber } from '../../utils/format'
import { activeInMonth, monthBounds, payRuleLabel, payrollReport, payrollTotals, periodLabel, salaryNote, shiftPeriod } from '../../utils/payroll'
import type { PayrollRow } from '../../utils/payroll'
import { StaffFormModal } from '../admin/StaffFormModal'
import { TempPasswordModal } from '../admin/TempPasswordModal'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { formatAmountInput, parseAmount } from '../../utils/format'
import { rateLabel, teacherAttendanceRate } from '../../utils/attendance'
import { addDays } from '../../utils/groups'
import './teachers.css'

type Tab = 'teachers' | 'payroll'

// "O'qituvchilar": ro'yxat (maosh qoidasi, guruhlar, kirish) va "Maosh" (oy bo'yicha hisob, to'lash, eksport)
export function TeachersPanel() {
  const can = useCan()
  const [tab, setTab] = useState<Tab>(can('teachers.manage') ? 'teachers' : 'payroll')
  const tabs: Array<{ id: Tab; label: string }> = [
    ...(can('teachers.manage') ? [{ id: 'teachers' as const, label: tr('O\'qituvchilar') }] : []),
    ...(can('payroll.view') ? [{ id: 'payroll' as const, label: tr('Maosh') }] : []),
  ]
  return (
    <div className="stack">
      {tabs.length > 1 && (
        <div className="segmented section-tabs" role="tablist" aria-label={tr('O\'qituvchilar bo\'limi')}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx(tab === t.id && 'is-active')} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'teachers' ? <TeacherList /> : <Payroll />}
    </div>
  )
}

function TeacherList() {
  const { teachers, groups, enrollments, attendance, money, openModal, removeTeacher, updateTeacher, search } = useDashboard()
  const { users, can: authCan } = useAuth()
  const confirm = useConfirm()
  const today = useToday()
  const [access, setAccess] = useState<Teacher | null>(null)
  const [issued, setIssued] = useState<{ title: string; fullName: string; login: string; password: string } | null>(null)
  const query = search.trim().toLowerCase()
  const visible = teachers
    .filter((t) => !query || `${t.name} ${t.subjects.join(' ')} ${t.phone}`.toLowerCase().includes(query))
    .sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || a.name.localeCompare(b.name))
  const { from, to } = monthBounds(today.slice(0, 7))

  const remove = async (teacher: Teacher) => {
    const hasGroups = groups.some((g) => g.teacherId === teacher.id)
    const ok = await confirm({
      title: hasGroups ? tr('O\'qituvchini arxivlash') : tr('O\'qituvchini o\'chirish'),
      message: hasGroups
        ? tr('{0} guruhlarga biriktirilgan — arxivlanadi (guruhlar va maosh tarixi saqlanadi).', { 0: teacher.name })
        : tr('{0} savatchaga o\'tkaziladi — 30 kun ichida tiklash mumkin.', { 0: teacher.name }),
      confirmLabel: hasGroups ? tr('Arxivlash') : tr('O\'chirish'),
    })
    if (ok) removeTeacher(teacher.id)
  }

  return (
    <section className="card" aria-labelledby="teachers-title">
      <div className="card-head">
        <div>
          <h2 id="teachers-title">{tr('O\'qituvchilar')}</h2>
          <span className="muted">{tr('{0} ta faol', { 0: teachers.filter((t) => t.status === 'active').length })}</span>
        </div>
        <Button icon="plus" onClick={() => openModal({ type: 'teacher' })}>
          {tr('O\'qituvchi qo\'shish')}
        </Button>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          variant={teachers.length === 0 ? 'empty' : 'search'}
          title={teachers.length === 0 ? tr('Hali o\'qituvchi yo\'q') : tr('Hech narsa topilmadi')}
          description={teachers.length === 0 ? tr('O\'qituvchi qo\'shing va maosh qoidasini tanlang — keyin guruhlarga biriktirasiz.') : tr('Qidiruvni o\'zgartirib ko\'ring.')}
          action={
            teachers.length === 0 && (
              <Button icon="plus" onClick={() => openModal({ type: 'teacher' })}>
                {tr('O\'qituvchi qo\'shish')}
              </Button>
            )
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{tr('O\'qituvchi')}</th>
                <th scope="col">{tr('Guruhlar')}</th>
                <th scope="col" className="align-right">
                  {tr('O\'quvchilar')}
                </th>
                <th scope="col" className="align-right col-optional">
                  {tr('Davomat (30 kun)')}
                </th>
                <th scope="col">{tr('Maosh qoidasi')}</th>
                <th scope="col">{tr('Kirish huquqi')}</th>
                <th scope="col">
                  <span className="sr-only">{tr('Amallar')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((teacher) => {
                const own = groups.filter((g) => g.teacherId === teacher.id && g.status === 'active')
                const ownIds = new Set(own.map((g) => g.id))
                const students = new Set(enrollments.filter((e) => ownIds.has(e.groupId) && activeInMonth(e, from, to)).map((e) => e.customerId)).size
                const login = users.find((u) => u.id === teacher.userId)
                return (
                  <tr key={teacher.id} className={cx(teacher.status === 'archived' && 'is-muted')}>
                    <td data-label={tr('O\'qituvchi')}>
                      <span>
                        <button type="button" className="link-btn" onClick={() => openModal({ type: 'teacher', payload: { id: teacher.id } })}>
                          {teacher.name}
                        </button>
                        {teacher.status === 'archived' && (
                          <>
                            {' '}
                            <Badge tone="neutral">{tr('Arxiv')}</Badge>
                          </>
                        )}
                      </span>
                      <small className="cell-sub">{[teacher.subjects.join(', '), teacher.phone].filter(Boolean).join(' · ') || '—'}</small>
                    </td>
                    <td data-label={tr('Guruhlar')}>{own.length ? own.map((g) => g.name).join(', ') : <span className="muted">—</span>}</td>
                    <td data-label={tr('O\'quvchilar')} className="align-right">
                      {formatNumber(students)}
                    </td>
                    <td data-label={tr('Davomat (30 kun)')} className="align-right col-optional">
                      {rateLabel(teacherAttendanceRate(teacher.id, groups, attendance, addDays(today, -30), today))}
                    </td>
                    <td data-label={tr('Maosh qoidasi')}>{payRuleLabel(teacher.payRule, money)}</td>
                    <td data-label={tr('Kirish huquqi')}>
                      {login ? (
                        <span className="muted">{login.login}</span>
                      ) : teacher.userId ? (
                        <span className="muted">{tr('Bog\'langan')}</span>
                      ) : authCan('staff.manage') && teacher.status === 'active' ? (
                        <Button size="sm" variant="ghost" icon="key" onClick={() => setAccess(teacher)}>
                          {tr('Kirish yaratish')}
                        </Button>
                      ) : (
                        <span className="muted">{tr('Yo\'q')}</span>
                      )}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <IconButton icon="edit" label={tr('Tahrirlash: {0}', { 0: teacher.name })} onClick={() => openModal({ type: 'teacher', payload: { id: teacher.id } })} />
                        {teacher.status === 'archived' ? (
                          <IconButton icon="refresh" label={tr('Arxivdan qaytarish: {0}', { 0: teacher.name })} onClick={() => updateTeacher(teacher.id, { status: 'active' })} />
                        ) : (
                          <IconButton icon="archive" label={tr('Arxivlash yoki o\'chirish: {0}', { 0: teacher.name })} onClick={() => remove(teacher)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {access && (
        <StaffFormModal
          preset={{ fullName: access.name, title: tr('O\'qituvchi'), teacherId: access.id }}
          onClose={() => setAccess(null)}
          onCreated={(created) => {
            if (created.id) updateTeacher(access.id, { userId: created.id }, { silent: true, action: 'teacher.access' })
            setIssued({ title: tr('O\'qituvchiga kirish yaratildi'), fullName: created.fullName, login: created.login, password: created.password })
          }}
        />
      )}
      {issued && <TempPasswordModal {...issued} onClose={() => setIssued(null)} />}
    </section>
  )
}

function Payroll() {
  const { teachers, groups, enrollments, transactions, courses, customers, money, settings, addTransaction, logExport } = useDashboard()
  const can = useCan()
  const today = useToday()
  const [period, setPeriod] = useState(today.slice(0, 7))
  const [paying, setPaying] = useState<PayrollRow | null>(null)
  const rows = payrollReport(period, { teachers, groups, enrollments, transactions, courses, customers })
  const totals = payrollTotals(rows)
  const current = today.slice(0, 7)

  const columns: ExportColumn<PayrollRow>[] = [
    { header: tr('O\'qituvchi'), value: (r) => r.teacher.name, width: 180 },
    { header: tr('Guruhlar'), value: (r) => r.groups.map((g) => g.name).join(', '), width: 220 },
    { header: tr('Faol o\'quvchilar'), value: (r) => r.activeStudents, type: 'number' },
    { header: tr('Yig\'ilgan kirim'), value: (r) => r.revenue, type: 'number', width: 120 },
    { header: tr('Qoida'), value: (r) => payRuleLabel(r.teacher.payRule, money), width: 180 },
    { header: tr('Hisoblangan maosh'), value: (r) => r.salary, type: 'number', width: 120 },
    { header: tr('To\'langan'), value: (r) => r.paid, type: 'number', width: 120 },
    { header: tr('Qolgan'), value: (r) => r.remaining, type: 'number', width: 120 },
  ]

  const exportReport = (format: ExportFormat) => {
    exportRows(`maosh-${period}`, rows, columns, format, { delimiter: settings.csvDelimiter, sheetName: tr('Maosh') })
    logExport(`${tr('Maosh hisoboti')} ${periodLabel(period)} — ${format === 'csv' ? 'CSV' : 'Excel'}`)
  }

  return (
    <section className="card" aria-labelledby="payroll-title">
      <div className="card-head">
        <div>
          <h2 id="payroll-title">{tr('O\'qituvchilar maoshi')}</h2>
          <span className="muted">{tr('Guruhlardan yig\'ilgan to\'langan kirim va maosh qoidasi bo\'yicha')}</span>
        </div>
        <div className="toolbar">
          {can('reports.export') && (
            <>
              <Button size="sm" variant="ghost" icon="download" onClick={() => exportReport('csv')}>
                CSV
              </Button>
              <Button size="sm" variant="ghost" icon="sheet" onClick={() => exportReport('xls')}>
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="month-picker" role="group" aria-label={tr('Oy')}>
        <IconButton icon="chevronLeft" label={tr('Oldingi oy')} onClick={() => setPeriod(shiftPeriod(period, -1))} />
        <label className="month-input">
          <span className="sr-only">{tr('Oy')}</span>
          <input className="input" type="month" value={period} max={current} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        </label>
        <IconButton icon="chevronRight" label={tr('Keyingi oy')} disabled={period >= current} onClick={() => setPeriod(shiftPeriod(period, 1))} />
      </div>

      <div className="summary-grid payroll-summary">
        <div className="summary">
          <small>{tr('Hisoblangan')}</small>
          <strong>{money(totals.salary)}</strong>
        </div>
        <div className="summary">
          <small>{tr('To\'langan')}</small>
          <strong className="text-success">{money(totals.paid)}</strong>
        </div>
        <div className="summary">
          <small>{tr('Qolgan')}</small>
          <strong className={totals.remaining > 0 ? 'text-warning' : undefined}>{money(totals.remaining)}</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tr('Bu oy uchun ma\'lumot yo\'q')} description={tr('O\'qituvchi qo\'shing va guruhlarga biriktiring — maosh shu yerda hisoblanadi.')} />
      ) : (
        <div className="table-wrap">
          <table className="table payroll-table">
            <thead>
              <tr>
                <th scope="col">{tr('O\'qituvchi')}</th>
                <th scope="col" className="align-right">
                  {tr('Faol o\'quvchilar')}
                </th>
                <th scope="col" className="align-right">
                  {tr('Yig\'ilgan kirim')}
                </th>
                <th scope="col" className="col-optional">
                  {tr('Qoida')}
                </th>
                <th scope="col" className="align-right">
                  {tr('Hisoblangan')}
                </th>
                <th scope="col" className="align-right">
                  {tr('To\'langan')}
                </th>
                <th scope="col" className="align-right">
                  {tr('Qolgan')}
                </th>
                <th scope="col">
                  <span className="sr-only">{tr('Amallar')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.teacher.id}>
                  <td data-label={tr('O\'qituvchi')}>
                    <strong>{row.teacher.name}</strong>
                    <small className="cell-sub">{row.groups.map((g) => g.name).join(', ') || '—'}</small>
                  </td>
                  <td data-label={tr('Faol o\'quvchilar')} className="align-right">
                    {formatNumber(row.activeStudents)}
                  </td>
                  <td data-label={tr('Yig\'ilgan kirim')} className="align-right nowrap">
                    {money(row.revenue)}
                  </td>
                  <td data-label={tr('Qoida')} className="col-optional">
                    {payRuleLabel(row.teacher.payRule, money)}
                  </td>
                  <td data-label={tr('Hisoblangan')} className="align-right nowrap strong">
                    {money(row.salary)}
                  </td>
                  <td data-label={tr('To\'langan')} className="align-right nowrap text-success">
                    {money(row.paid)}
                  </td>
                  <td data-label={tr('Qolgan')} className={cx('align-right nowrap', row.remaining > 0 && 'text-warning')}>
                    {money(row.remaining)}
                  </td>
                  <td className="cell-actions">
                    {can('payroll.manage') && row.remaining > 0 && (
                      <Button size="sm" icon="dollar" onClick={() => setPaying(row)}>
                        {tr('Maosh to\'lash')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paying && (
        <PaySalaryDialog
          row={paying}
          period={period}
          onClose={() => setPaying(null)}
          onPay={(amount) => {
            addTransaction({
              type: 'expense',
              amount,
              method: 'transfer',
              category: 'salary',
              note: salaryNote(paying.teacher, period),
              status: 'paid',
              date: new Date().toISOString(),
              teacherId: paying.teacher.id,
              period,
            })
            setPaying(null)
          }}
        />
      )}
    </section>
  )
}

function PaySalaryDialog({ row, period, onClose, onPay }: { row: PayrollRow; period: string; onClose: () => void; onPay: (amount: number) => void }) {
  const { money } = useDashboard()
  const [amount, setAmount] = useState(formatAmountInput(String(row.remaining)))
  const [error, setError] = useState('')
  return (
    <Modal
      title={tr('Maosh to\'lash')}
      description={tr('{0} · {1}', { 0: row.teacher.name, 1: periodLabel(period) })}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tr('Bekor qilish')}
          </Button>
          <Button
            icon="check"
            onClick={() => {
              const value = parseAmount(amount)
              if (!Number.isFinite(value) || value <= 0) return setError(tr('Summani kiriting'))
              onPay(value)
            }}
          >
            {tr('To\'lash')}
          </Button>
        </>
      }
    >
      <div className="form">
        <p className="muted">{tr('Hisoblangan: {0} · to\'langan: {1} · qolgan: {2}', { 0: money(row.salary), 1: money(row.paid), 2: money(row.remaining) })}</p>
        <Input label={tr('Summa')} inputMode="numeric" value={amount} error={error} onChange={(e) => setAmount(formatAmountInput(e.target.value))} data-autofocus />
        <p className="small-note muted">{tr('Kassadan "Maosh" xarajati sifatida yoziladi (qaysi oy uchun — saqlanadi).')}</p>
      </div>
    </Modal>
  )
}
