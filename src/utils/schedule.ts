// Dars jadvali: haftalik setkada bloklar joylashuvi (sof funksiyalar)
import type { Group, Weekday } from '../types/group.types'
import { addDays, dayString, minutesOf, WEEKDAYS, weekdayOf, parseDay } from './groups'

export const DAY_START = 8 * 60
export const DAY_END = 21 * 60
export const SLOT_MINUTES = 30

export interface PlacedBlock {
  group: Group
  // Setkadagi joy: qatorlar (30 daqiqa) bo'yicha boshlanish va balandlik
  top: number
  height: number
  // Bir vaqtda bir nechta dars bo'lsa — yonma-yon
  lane: number
  lanes: number
}

// Vaqt oralig'idagi qatorlar: 08:00, 08:30, ... 20:30
export function timeSlots(): string[] {
  const result: string[] = []
  for (let m = DAY_START; m < DAY_END; m += SLOT_MINUTES) result.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  return result
}

// Bir ustundagi bloklar: kesishganlari yonma-yon (lane), oraliqdan tashqarisi qisiladi
export function placeBlocks(groups: readonly Group[]): PlacedBlock[] {
  const sorted = [...groups].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime))
  const result: PlacedBlock[] = []
  let cluster: PlacedBlock[] = []
  let clusterEnd = -1
  const laneEnds: number[] = []
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1))
    for (const b of cluster) result.push({ ...b, lanes })
    cluster = []
    laneEnds.length = 0
  }
  for (const group of sorted) {
    const start = Math.max(DAY_START, Math.min(DAY_END - SLOT_MINUTES, minutesOf(group.startTime)))
    const end = Math.max(start + 15, Math.min(DAY_END, minutesOf(group.endTime)))
    if (cluster.length > 0 && start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = end
    clusterEnd = Math.max(clusterEnd, end)
    cluster.push({ group, top: (start - DAY_START) / SLOT_MINUTES, height: (end - start) / SLOT_MINUTES, lane, lanes: 1 })
  }
  if (cluster.length) flush()
  return result
}

// Joriy haftaning kunlari (dushanbadan): Weekday -> 'YYYY-MM-DD'
export function weekDates(today: string): Record<Weekday, string> {
  const date = parseDay(today)
  const offset = WEEKDAYS.indexOf(weekdayOf(date))
  const monday = addDays(dayString(date), -offset)
  return Object.fromEntries(WEEKDAYS.map((d, i) => [d, addDays(monday, i)])) as Record<Weekday, string>
}

// Kurs rangi: kurslar ro'yxatidagi tartib bo'yicha 8 ta rangdan biri (CSS: .course-c1 ... .course-c8)
export function courseColor(courseId: string, courseIds: readonly string[]): string {
  const index = Math.max(0, courseIds.indexOf(courseId))
  return `course-c${(index % 8) + 1}`
}
