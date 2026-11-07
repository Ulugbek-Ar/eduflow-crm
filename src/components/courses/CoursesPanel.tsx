import { tr } from '../../i18n'
import { useState } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { useCan } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import type { Course, CourseStatus } from '../../types/course.types'
import { COURSE_STATUS_LABELS, COURSE_TYPE_LABELS, courseStats, coursesNeedingSetup, durationLabel, usedByCustomers } from '../../utils/courses'
import { cx } from '../../utils/cx'
import { formatNumber } from '../../utils/format'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

type StatusFilter = CourseStatus | 'all'

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'active', label: tr('Faol') },
  { id: 'archived', label: tr('Arxiv') },
  { id: 'all', label: tr('Hammasi') },
]

export function CoursesPanel() {
  const { courses, customers, groups, enrollments, search, money, openModal, updateCourse, removeCourse } = useDashboard()
  const confirm = useConfirm()
  const canEdit = useCan()('courses.edit')
  const [filter, setFilter] = useState<StatusFilter>('active')

  const query = search.trim().toLowerCase()
  const visible = courses.filter((c) => (filter === 'all' || c.status === filter) && (!query || c.name.toLowerCase().includes(query)))
  const active = courses.filter((c) => c.status === 'active')
  const incomplete = coursesNeedingSetup(courses)
  const totals = active.reduce(
    (sum, course) => {
      const stats = courseStats(course, customers, groups, enrollments)
      return { students: sum.students + stats.students, expected: sum.expected + stats.expectedMonthly }
    },
    { students: 0, expected: 0 },
  )

  const handleDelete = async (course: Course) => {
    const ok = await confirm({
      title: tr('Kursni o\'chirish'),
      message: tr('"{0}" savatchaga o\'tkaziladi — 30 kun ichida tiklash mumkin. Unga yozilgan mijoz yo\'q. Davom etasizmi?', { 0: course.name }),
      confirmLabel: tr('O\'chirish'),
    })
    if (ok) removeCourse(course.id)
  }

  const handleArchive = async (course: Course) => {
    const count = usedByCustomers(course, customers)
    const ok = await confirm({
      title: tr('Arxivlash'),
      message: tr('"{0}" arxivga o\'tkaziladi va yangi mijoz formalarida ko\'rinmaydi.{1} Keyin qaytarish mumkin.', { 0: course.name, 1: count > 0 ? ` ${count} ta mijozning kursi o'zgarmaydi.` : '' }),
      confirmLabel: tr('Arxivlash'),
      tone: 'primary',
    })
    if (ok) updateCourse(course.id, { status: 'archived' })
  }

  return (
    <div className="stack">
      <div className="summary-grid">
        <div className="card summary">
          <small>{tr('Faol kurslar va xizmatlar')}</small>
          <strong>{formatNumber(active.length)}</strong>
        </div>
        <div className="card summary">
          <small>{tr('O\'qiyotgan talabalar')}</small>
          <strong>{formatNumber(totals.students)}</strong>
        </div>
        <div className="card summary">
          <small>{tr('Oylik kutilayotgan tushum')}</small>
          <strong className="text-success">{money(totals.expected)}</strong>
        </div>
      </div>

      <section className="card" aria-labelledby="courses-title">
        <div className="card-head">
          <div>
            <h2 id="courses-title">{tr('Kurslar va xizmatlar')}</h2>
            <span className="muted">
              {visible.length} {tr('ta (jami')} {courses.length})
            </span>
          </div>
          <div className="toolbar">
            <div className="segmented" role="group" aria-label={tr('Holat bo\'yicha')}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} className={cx(filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            {canEdit && (
              <Button icon="plus" onClick={() => openModal({ type: 'course' })}>
                {tr('Yangi kurs')}
              </Button>
            )}
          </div>
        </div>

        {canEdit && incomplete.length > 0 && (
          <div className="notice notice-warning setup-notice" role="status">
            <strong>
              {incomplete.length} {tr('ta kursda narx yoki muddat kiritilmagan — qarzdorlar va kutilayotgan tushum to\'g\'ri hisoblanishi uchun to\'ldiring:')}
            </strong>
            <div className="toolbar">
              {incomplete.map((course) => (
                <Button key={course.id} size="sm" variant="ghost" icon="edit" onClick={() => openModal({ type: 'course', payload: { id: course.id } })}>
                  {course.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            variant={courses.length === 0 ? 'empty' : 'search'}
            title={courses.length === 0 ? tr('Hali kurs yoki xizmat yo\'q') : tr('Hech narsa topilmadi')}
            description={
              courses.length === 0
                ? tr('Kurs qo\'shing — mijoz formasida tanlanadi, qarz va tushum shu narx bo\'yicha hisoblanadi.')
                : tr('Holat filtrini yoki qidiruvni o\'zgartirib ko\'ring.')
            }
            action={
              courses.length === 0 &&
              canEdit && (
                <Button icon="plus" onClick={() => openModal({ type: 'course' })}>
                  {tr('Kurs qo\'shish')}
                </Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{tr('Nomi')}</th>
                  <th scope="col" className="col-optional">
                    {tr('Davomiyligi')}
                  </th>
                  <th scope="col" className="align-right">
                    {tr('Oylik narx')}
                  </th>
                  <th scope="col" className="align-right col-optional">
                    {tr('Guruhlar')}
                  </th>
                  <th scope="col" className="align-right">
                    {tr('Talabalar')}
                  </th>
                  <th scope="col" className="align-right">
                    {tr('Lidlar')}
                  </th>
                  <th scope="col" className="align-right">
                    {tr('Kutilayotgan tushum')}
                  </th>
                  <th scope="col">{tr('Holat')}</th>
                  <th scope="col">
                    <span className="sr-only">{tr('Amallar')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((course) => {
                  const stats = courseStats(course, customers, groups, enrollments)
                  const used = stats.leads > 0 || groups.some((g) => g.courseId === course.id)
                  return (
                    <tr key={course.id} className={cx(course.status === 'archived' && 'is-muted')}>
                      <td data-label={tr('Nomi')}>
                        {canEdit ? (
                          <button type="button" className="link-btn" onClick={() => openModal({ type: 'course', payload: { id: course.id } })}>
                            {course.name}
                          </button>
                        ) : (
                          <strong>{course.name}</strong>
                        )}
                        <small className="cell-sub">
                          {COURSE_TYPE_LABELS[course.type]}
                          <span className="show-compact">
                            {' '}
                            · {durationLabel(course.durationMonths)} · {stats.groups} {tr('guruh')}
                          </span>
                        </small>
                      </td>
                      <td data-label={tr('Davomiyligi')} className="nowrap col-optional">
                        {course.durationMonths > 0 ? durationLabel(course.durationMonths) : <span className="text-warning">{tr('Muddatsiz')}</span>}
                      </td>
                      <td data-label={tr('Oylik narx')} className="align-right nowrap">
                        {course.monthlyPrice > 0 ? money(course.monthlyPrice) : <span className="text-warning">{tr('Kiritilmagan')}</span>}
                      </td>
                      <td data-label={tr('Guruhlar')} className="align-right col-optional">
                        {stats.groups}
                      </td>
                      <td data-label={tr('Talabalar')} className="align-right strong">
                        {stats.students}
                      </td>
                      <td data-label={tr('Lidlar')} className="align-right">
                        {stats.leads}
                      </td>
                      <td data-label={tr('Kutilayotgan tushum')} className="align-right nowrap">
                        {money(stats.expectedMonthly)}
                      </td>
                      <td data-label={tr('Holat')}>
                        <Badge tone={course.status === 'active' ? 'paid' : 'neutral'}>{COURSE_STATUS_LABELS[course.status]}</Badge>
                      </td>
                      <td className="cell-actions">
                        {canEdit && (
                        <div className="row-actions">
                          <IconButton icon="edit" label={tr('{0}ni tahrirlash', { 0: course.name })} onClick={() => openModal({ type: 'course', payload: { id: course.id } })} />
                          {course.status === 'active' ? (
                            <IconButton icon="archive" label={tr('{0}ni arxivlash', { 0: course.name })} onClick={() => handleArchive(course)} />
                          ) : (
                            <IconButton icon="refresh" label={tr('{0}ni arxivdan qaytarish', { 0: course.name })} onClick={() => updateCourse(course.id, { status: 'active' })} />
                          )}
                          {/* Mijozi bor kurs o'chirilmaydi — faqat arxivlanadi */}
                          {!used && <IconButton icon="trash" tone="danger" label={tr('{0}ni o\'chirish', { 0: course.name })} onClick={() => handleDelete(course)} />}
                        </div>
                        )}
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
