// Guruh formasi: tekshiruv va jadval ziddiyatlari (bir xona yoki bir o'qituvchi, kesishgan kun va vaqtda)
import { tr } from '../i18n'
import type { Group, GroupInput, Weekday } from '../types/group.types'
import type { Teacher } from '../types/teacher.types'
import { GROUP_LIMITS } from './guards'
import { daysLabel, minutesOf, sortDays } from './groups'

export type GroupFormErrors = Partial<Record<'name' | 'courseId' | 'branchId' | 'days' | 'startTime' | 'endTime' | 'capacity' | 'startDate' | 'endDate' | 'conflict', string>>

type Schedule = Pick<Group, 'room' | 'days' | 'startTime' | 'endTime' | 'startDate' | 'endDate'> & { teacherId?: string; branchId?: string }

export interface GroupConflict {
  group: Group
  kind: 'room' | 'teacher'
  days: Weekday[]
}

// [a, b) va [c, d) oraliqlari kesishadimi (19:30 da tugagan dars va 19:30 da boshlangan dars — kesishmaydi)
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return minutesOf(aStart) < minutesOf(bEnd) && minutesOf(bStart) < minutesOf(aEnd)
}

// Sana oraliqlari (tugash sanasi bo'lmasa — cheksiz)
export function datesOverlap(a: Pick<Group, 'startDate' | 'endDate'>, b: Pick<Group, 'startDate' | 'endDate'>): boolean {
  return (!a.endDate || a.endDate >= b.startDate) && (!b.endDate || b.endDate >= a.startDate)
}

const sameRoom = (a: string, b: string) => a.trim() !== '' && a.trim().toLowerCase() === b.trim().toLowerCase()
// Xona — filial ichida (ikki filialda bir xil "101-xona" bo'lishi mumkin); o'qituvchi — butun markaz bo'yicha
const sameBranch = (a?: string, b?: string) => (a || '') === (b || '')

// Boshqa faol guruhlar bilan ziddiyatlar
export function findConflicts(candidate: Schedule, groups: readonly Group[], excludeId?: string): GroupConflict[] {
  const result: GroupConflict[] = []
  for (const other of groups) {
    if (other.id === excludeId || other.status !== 'active') continue
    const days = sortDays(candidate.days.filter((d) => other.days.includes(d)))
    if (days.length === 0 || !timesOverlap(candidate.startTime, candidate.endTime, other.startTime, other.endTime) || !datesOverlap(candidate, other)) continue
    if (sameRoom(candidate.room, other.room) && sameBranch(candidate.branchId, other.branchId)) result.push({ group: other, kind: 'room', days })
    else if (candidate.teacherId && candidate.teacherId === other.teacherId) result.push({ group: other, kind: 'teacher', days })
  }
  return result
}

export function conflictMessage(conflict: GroupConflict, teachers: readonly Teacher[] = []): string {
  const when = `${daysLabel(conflict.days)} ${conflict.group.startTime}–${conflict.group.endTime}`
  if (conflict.kind === 'room') return tr('"{0}" xonasi band: "{1}" guruhi ({2})', { 0: conflict.group.room, 1: conflict.group.name, 2: when })
  const teacher = teachers.find((t) => t.id === conflict.group.teacherId)?.name ?? tr('O\'qituvchi')
  return tr('{0} shu vaqtda "{1}" guruhida dars beradi ({2})', { 0: teacher, 1: conflict.group.name, 2: when })
}

// Hozirgi barcha ziddiyatlar (masalan, importdan kelgan): guruh id -> ziddiyatlar
export function allConflicts(groups: readonly Group[]): Map<string, GroupConflict[]> {
  const map = new Map<string, GroupConflict[]>()
  for (const group of groups) {
    if (group.status !== 'active') continue
    const found = findConflicts(group, groups, group.id)
    if (found.length) map.set(group.id, found)
  }
  return map
}

export function validateGroup(input: GroupInput, groups: readonly Group[], editingId?: string, teachers: readonly Teacher[] = []): GroupFormErrors {
  const errors: GroupFormErrors = {}
  const name = input.name.trim()
  if (name.length < 2 || name.length > GROUP_LIMITS.maxNameLength) errors.name = tr('Guruh nomini kiriting (2–{0} belgi)', { 0: GROUP_LIMITS.maxNameLength })
  else if (groups.some((g) => g.id !== editingId && g.status !== 'archived' && g.name.trim().toLowerCase() === name.toLowerCase())) errors.name = tr('Bu nomdagi guruh bor')
  if (!input.courseId) errors.courseId = tr('Kursni tanlang')
  if (input.days.length === 0) errors.days = tr('Kamida bitta dars kunini tanlang')
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) errors.startTime = tr('Boshlanish vaqtini kiriting')
  if (!/^\d{2}:\d{2}$/.test(input.endTime)) errors.endTime = tr('Tugash vaqtini kiriting')
  else if (!errors.startTime && minutesOf(input.endTime) <= minutesOf(input.startTime)) errors.endTime = tr('Tugash vaqti boshlanishidan keyin bo\'lishi kerak')
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > GROUP_LIMITS.maxCapacity) errors.capacity = tr('Sig\'im 1 dan {0} gacha', { 0: GROUP_LIMITS.maxCapacity })
  if (!input.startDate) errors.startDate = tr('Boshlanish sanasini kiriting')
  if (input.endDate && input.startDate && input.endDate < input.startDate) errors.endDate = tr('Tugash sanasi boshlanishidan oldin bo\'lmasin')
  if (input.status === 'active' && !errors.days && !errors.endTime && !errors.startTime) {
    const [first] = findConflicts(input, groups, editingId)
    if (first) errors.conflict = tr('Ziddiyat: {0}. Vaqt, kun yoki xonani o\'zgartiring.', { 0: conflictMessage(first, teachers) })
  }
  return errors
}
