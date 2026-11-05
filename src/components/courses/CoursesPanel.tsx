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
  { id: 'active', label: 'Faol' },
  { id: 'archived', label: 'Arxiv' },
  { id: 'all', label: 'Hammasi' },
]

export function CoursesPanel() {
  const { courses, customers, search, money, openModal, updateCourse, removeCourse } = useDashboard()
  const confirm = useConfirm()
  const canEdit = useCan()('courses.edit')
  const [filter, setFilter] = useState<StatusFilter>('active')

  const query = search.trim().toLowerCase()
  const visible = courses.filter((c) => (filter === 'all' || c.status === filter) && (!query || c.name.toLowerCase().includes(query)))
  const active = courses.filter((c) => c.status === 'active')
  const incomplete = coursesNeedingSetup(courses)
  const totals = active.reduce(
    (sum, course) => {
      const stats = courseStats(course, customers)
      return { students: sum.students + stats.students, expected: sum.expected + stats.expectedMonthly }
    },
    { students: 0, expected: 0 },
  )

  const handleDelete = async (course: Course) => {
    const ok = await confirm({
      title: 'Kursni o\'chirish',
      message: `"${course.name}" butunlay o'chiriladi. Unga yozilgan mijoz yo'q. Davom etasizmi?`,
      confirmLabel: 'O\'chirish',
    })
    if (ok) removeCourse(course.id)
  }

  const handleArchive = async (course: Course) => {
    const count = usedByCustomers(course, customers)
    const ok = await confirm({
      title: 'Arxivlash',
      message: `"${course.name}" arxivga o'tkaziladi va yangi mijoz formalarida ko'rinmaydi.${count > 0 ? ` ${count} ta mijozning kursi o'zgarmaydi.` : ''} Keyin qaytarish mumkin.`,
      confirmLabel: 'Arxivlash',
      tone: 'primary',
    })
    if (ok) updateCourse(course.id, { status: 'archived' })
  }

  return (
    <div className="stack">
      <div className="summary-grid">
        <div className="card summary">
          <small>Faol kurslar va xizmatlar</small>
          <strong>{formatNumber(active.length)}</strong>
        </div>
        <div className="card summary">
          <small>Talabalar (To'lov qildi)</small>
          <strong>{formatNumber(totals.students)}</strong>
        </div>
        <div className="card summary">
          <small>Oylik kutilayotgan tushum</small>
          <strong className="text-success">{money(totals.expected)}</strong>
        </div>
      </div>

      <section className="card" aria-labelledby="courses-title">
        <div className="card-head">
          <div>
            <h2 id="courses-title">Kurslar va xizmatlar</h2>
            <span className="muted">
              {visible.length} ta (jami {courses.length})
            </span>
          </div>
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Holat bo'yicha">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} className={cx(filter === f.id && 'is-active')} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            {canEdit && (
              <Button icon="plus" onClick={() => openModal({ type: 'course' })}>
                Yangi kurs
              </Button>
            )}
          </div>
        </div>

        {canEdit && incomplete.length > 0 && (
          <div className="notice notice-warning setup-notice" role="status">
            <strong>
              {incomplete.length} ta kursda narx yoki muddat kiritilmagan — qarzdorlar va kutilayotgan tushum to'g'ri hisoblanishi uchun
              to'ldiring:
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
            title={courses.length === 0 ? 'Hali kurs yoki xizmat yo\'q' : 'Hech narsa topilmadi'}
            description={
              courses.length === 0
                ? 'Kurs qo\'shing — mijoz formasida tanlanadi, qarz va tushum shu narx bo\'yicha hisoblanadi.'
                : 'Holat filtrini yoki qidiruvni o\'zgartirib ko\'ring.'
            }
            action={
              courses.length === 0 &&
              canEdit && (
                <Button icon="plus" onClick={() => openModal({ type: 'course' })}>
                  Kurs qo'shish
                </Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Nomi</th>
                  <th scope="col" className="col-optional">
                    Davomiyligi
                  </th>
                  <th scope="col" className="align-right">
                    Oylik narx
                  </th>
                  <th scope="col" className="align-right col-optional">
                    Guruhlar
                  </th>
                  <th scope="col" className="align-right">
                    Talabalar
                  </th>
                  <th scope="col" className="align-right">
                    Lidlar
                  </th>
                  <th scope="col" className="align-right">
                    Kutilayotgan tushum
                  </th>
                  <th scope="col">Holat</th>
                  <th scope="col">
                    <span className="sr-only">Amallar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((course) => {
                  const stats = courseStats(course, customers)
                  const used = stats.leads > 0
                  return (
                    <tr key={course.id} className={cx(course.status === 'archived' && 'is-muted')}>
                      <td data-label="Nomi">
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
                            · {durationLabel(course.durationMonths)} · {course.activeGroups} guruh
                          </span>
                        </small>
                      </td>
                      <td data-label="Davomiyligi" className="nowrap col-optional">
                        {course.durationMonths > 0 ? durationLabel(course.durationMonths) : <span className="text-warning">Muddatsiz</span>}
                      </td>
                      <td data-label="Oylik narx" className="align-right nowrap">
                        {course.monthlyPrice > 0 ? money(course.monthlyPrice) : <span className="text-warning">Kiritilmagan</span>}
                      </td>
                      <td data-label="Guruhlar" className="align-right col-optional">
                        {course.activeGroups}
                      </td>
                      <td data-label="Talabalar" className="align-right strong">
                        {stats.students}
                      </td>
                      <td data-label="Lidlar" className="align-right">
                        {stats.leads}
                      </td>
                      <td data-label="Kutilayotgan tushum" className="align-right nowrap">
                        {money(stats.expectedMonthly)}
                      </td>
                      <td data-label="Holat">
                        <Badge tone={course.status === 'active' ? 'paid' : 'neutral'}>{COURSE_STATUS_LABELS[course.status]}</Badge>
                      </td>
                      <td className="cell-actions">
                        {canEdit && (
                        <div className="row-actions">
                          <IconButton icon="edit" label={`${course.name}ni tahrirlash`} onClick={() => openModal({ type: 'course', payload: { id: course.id } })} />
                          {course.status === 'active' ? (
                            <IconButton icon="archive" label={`${course.name}ni arxivlash`} onClick={() => handleArchive(course)} />
                          ) : (
                            <IconButton icon="refresh" label={`${course.name}ni arxivdan qaytarish`} onClick={() => updateCourse(course.id, { status: 'active' })} />
                          )}
                          {/* Mijozi bor kurs o'chirilmaydi — faqat arxivlanadi */}
                          {!used && <IconButton icon="trash" tone="danger" label={`${course.name}ni o'chirish`} onClick={() => handleDelete(course)} />}
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
