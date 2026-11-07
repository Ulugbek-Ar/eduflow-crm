// O'quv markazi yadrosi amallari: guruhlar, o'qish (enrollment), o'qituvchilar, davomat, bekor qilingan darslar.
// Har amal: ruxsat tekshiruvi -> holat -> jurnal (audit) -> toast (o'chirishda "Bekor qilish" va 30 kunlik savatcha).
// Saqlash, bulut sinxroni va tablar orasidagi sinxron DashboardContext'dagi umumiy effektlar orqali ishlaydi
import type { Dispatch, SetStateAction } from 'react'
import type { Permission } from '../auth/permissions'
import { tr } from '../i18n'
import type { AuditAction } from '../services/audit.service'
import type { TrashEntry } from '../services/trash.service'
import type { ToastApi, ToastOptions } from '../hooks/useToast'
import type { AttendanceRecord, AttendanceStatus, LessonException } from '../types/attendance.types'
import type { Course } from '../types/course.types'
import type { Customer } from '../types/customer.types'
import type { Settings } from '../types/dashboard.types'
import type { Enrollment, EnrollmentInput, Group, GroupInput } from '../types/group.types'
import type { Teacher, TeacherInput } from '../types/teacher.types'
import type { Role } from '../types/user.types'
import { createId } from '../utils/format'
import { addDays, dayString } from '../utils/groups'

export interface EduState {
  customers: Customer[]
  courses: Course[]
  teachers: Teacher[]
  groups: Group[]
  enrollments: Enrollment[]
  attendance: AttendanceRecord[]
  lessonExceptions: LessonException[]
  settings: Settings
}

export interface EduDeps extends EduState {
  setCustomers: Dispatch<SetStateAction<Customer[]>>
  setTeachers: Dispatch<SetStateAction<Teacher[]>>
  setGroups: Dispatch<SetStateAction<Group[]>>
  setEnrollments: Dispatch<SetStateAction<Enrollment[]>>
  setAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>
  setLessonExceptions: Dispatch<SetStateAction<LessonException[]>>
  role: Role
  // O'qituvchi sifatida kirgan bo'lsa — uning o'qituvchi yozuvi id'si
  ownTeacherId?: string
  actorName: string
  can: (permission: Permission) => boolean
  allowed: (permission: Permission) => boolean
  audit: (action: AuditAction, summary: string, entityId?: string) => void
  toast: ToastApi
  toTrash: (entry: TrashEntry) => void
  undo: (entry: TrashEntry) => ToastOptions
}

// Savatchaga yoziladigan yozuv (vaqt va kim o'chirgani DashboardContext'da qo'shiladi)
export type TrashDraft = TrashEntry extends infer E ? (E extends TrashEntry ? Omit<E, 'deletedAt' | 'deletedBy'> : never) : never

export interface AttendanceMark {
  groupId: string
  customerId: string
  date: string
  status: AttendanceStatus
  note?: string
}

export interface EnrollInput {
  customerId: string
  groupId: string
  startDate: string
  priceOverride?: number
  discountPercent?: number
}

const clean = <T extends object>(value: T): T => {
  const result = { ...value }
  for (const key of Object.keys(result) as Array<keyof T>) if (result[key] === undefined) delete result[key]
  return result
}

export function createEduActions(d: EduDeps) {
  const nowIso = () => new Date().toISOString()
  const trashEntry = (entry: TrashDraft) => ({ ...entry, deletedAt: nowIso(), deletedBy: d.actorName }) as TrashEntry
  const today = () => dayString(new Date())
  const groupName = (id: string) => d.groups.find((g) => g.id === id)?.name ?? tr('Guruh')
  const customerName = (id: string) => d.customers.find((c) => c.id === id)?.name ?? tr('O\'quvchi')
  const enrollmentLabel = (e: Pick<Enrollment, 'customerId' | 'groupId'>) => `${customerName(e.customerId)} — ${groupName(e.groupId)}`

  // O'qituvchi faqat o'z guruhiga; boshqalar — ruxsat bo'yicha
  const ownsGroup = (groupId: string) => d.role !== 'teacher' || d.groups.some((g) => g.id === groupId && g.teacherId === d.ownTeacherId && Boolean(d.ownTeacherId))

  // Davomatni shu kunga belgilash mumkinmi: kelajak — yo'q; o'qituvchi — bugun va oxirgi N kun; administrator/menejer — istalgan kun
  const canMarkDay = (groupId: string, date: string): boolean => {
    if (!d.can('attendance.mark') || date > today() || !ownsGroup(groupId)) return false
    if (d.can('groups.edit')) return true
    return date >= addDays(today(), -d.settings.attendanceEditDays)
  }

  return {
    canMarkDay,
    ownsGroup,

    // ===== Guruhlar =====
    addGroup(input: GroupInput): Group | null {
      if (!d.allowed('groups.edit')) return null
      const group: Group = clean({ ...input, name: input.name.trim().replace(/\s+/g, ' '), room: input.room.trim(), id: createId('g'), createdAt: nowIso() })
      d.setGroups((list) => [...list, group])
      d.audit('group.create', group.name, group.id)
      d.toast.success(tr('"{0}" guruhi ochildi', { 0: group.name }))
      return group
    },

    updateGroup(id: string, patch: Partial<GroupInput>) {
      if (!d.allowed('groups.edit')) return
      const before = d.groups.find((g) => g.id === id)
      if (!before) return
      const next = clean({ ...before, ...patch, updatedAt: nowIso() })
      if (patch.name !== undefined) next.name = patch.name.trim().replace(/\s+/g, ' ')
      // Ixtiyoriy maydon olib tashlangan bo'lsa (o'qituvchisiz, tugash sanasiz)
      if ('teacherId' in patch && !patch.teacherId) delete next.teacherId
      if ('endDate' in patch && !patch.endDate) delete next.endDate
      d.setGroups((list) => list.map((g) => (g.id === id ? next : g)))
      const archived = patch.status === 'archived' && before.status !== 'archived'
      d.audit(archived ? 'group.archive' : 'group.update', next.name, id)
      d.toast.success(archived ? tr('"{0}" arxivlandi', { 0: next.name }) : tr('"{0}" saqlandi', { 0: next.name }))
    },

    // O'quvchisi (tarixi) bor guruh o'chirilmaydi — arxivlanadi
    removeGroup(id: string) {
      if (!d.allowed('groups.edit')) return
      const group = d.groups.find((g) => g.id === id)
      if (!group) return
      if (d.enrollments.some((e) => e.groupId === id)) {
        d.setGroups((list) => list.map((g) => (g.id === id ? { ...g, status: 'archived', updatedAt: nowIso() } : g)))
        d.audit('group.archive', group.name, id)
        d.toast.info(tr('"{0}" da o\'quvchilar tarixi bor — o\'chirish o\'rniga arxivlandi', { 0: group.name }))
        return
      }
      d.setGroups((list) => list.filter((g) => g.id !== id))
      const entry = trashEntry({ kind: 'group', id, item: group })
      d.toTrash(entry)
      d.audit('group.delete', group.name, id)
      d.toast.success(tr('"{0}" savatchaga o\'tkazildi', { 0: group.name }), d.undo(entry))
    },

    // ===== O'qish (enrollment) =====
    // Lid guruhga qo'shilsa — "To'lov qildi" bosqichiga o'tadi va paidAt yoziladi (UI oldin tasdiq so'raydi)
    enroll(input: EnrollInput): Enrollment | null {
      if (!d.allowed('groups.edit')) return null
      const customer = d.customers.find((c) => c.id === input.customerId)
      if (!customer || !d.groups.some((g) => g.id === input.groupId)) return null
      const enrollment: Enrollment = clean({
        id: createId('e'),
        customerId: input.customerId,
        groupId: input.groupId,
        startDate: input.startDate,
        priceOverride: input.priceOverride,
        discountPercent: input.discountPercent,
        status: 'active' as const,
        createdAt: nowIso(),
      })
      d.setEnrollments((list) => [...list, enrollment])
      const converted = customer.status !== 'paid'
      if (converted) {
        const paidAt = nowIso()
        d.setCustomers((list) => list.map((c) => (c.id === customer.id ? { ...c, status: 'paid', paidAt, updatedAt: paidAt } : c)))
        d.audit('customer.status', tr('{0}: guruhga qo\'shildi → To\'lov qildi', { 0: customer.name }), customer.id)
      }
      d.audit('enrollment.create', enrollmentLabel(enrollment), enrollment.id)
      d.toast.success(tr('{0} "{1}" guruhiga qo\'shildi', { 0: customer.name, 1: groupName(input.groupId) }), {
        action: {
          label: tr('Bekor qilish'),
          onClick: () => {
            d.setEnrollments((list) => list.filter((e) => e.id !== enrollment.id))
            if (converted) d.setCustomers((list) => list.map((c) => (c.id === customer.id ? customer : c)))
            d.audit('enrollment.delete', enrollmentLabel(enrollment), enrollment.id)
          },
        },
      })
      return enrollment
    },

    updateEnrollment(id: string, patch: Partial<EnrollmentInput>, summary?: string) {
      if (!d.allowed('groups.edit')) return
      const before = d.enrollments.find((e) => e.id === id)
      if (!before) return
      const next: Enrollment = clean({ ...before, ...patch, updatedAt: nowIso() })
      for (const key of ['endDate', 'priceOverride', 'discountPercent', 'pausedFrom', 'pausedTo'] as const) {
        if (key in patch && (patch[key] === undefined || patch[key] === '')) delete next[key]
      }
      d.setEnrollments((list) => list.map((e) => (e.id === id ? next : e)))
      d.audit('enrollment.update', summary ? `${enrollmentLabel(before)}: ${summary}` : enrollmentLabel(before), id)
      d.toast.success(tr('{0}: saqlandi', { 0: customerName(before.customerId) }), {
        action: { label: tr('Bekor qilish'), onClick: () => d.setEnrollments((list) => list.map((e) => (e.id === id ? before : e))) },
      })
    },

    // Boshqa guruhga ko'chirish: eski o'qish shu kundan oldingi kun bilan tugaydi, yangisi shu kundan boshlanadi
    // (narx va chegirma saqlanadi). Boshlangan kuni ko'chirilsa — tarix kerak emas, guruh almashadi
    transferEnrollment(id: string, toGroupId: string, date: string): Enrollment | null {
      if (!d.allowed('groups.edit')) return null
      const before = d.enrollments.find((e) => e.id === id)
      if (!before || before.groupId === toGroupId) return null
      const stamp = nowIso()
      let created: Enrollment
      if (date <= before.startDate) {
        created = { ...before, groupId: toGroupId, updatedAt: stamp }
        d.setEnrollments((list) => list.map((e) => (e.id === id ? created : e)))
      } else {
        created = clean({
          id: createId('e'),
          customerId: before.customerId,
          groupId: toGroupId,
          startDate: date,
          priceOverride: before.priceOverride,
          discountPercent: before.discountPercent,
          status: 'active' as const,
          createdAt: stamp,
        })
        const closed: Enrollment = { ...before, endDate: addDays(date, -1), status: 'finished', updatedAt: stamp }
        d.setEnrollments((list) => [...list.map((e) => (e.id === id ? closed : e)), created])
      }
      d.audit('enrollment.transfer', `${customerName(before.customerId)}: ${groupName(before.groupId)} → ${groupName(toGroupId)}`, id)
      d.toast.success(tr('{0} "{1}" guruhiga ko\'chirildi', { 0: customerName(before.customerId), 1: groupName(toGroupId) }), {
        action: {
          label: tr('Bekor qilish'),
          onClick: () => d.setEnrollments((list) => [...list.filter((e) => e.id !== created.id && e.id !== id), before]),
        },
      })
      return created
    },

    removeEnrollment(id: string) {
      if (!d.allowed('groups.edit')) return
      const enrollment = d.enrollments.find((e) => e.id === id)
      if (!enrollment) return
      d.setEnrollments((list) => list.filter((e) => e.id !== id))
      const label = enrollmentLabel(enrollment)
      const entry = trashEntry({ kind: 'enrollment', id, item: enrollment, label })
      d.toTrash(entry)
      d.audit('enrollment.delete', label, id)
      d.toast.success(tr('{0} guruhdan o\'chirildi', { 0: customerName(enrollment.customerId) }), d.undo(entry))
    },

    // ===== O'qituvchilar =====
    addTeacher(input: TeacherInput): Teacher | null {
      if (!d.allowed('teachers.manage')) return null
      const teacher: Teacher = clean({ ...input, name: input.name.trim().replace(/\s+/g, ' '), id: createId('p'), createdAt: nowIso() })
      d.setTeachers((list) => [...list, teacher])
      d.audit('teacher.create', teacher.name, teacher.id)
      d.toast.success(tr('"{0}" qo\'shildi', { 0: teacher.name }))
      return teacher
    },

    updateTeacher(id: string, patch: Partial<TeacherInput>, options?: { silent?: boolean; action?: AuditAction }) {
      if (!d.allowed('teachers.manage')) return
      const before = d.teachers.find((t) => t.id === id)
      if (!before) return
      const next: Teacher = clean({ ...before, ...patch, updatedAt: nowIso() })
      if ('userId' in patch && !patch.userId) delete next.userId
      d.setTeachers((list) => list.map((t) => (t.id === id ? next : t)))
      const archived = patch.status === 'archived' && before.status !== 'archived'
      d.audit(options?.action ?? (archived ? 'teacher.archive' : 'teacher.update'), next.name, id)
      if (!options?.silent) d.toast.success(archived ? tr('"{0}" arxivlandi', { 0: next.name }) : tr('"{0}" saqlandi', { 0: next.name }))
    },

    // Guruhi bor o'qituvchi o'chirilmaydi — arxivlanadi
    removeTeacher(id: string) {
      if (!d.allowed('teachers.manage')) return
      const teacher = d.teachers.find((t) => t.id === id)
      if (!teacher) return
      if (d.groups.some((g) => g.teacherId === id)) {
        d.setTeachers((list) => list.map((t) => (t.id === id ? { ...t, status: 'archived', updatedAt: nowIso() } : t)))
        d.audit('teacher.archive', teacher.name, id)
        d.toast.info(tr('"{0}" guruhlarga biriktirilgan — o\'chirish o\'rniga arxivlandi', { 0: teacher.name }))
        return
      }
      d.setTeachers((list) => list.filter((t) => t.id !== id))
      const entry = trashEntry({ kind: 'teacher', id, item: teacher })
      d.toTrash(entry)
      d.audit('teacher.delete', teacher.name, id)
      d.toast.success(tr('"{0}" savatchaga o\'tkazildi', { 0: teacher.name }), d.undo(entry))
    },

    // ===== Davomat =====
    // Bir chaqiruv — bitta jurnal yozuvi. silent: katak bosilganda toast chiqmaydi (jurnal baribir yoziladi)
    markAttendance(marks: readonly AttendanceMark[], options?: { silent?: boolean }): boolean {
      if (!d.allowed('attendance.mark') || marks.length === 0) return false
      const denied = marks.find((m) => !canMarkDay(m.groupId, m.date))
      if (denied) {
        d.toast.error(
          denied.date > today()
            ? tr('Kelajakdagi dars uchun davomat belgilanmaydi')
            : tr('Bu kunning davomatini o\'zgartira olmaysiz (faqat bugun va oxirgi {0} kun)', { 0: d.settings.attendanceEditDays }),
        )
        return false
      }
      const stamp = nowIso()
      const key = (r: Pick<AttendanceRecord, 'groupId' | 'customerId' | 'date'>) => `${r.groupId}|${r.customerId}|${r.date}`
      const previous = new Map(d.attendance.filter((r) => marks.some((m) => key(m) === key(r))).map((r) => [key(r), r]))
      d.setAttendance((list) => {
        const byKey = new Map(list.map((r) => [key(r), r]))
        for (const m of marks) {
          const old = byKey.get(key(m))
          byKey.set(key(m), clean({ id: old?.id ?? createId('d'), groupId: m.groupId, customerId: m.customerId, date: m.date, status: m.status, note: m.note ?? old?.note, markedBy: d.actorName, updatedAt: stamp }))
        }
        return [...byKey.values()]
      })
      const groups = [...new Set(marks.map((m) => groupName(m.groupId)))].join(', ')
      const summary = marks.length === 1 ? `${customerName(marks[0].customerId)} · ${groups} · ${marks[0].date}: ${marks[0].status}` : `${groups} · ${marks[0].date}: ${marks.length} ta`
      d.audit('attendance.mark', summary, marks[0].groupId)
      if (!options?.silent) {
        d.toast.success(tr('Davomat saqlandi: {0} ta', { 0: marks.length }), {
          action: {
            label: tr('Bekor qilish'),
            onClick: () =>
              d.setAttendance((list) => {
                const restored = list.filter((r) => !marks.some((m) => key(m) === key(r)))
                return [...restored, ...previous.values()]
              }),
          },
        })
      }
      return true
    },

    // ===== Bekor qilingan darslar =====
    cancelLesson(groupId: string, date: string, reason: string) {
      if (!d.allowed('groups.edit')) return
      if (d.lessonExceptions.some((e) => e.groupId === groupId && e.date === date)) return
      const exception: LessonException = { id: createId('x'), groupId, date, reason: reason.trim() }
      d.setLessonExceptions((list) => [...list, exception])
      d.audit('lesson.cancel', `${groupName(groupId)} · ${date}${exception.reason ? ` — ${exception.reason}` : ''}`, groupId)
      d.toast.success(tr('{0} kungi dars bekor qilindi', { 0: date }), {
        action: { label: tr('Bekor qilish'), onClick: () => d.setLessonExceptions((list) => list.filter((e) => e.id !== exception.id)) },
      })
    },

    restoreLesson(id: string) {
      if (!d.allowed('groups.edit')) return
      const exception = d.lessonExceptions.find((e) => e.id === id)
      if (!exception) return
      d.setLessonExceptions((list) => list.filter((e) => e.id !== id))
      d.audit('lesson.restore', `${groupName(exception.groupId)} · ${exception.date}`, exception.groupId)
      d.toast.success(tr('{0} kungi dars qaytarildi', { 0: exception.date }), {
        action: { label: tr('Bekor qilish'), onClick: () => d.setLessonExceptions((list) => [...list, exception]) },
      })
    },
  }
}

export type EduActions = ReturnType<typeof createEduActions>
