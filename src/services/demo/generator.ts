// Demo markaz generatori: "hozir"ga moslashgan, deterministik (kunga bog'liq urug'), o'tgan yilning 1-yanvaridan
// boshlanadigan tarix (12–24 oy). Har qanday kunda (oyning 1-kuni, 31-dekabr, 1-yanvar...) "Bugun / 7 kun / Shu oy /
// Shu yil" davrlarining har birida va ularning oldingi teng davrida yangi lid va to'langan kirim bo'ladi — KPI va
// trendlar "—" bo'lib qolmaydi.
//
// Model: o'quvchilar soni maqsadli egri chiziq bo'yicha (taxminan 33 -> 50) o'sadi; har o'quvchi guruhga yoziladi,
// kurs davomiyligi tugagach bitiradi (ba'zilari erta ketadi); oylik to'lov o'z odatiy kunida (oyning 1–10-sanasi),
// birinchi to'lov — yozilgan kuni. 4–7 nafar qarzdor o'tgan va joriy oy to'lovini o'tkazib yuborgan.
import type { Course } from '../../types/course.types'
import type { Customer, CustomerSource, CustomerStatus } from '../../types/customer.types'
import type { DateRange } from '../../types/dashboard.types'
import type { PaymentMethod, Transaction, TransactionCategory } from '../../types/finance.types'
import type { AttendanceRecord, AttendanceStatus, LessonException } from '../../types/attendance.types'
import type { Enrollment, Group, Weekday } from '../../types/group.types'
import type { Teacher } from '../../types/teacher.types'
import { getPeriod, getPreviousPeriod } from '../../utils/analytics'
import type { Period } from '../../utils/analytics'
import { createMockCourses, DEMO_TEACHER_USER_ID } from '../../constants/mockData'
import { Rng } from './prng'

const DAY = 86_400_000
const MONTH_NAMES = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

// ===== Statik tarkib =====

export interface DemoTeacherSeed {
  name: string
  phone: string
  subjects: string[]
  payRule: { type: 'fixed'; amount: number } | { type: 'percent'; percent: number } | { type: 'perStudent'; amount: number }
}

export const DEMO_TEACHERS: readonly DemoTeacherSeed[] = [
  { name: 'Nodira Saidova', phone: '+998 90 311 22 44', subjects: ['Ingliz tili', 'IELTS'], payRule: { type: 'percent', percent: 40 } },
  { name: 'Sherzod Aliyev', phone: '+998 93 455 66 77', subjects: ['Frontend', 'Python'], payRule: { type: 'fixed', amount: 6_500_000 } },
  { name: 'Gulchehra Tursunova', phone: '+998 94 522 33 11', subjects: ['Matematika'], payRule: { type: 'perStudent', amount: 180_000 } },
  { name: 'Anvar Qosimov', phone: '+998 97 640 12 12', subjects: ['Rus tili'], payRule: { type: 'percent', percent: 35 } },
]

// Hafta kunlari: 1 — dushanba ... 6 — shanba (Date.getDay bilan bir xil, yakshanba — 0)
export interface DemoGroupSeed {
  name: string
  courseIndex: number
  teacherIndex: number
  room: string
  days: number[]
  startTime: string
  endTime: string
  capacity: number
  // Yangi o'quvchi shu kursning qaysi guruhiga ko'proq yoziladi
  weight: number
}

export const DEMO_GROUPS: readonly DemoGroupSeed[] = [
  { name: 'IELTS — ertalabki', courseIndex: 0, teacherIndex: 0, room: '101-xona', days: [1, 3, 5], startTime: '09:00', endTime: '10:30', capacity: 15, weight: 1 },
  { name: 'IELTS — kechki', courseIndex: 0, teacherIndex: 0, room: '101-xona', days: [1, 3, 5], startTime: '18:00', endTime: '19:30', capacity: 15, weight: 2 },
  { name: 'Frontend — 1-guruh', courseIndex: 1, teacherIndex: 1, room: 'Kompyuter xonasi', days: [2, 4, 6], startTime: '14:00', endTime: '16:00', capacity: 12, weight: 1 },
  { name: 'Python — 1-guruh', courseIndex: 2, teacherIndex: 1, room: 'Kompyuter xonasi', days: [1, 3, 5], startTime: '16:00', endTime: '17:30', capacity: 12, weight: 1 },
  { name: 'Matematika — DTM ertalabki', courseIndex: 3, teacherIndex: 2, room: '102-xona', days: [2, 4, 6], startTime: '09:00', endTime: '10:30', capacity: 16, weight: 1 },
  { name: 'Matematika — DTM kunduzgi', courseIndex: 3, teacherIndex: 2, room: '102-xona', days: [1, 3, 5], startTime: '14:00', endTime: '15:30', capacity: 16, weight: 1 },
  { name: 'Rus tili — boshlang\'ich', courseIndex: 4, teacherIndex: 3, room: '103-xona', days: [2, 4, 6], startTime: '16:30', endTime: '18:00', capacity: 14, weight: 1 },
]

// Yangi o'quvchi qaysi kursga yoziladi (guruhi bor kurslar)
const COURSE_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [0, 30],
  [3, 25],
  [1, 15],
  [2, 14],
  [4, 16],
]

// Yozilmagan lidlar qiziqqan kurslar (guruhi yo'q kurslar va xizmat ham)
const LEAD_COURSE_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [0, 26],
  [3, 18],
  [1, 14],
  [2, 12],
  [4, 10],
  [5, 12],
  [6, 8],
]

const SOURCE_WEIGHTS: ReadonlyArray<readonly [CustomerSource, number]> = [
  ['instagram', 40],
  ['telegram', 30],
  ['referral', 18],
  ['website', 12],
]

const METHOD_WEIGHTS: ReadonlyArray<readonly [PaymentMethod, number]> = [
  ['card', 55],
  ['cash', 30],
  ['transfer', 15],
]

const FIRST_MALE = ['Jasur', 'Sardor', 'Bekzod', 'Otabek', 'Doniyor', 'Rustam', 'Javohir', 'Aziz', 'Sherzod', 'Bobur', 'Diyor', 'Farrux', 'Islom', 'Jahongir', 'Kamron', 'Mirjalol', 'Nodir', 'Oybek', 'Sanjar', 'Temur', 'Ulug\'bek', 'Xurshid', 'Yusuf', 'Zafar', 'Abdulla', 'Alisher', 'Behruz', 'Dilshod', 'Elyor', 'Firdavs']
const FIRST_FEMALE = ['Aziza', 'Dilnoza', 'Madina', 'Nilufar', 'Shahnoza', 'Kamola', 'Gulnoza', 'Malika', 'Sevara', 'Zarina', 'Mohira', 'Dildora', 'Feruza', 'Laylo', 'Munisa', 'Nigora', 'Ozoda', 'Robiya', 'Sabina', 'Shaxzoda', 'Umida', 'Yulduz', 'Zilola', 'Barno', 'Charos', 'Durdona', 'Hilola', 'Iroda', 'Jasmina', 'Kumush']
const LAST_NAMES = ['Karimov', 'Toshmatov', 'Rahimov', 'Yusupov', 'Abdullayev', 'Ergashev', 'Qodirov', 'Nazarov', 'Mirzayev', 'Saidov', 'Xasanov', 'Aliyev', 'Ismoilov', 'Umarov', 'Sobirov', 'Tursunov', 'Usmonov', 'Hamidov', 'Sultonov', 'Jo\'rayev', 'Normatov', 'Bakirov', 'Ochilov', 'Po\'latov', 'Rasulov', 'Salimov', 'Valiyev', 'Zokirov', 'Murodov', 'Islomov']
const OPERATORS = ['90', '91', '93', '94', '95', '97', '98', '99', '33', '88', '77', '50']
const LEAD_NOTES = ['Kechki guruhni so\'radi', 'Ota-onasi qo\'ng\'iroq qiladi', 'Narxni so\'radi, o\'ylab ko\'radi', 'Sinov darsiga yozildi', 'Do\'sti tavsiya qilgan', 'Shanba kunlari qulay']

// ===== Sana yordamchilari (mahalliy vaqt) =====

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function monthStart(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function atTime(day: Date, hour: number, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
}

// Yakshanba — dam olish: to'lov va yozilish dushanbaga suriladi
function workday(date: Date): Date {
  return date.getDay() === 0 ? new Date(date.getTime() + DAY) : date
}

// Kelajakdagi vaqt bo'lmasin: bugun, lekin hozirdan keyin rejalashtirilgan hodisa — hozirdan biroz oldin.
// jitter har doim chaqiruvchi tomonidan olinadi: PRNG ketma-ketligi kun ichidagi soatga bog'liq bo'lmasin
// (ertalab ham, kechqurun ham demo bir xil)
function notAfter(date: Date, now: Date, jitterMinutes: number): Date {
  if (date.getTime() <= now.getTime()) return date
  const dayStart = startOfDay(now).getTime()
  return new Date(Math.max(dayStart, now.getTime() - jitterMinutes * 60_000))
}

// Bugungi (hozirdan keyingi) hodisa -> hozirdan oldin; ertangi va undan keyingisi -> null
function clampToNow(date: Date, now: Date, jitterMinutes: number): Date | null {
  if (date.getTime() <= now.getTime()) return date
  return dayKey(date) === dayKey(now) ? notAfter(date, now, jitterMinutes) : null
}

// ===== Davr oynalari (kafolatlar uchun) =====

export interface DemoWindow extends Period {
  range: DateRange
  previous: boolean
}

export const DEMO_RANGES: readonly DateRange[] = ['today', '7d', 'month', 'year']

// Joriy davr bugun kun oxirigacha (getPeriod kabi). Generator bugungi barcha hodisalarni hozirdan oldinga qisadi,
// shuning uchun tekshiruvlar kun ichidagi soatga bog'liq emas
export function demoWindows(now: Date): DemoWindow[] {
  return DEMO_RANGES.flatMap((range) => [
    { range, previous: false, ...getPeriod(range, now) },
    { range, previous: true, ...getPreviousPeriod(range, now) },
  ])
}

const within = (date: Date, w: Period) => date.getTime() >= w.start.getTime() && date.getTime() <= w.end.getTime()

function randomIn(w: Period, rng: Rng, now: Date, notBefore?: Date): Date {
  // Ish vaqti (09:00–19:00) ichida, oyna chegarasida qisiladi; bugun hozirdan keyin bo'lsa — hozirdan oldin
  const from = Math.min(Math.max(w.start.getTime(), notBefore?.getTime() ?? 0), w.end.getTime())
  const day = new Date(from + rng.float() * Math.max(0, w.end.getTime() - from))
  const candidate = new Date(Math.min(Math.max(atTime(day, rng.int(9, 18), rng.int(0, 59)).getTime(), from), w.end.getTime()))
  const clamped = notAfter(candidate, now, rng.int(1, 40))
  return new Date(Math.max(clamped.getTime(), Math.min(from, now.getTime())))
}

// ===== Reja =====

export type DemoEnrollmentStatus = 'active' | 'finished' | 'left'

export interface DemoStudentPlan {
  courseIndex: number
  groupIndex: number
  leadAt: Date
  start: Date
  // Rejadagi tugash (kurs davomiyligi bo'yicha oy oxiri) yoki erta ketgan oy oxiri
  end: Date
  status: DemoEnrollmentStatus
  discount: number
  payDay: number
  method: PaymentMethod
  debtor: boolean
  // Joriy oy pauzada (to'lov va davomat yo'q)
  paused: boolean
}

interface LeadPlan {
  createdAt: Date
  courseIndex: number
  status: CustomerStatus
  student?: DemoStudentPlan
}

// O'quvchilar soni maqsadi: hozir ~50, 5 oy oldin ~40, ikki yil oldin ~33
export function targetActive(date: Date, now: Date): number {
  // Kun aniqligida: bir kun ichida soat o'zgarsa ham natija o'zgarmaydi
  const monthsAgo = Math.max(0, (startOfDay(now).getTime() - startOfDay(date).getTime()) / (30.44 * DAY))
  return monthsAgo <= 5 ? 50 - 2 * monthsAgo : 40 - 0.4 * (monthsAgo - 5)
}

const activeAt = (s: DemoStudentPlan, t: Date) => s.start.getTime() <= t.getTime() && s.end.getTime() >= t.getTime()

export interface DemoPlan {
  now: Date
  historyStart: Date
  courses: Course[]
  students: DemoStudentPlan[]
  leads: LeadPlan[]
  capacities: number[]
}

function planStudents(now: Date, rng: Rng, courses: readonly Course[], historyStart: Date): { students: DemoStudentPlan[]; capacities: number[] } {
  const students: DemoStudentPlan[] = []
  const capacities = DEMO_GROUPS.map((g) => g.capacity)

  const groupLoad = (groupIndex: number, at: Date) => students.filter((s) => s.groupIndex === groupIndex && activeAt(s, at)).length

  const makeStudent = (start: Date, leadAt?: Date): DemoStudentPlan | null => {
    // Kurs va bo'sh joyi bor guruh; to'lgan bo'lsa — boshqa kurs
    for (let attempt = 0; attempt < 6; attempt++) {
      const courseIndex = rng.weighted(COURSE_WEIGHTS)
      const options = DEMO_GROUPS.map((g, index) => ({ g, index })).filter(({ g, index }) => g.courseIndex === courseIndex && groupLoad(index, start) < capacities[index])
      if (options.length === 0) continue
      const groupIndex = rng.weighted(options.map(({ g, index }) => [index, g.weight] as const))
      const duration = Math.max(1, courses[courseIndex].durationMonths)
      const leavesEarly = duration > 2 && rng.chance(0.1)
      const months = leavesEarly ? rng.int(1, duration - 1) : duration
      const end = monthEnd(addMonths(start, months - 1))
      const finished = end.getTime() < now.getTime()
      const lag = rng.weighted([
        [0, 3],
        [1, 3],
        [3, 2],
        [7, 1],
        [12, 1],
      ] as const)
      // Lid to'lovdan oldin kelgan bo'lishi shart (bir kunda bo'lsa ham)
      const leadCandidate = atTime(new Date(start.getTime() - lag * DAY), rng.int(9, 19), rng.int(0, 59))
      return {
        courseIndex,
        groupIndex,
        leadAt: leadAt ?? new Date(Math.min(leadCandidate.getTime(), start.getTime() - rng.int(10, 120) * 60_000)),
        start,
        end,
        status: finished ? (leavesEarly ? 'left' : 'finished') : 'active',
        discount: rng.weighted([
          [0, 82],
          [10, 10],
          [15, 5],
          [20, 3],
        ] as const),
        payDay: rng.int(1, 10),
        method: rng.weighted(METHOD_WEIGHTS),
        debtor: false,
        paused: false,
      }
    }
    return null
  }

  // Boshlang'ich o'quvchilar: tarix boshida allaqachon o'qiyotganlar (ilgariroq yozilgan)
  const initial = Math.round(targetActive(historyStart, now))
  for (let i = 0; i < initial; i++) {
    const back = rng.int(0, 5)
    const start = workday(atTime(new Date(historyStart.getFullYear(), historyStart.getMonth() - back, rng.int(1, 27)), rng.int(9, 17), rng.int(0, 59)))
    rng.int(1, 40)
    const student = makeStudent(start)
    if (student && student.end.getTime() >= historyStart.getTime()) students.push(student)
  }

  // Har oy: maqsadga yetish uchun kerakli yangi o'quvchilar (bitirganlar o'rniga ham)
  // Bitiruvchilar oy oxirida ketadi, yangilar oy davomida keladi. Joriy oyda — o'tgan kunlarga mutanosib qismi
  for (let month = new Date(historyStart); month.getTime() <= now.getTime(); month = addMonths(month, 1)) {
    const end = monthEnd(month)
    const windowEnd = new Date(Math.min(end.getTime(), now.getTime()))
    const active = students.filter((s) => activeAt(s, month)).length
    const leaving = students.filter((s) => activeAt(s, month) && s.end.getTime() <= end.getTime()).length
    const fraction = windowEnd.getDate() / end.getDate()
    const isCurrent = end.getTime() >= now.getTime()
    let need = Math.max(1, Math.round((targetActive(end, now) - active + leaving) * fraction))
    // Joriy oyda bitiruvchilar hali ketmagan: hozirgi o'quvchilar soni 45–60 oralig'idan chiqmasin
    if (isCurrent) need = Math.max(1, Math.min(need, 57 - active))
    const lastDay = windowEnd.getDate()
    for (let i = 0; i < need; i++) {
      const day = workday(new Date(month.getFullYear(), month.getMonth(), rng.int(1, lastDay)))
      const start = notAfter(atTime(day, rng.int(9, 18), rng.int(0, 59)), now, rng.int(1, 40))
      const student = makeStudent(start)
      if (!student) continue
      // Joriy oyda yozilganlarning ko'pchiligi shu oy kelgan lidlar (yangi reklama mavsumi)
      if (isCurrent && student.leadAt.getTime() < month.getTime()) {
        student.leadAt = new Date(Math.max(month.getTime(), student.start.getTime() - rng.int(30, 600) * 60_000))
      }
      students.push(student)
    }
  }
  return { students, capacities }
}

export function buildPlan(now: Date): DemoPlan {
  const rng = new Rng(`eduflow-demo:${dayKey(now)}`)
  const historyStart = monthStart(now.getFullYear() - 1, 0)
  const courses = createMockCourses(historyStart)
  const { students, capacities } = planStudents(now, rng, courses, historyStart)
  const windows = demoWindows(now)

  // Kafolat: "Bugun"dan boshqa har bir oynada (va "Shu oy"da doim) shu oynada kelib, to'lov qilgan lid bor
  for (const w of windows) {
    const needsConversion = w.range !== 'today' || within(getPeriod('month', now).start, w)
    if (!needsConversion || students.some((s) => within(s.leadAt, w))) continue
    const start = randomIn(w, rng, now)
    const leadAt = new Date(w.start.getTime() + rng.float() * (start.getTime() - w.start.getTime()))
    for (let attempt = 0; attempt < 4; attempt++) {
      const student = planForced(start, leadAt)
      if (student) {
        students.push(student)
        break
      }
    }
  }

  function planForced(start: Date, leadAt: Date): DemoStudentPlan | null {
    const courseIndex = rng.weighted(COURSE_WEIGHTS)
    const groupIndex = DEMO_GROUPS.findIndex(
      (g, index) => g.courseIndex === courseIndex && students.filter((s) => s.groupIndex === index && activeAt(s, start)).length < capacities[index],
    )
    if (groupIndex < 0) return null
    const duration = Math.max(1, courses[courseIndex].durationMonths)
    const end = monthEnd(addMonths(start, duration - 1))
    return {
      courseIndex,
      groupIndex,
      leadAt,
      start,
      end,
      status: end.getTime() < now.getTime() ? 'finished' : 'active',
      discount: 0,
      payDay: rng.int(1, 10),
      method: rng.weighted(METHOD_WEIGHTS),
      debtor: false,
      paused: false,
    }
  }

  // Qarzdorlar: o'tgan oydan oldin yozilgan faol o'quvchilardan 4–7 nafari
  const previousMonth = addMonths(monthStart(now.getFullYear(), now.getMonth()), -1)
  const candidates = rng.shuffle(students.filter((s) => s.status === 'active' && s.start.getTime() < previousMonth.getTime()))
  const debtorCount = rng.int(4, 7)
  for (const s of candidates.slice(0, debtorCount)) s.debtor = true
  // Bir o'quvchi shu oy pauzada (oilaviy sabab) — to'lov kutilmaydi
  const pausedStudent = candidates[debtorCount]
  if (pausedStudent) pausedStudent.paused = true

  // Yozilmagan lidlar: kuniga ~0.4 ta, eskilari ko'pincha "Bekor qilindi"
  const leads: LeadPlan[] = students.map((student) => ({ createdAt: student.leadAt, courseIndex: student.courseIndex, status: 'paid', student }))
  const span = now.getTime() - historyStart.getTime()
  for (let day = startOfDay(historyStart); day.getTime() <= now.getTime(); day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    // Reklama kuchaygani sari lidlar ham ko'payadi (kuniga ~0.3 -> ~0.45)
    const growth = (day.getTime() - historyStart.getTime()) / span
    const count = (rng.chance(0.22 + 0.1 * growth) ? 1 : 0) + (rng.chance(0.08 + 0.05 * growth) ? 1 : 0)
    for (let i = 0; i < count; i++) {
      const createdAt = notAfter(atTime(day, rng.int(9, 20), rng.int(0, 59)), now, rng.int(1, 40))
      leads.push({ createdAt, courseIndex: rng.weighted(LEAD_COURSE_WEIGHTS), status: leadStatus(createdAt, now, rng) })
    }
  }
  // Kafolat: har bir oynada kamida bitta yangi lid
  for (const w of windows) {
    if (leads.some((l) => within(l.createdAt, w))) continue
    const createdAt = randomIn(w, rng, now)
    leads.push({ createdAt, courseIndex: rng.weighted(LEAD_COURSE_WEIGHTS), status: w.range === 'today' && !w.previous ? 'new' : leadStatus(createdAt, now, rng) })
  }
  // "Shu oy" (standart ko'rinish): yangi lidlar o'tgan oyning shu kunigacha bo'lganidan biroz ko'p (+5…+25%)
  const [monthNow, monthPrev] = windows.filter((w) => w.range === 'month')
  const countIn = (w: Period) => leads.filter((l) => within(l.createdAt, w)).length
  const wantLeads = Math.ceil(countIn(monthPrev) * (1.05 + rng.float() * 0.2))
  for (let extra = countIn(monthNow); extra < wantLeads; extra++) {
    const createdAt = randomIn(monthNow, rng, now)
    leads.push({ createdAt, courseIndex: rng.weighted(LEAD_COURSE_WEIGHTS), status: leadStatus(createdAt, now, rng) })
  }
  // Konversiya ham o'tgan oydan past bo'lmasin (yangi lidlar hali "o'ylayapti" — ko'pi bilan 3 ta tez yozilgan o'quvchi)
  const conversionIn = (w: Period) => {
    const inWindow = leads.filter((l) => within(l.createdAt, w))
    return inWindow.length > 0 ? inWindow.filter((l) => l.student).length / inWindow.length : 0
  }
  const previousRate = conversionIn(monthPrev)
  for (let i = 0; i < 3 && previousRate < 0.6 && conversionIn(monthNow) < previousRate; i++) {
    if (students.filter((st) => activeAt(st, now)).length >= 57) break
    const start = randomIn(monthNow, rng, now)
    const leadAt = new Date(monthNow.start.getTime() + rng.float() * (start.getTime() - monthNow.start.getTime()))
    const student = planForced(start, leadAt)
    if (!student) break
    students.push(student)
    leads.push({ createdAt: leadAt, courseIndex: student.courseIndex, status: 'paid', student })
  }
  leads.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  // "Deyarli to'lgan" guruh: eng band guruhda bitta joy qoladi
  const loads = DEMO_GROUPS.map((_, index) => students.filter((s) => s.groupIndex === index && s.status === 'active').length)
  const busiest = loads.indexOf(Math.max(...loads))
  capacities[busiest] = Math.max(loads[busiest] + 1, 8)

  return { now, historyStart, courses, students, leads, capacities }
}

function leadStatus(createdAt: Date, now: Date, rng: Rng): CustomerStatus {
  const age = Math.round((startOfDay(now).getTime() - startOfDay(createdAt).getTime()) / DAY)
  if (age <= 3) return rng.weighted([['new', 6], ['contacted', 4]] as const)
  if (age <= 14) return rng.weighted([['new', 2], ['contacted', 4], ['thinking', 4]] as const)
  return rng.weighted([['cancelled', 7], ['thinking', 2], ['new', 1]] as const)
}

// ===== Yozuvlarga aylantirish =====

export interface DemoPayment {
  student: DemoStudentPlan
  date: Date
  amount: number
  period: string
  first: boolean
}

export function studentFee(plan: Pick<DemoPlan, 'courses'>, student: DemoStudentPlan): number {
  const price = plan.courses[student.courseIndex].monthlyPrice
  return Math.round((price * (1 - student.discount / 100)) / 1000) * 1000
}

// Har o'quvchining oylik to'lovlari (kelgusi oy ham — kafolat uchun oldinga tortish mumkin)
function schedulePayments(plan: DemoPlan, rng: Rng): DemoPayment[] {
  const { now } = plan
  const currentMonth = monthIndex(now)
  const payments: DemoPayment[] = []
  for (const student of plan.students) {
    const fee = studentFee(plan, student)
    const first = new Date(Math.min(student.start.getTime() + rng.int(5, 40) * 60_000, Math.max(student.start.getTime(), now.getTime())))
    payments.push({ student, date: first, amount: fee, period: periodKey(student.start), first: true })
    const lastMonth = Math.min(monthIndex(student.end), currentMonth + 1)
    for (let m = monthIndex(student.start) + 1; m <= lastMonth; m++) {
      if (student.debtor && m >= currentMonth - 1) continue
      if (student.paused && m === currentMonth) continue
      const month = new Date(Math.floor(m / 12), m % 12, 1)
      const day = workday(new Date(month.getFullYear(), month.getMonth(), student.payDay))
      payments.push({ student, date: atTime(day, rng.int(9, 19), rng.int(0, 59)), amount: fee, period: periodKey(month), first: false })
    }
  }
  return payments.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export interface DemoData {
  customers: Customer[]
  transactions: Transaction[]
  courses: Course[]
  teachers: Teacher[]
  groups: Group[]
  enrollments: Enrollment[]
  attendance: AttendanceRecord[]
  lessonExceptions: LessonException[]
}

const WEEKDAY_BY_NUMBER: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Davomat oxirgi 8 hafta bo'yicha
export const ATTENDANCE_WEEKS = 8

export interface DemoBuild extends DemoData {
  plan: DemoPlan
  // Reja -> mijoz id
  customerIds: Map<DemoStudentPlan, string>
  payments: DemoPayment[]
}

function uniqueNames(rng: Rng, count: number): string[] {
  const combos: string[] = []
  for (const last of LAST_NAMES) {
    for (const first of FIRST_MALE) combos.push(`${first} ${last}`)
    for (const first of FIRST_FEMALE) combos.push(`${first} ${last}a`)
  }
  const shuffled = rng.shuffle(combos)
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length] + (i >= shuffled.length ? ` ${Math.floor(i / shuffled.length) + 1}` : ''))
}

function uniquePhones(rng: Rng, count: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  while (result.length < count) {
    const phone = `+998 ${rng.pick(OPERATORS)} ${String(rng.int(100, 999))} ${String(rng.int(0, 99)).padStart(2, '0')} ${String(rng.int(0, 99)).padStart(2, '0')}`
    if (seen.has(phone)) continue
    seen.add(phone)
    result.push(phone)
  }
  return result
}

function courseShort(course: Course): string {
  return course.name.replace(/\s*\(.*\)$/, '')
}

export function generateDemo(now: Date = new Date()): DemoBuild {
  const plan = buildPlan(now)
  const rng = new Rng(`eduflow-demo-tx:${dayKey(now)}`)
  const { courses } = plan

  // Mijozlar: kelgan vaqti bo'yicha c1, c2, ...
  const names = uniqueNames(rng, plan.leads.length)
  const phones = uniquePhones(rng, plan.leads.length)
  const customerIds = new Map<DemoStudentPlan, string>()
  const customers: Customer[] = plan.leads.map((lead, index) => {
    const id = `c${index + 1}`
    const customer: Customer = {
      id,
      name: names[index],
      phone: phones[index],
      course: courses[lead.courseIndex].name,
      status: lead.status,
      source: rng.weighted(SOURCE_WEIGHTS),
      createdAt: lead.createdAt.toISOString(),
    }
    if (lead.student) {
      customerIds.set(lead.student, id)
      customer.paidAt = lead.student.start.toISOString()
    }
    if (rng.chance(0.12)) customer.note = rng.pick(LEAD_NOTES)
    return customer
  })
  const customerById = new Map(customers.map((c) => [c.id, c]))

  // O'qituvchilar (birinchisi demo o'qituvchi xodimiga bog'langan), guruhlar va o'qishlar
  const created = new Date(historyStart(plan).getTime() - 280 * DAY).toISOString()
  const teachers: Teacher[] = DEMO_TEACHERS.map((t, index) => ({
    id: `p${index + 1}`,
    name: t.name,
    phone: t.phone,
    subjects: [...t.subjects],
    payRule: { ...t.payRule },
    ...(index === 0 ? { userId: DEMO_TEACHER_USER_ID } : {}),
    status: 'active',
    createdAt: created,
  }))
  const earliestStart = plan.students.reduce((min, st) => (st.start.getTime() < min ? st.start.getTime() : min), now.getTime())
  const groups: Group[] = DEMO_GROUPS.map((g, index) => ({
    id: `g${index + 1}`,
    name: g.name,
    courseId: courses[g.courseIndex].id,
    teacherId: `p${g.teacherIndex + 1}`,
    room: g.room,
    days: g.days.map((d) => WEEKDAY_BY_NUMBER[d]),
    startTime: g.startTime,
    endTime: g.endTime,
    capacity: plan.capacities[index],
    startDate: dayKey(new Date(earliestStart)),
    status: 'active',
    createdAt: created,
  }))
  const thisMonthStart = monthStart(now.getFullYear(), now.getMonth())
  const enrollmentIds = new Map<DemoStudentPlan, string>()
  const enrollments: Enrollment[] = []
  plan.students.forEach((student, index) => {
    const customerId = customerIds.get(student)
    if (!customerId) return
    const id = `e${index + 1}`
    enrollmentIds.set(student, id)
    enrollments.push({
      id,
      customerId,
      groupId: `g${student.groupIndex + 1}`,
      startDate: dayKey(student.start),
      // Faol o'quvchida — kurs davomiyligi bo'yicha rejadagi tugash sanasi
      endDate: dayKey(student.end),
      ...(student.discount > 0 ? { discountPercent: student.discount } : {}),
      status: student.paused ? 'paused' : student.status,
      ...(student.paused ? { pausedFrom: dayKey(thisMonthStart), pausedTo: dayKey(monthEnd(thisMonthStart)) } : {}),
      createdAt: student.start.toISOString(),
    })
  })

  // To'lovlar jadvali + kafolat: har oynada to'langan kirim (keyingi to'lovni oldinroq — avans sifatida — tortib)
  const payments = schedulePayments(plan, rng)
  for (const p of payments) {
    const jitter = rng.int(1, 40)
    if (p.date.getTime() > now.getTime() && dayKey(p.date) === dayKey(now)) p.date = notAfter(p.date, now, jitter)
  }
  const windows = demoWindows(now)
  // Oldinga tortiladigan to'lov o'quvchi yozilgan kundan oldin bo'lmaydi
  const pull = (w: Period): boolean => {
    const candidate = payments.find((p) => !p.first && p.date.getTime() > w.end.getTime() && p.student.start.getTime() <= w.end.getTime())
    if (!candidate) return false
    candidate.date = randomIn(w, rng, now, candidate.student.start)
    payments.sort((a, b) => a.date.getTime() - b.date.getTime())
    return true
  }
  const paidIn = (w: Period) => payments.reduce((sum, p) => sum + (within(p.date, w) && p.date.getTime() <= now.getTime() ? p.amount : 0), 0)
  for (let pass = 0; pass < 3; pass++) {
    for (const w of windows) if (paidIn(w) === 0) pull(w)
  }
  // "Shu oy": tushum o'tgan oyning shu kunigacha bo'lganidan biroz ko'p (oldindan to'lovlar hisobiga, ko'pi bilan 12 ta)
  const [monthNow, monthPrev] = windows.filter((w) => w.range === 'month')
  const wantRevenue = paidIn(monthPrev) * (1.05 + rng.float() * 0.15)
  for (let i = 0; i < 12 && paidIn(monthNow) < wantRevenue; i++) if (!pull(monthNow)) break

  const transactions: Transaction[] = []
  let txNo = 0
  const nextId = () => `t${++txNo}`
  for (const p of payments) {
    if (p.date.getTime() > now.getTime()) continue
    const customerId = customerIds.get(p.student)
    if (!customerId) continue
    const course = courses[p.student.courseIndex]
    const [year, month] = p.period.split('-').map(Number)
    transactions.push({
      id: nextId(),
      type: 'income',
      amount: p.amount,
      method: p.student.method,
      category: 'course_fee',
      note: `${courseShort(course)} — ${MONTH_NAMES[month - 1]} ${year}`,
      customerId,
      customerName: customerById.get(customerId)?.name,
      status: 'paid',
      date: p.date.toISOString(),
      enrollmentId: enrollmentIds.get(p.student),
      period: p.period,
    })
  }

  // Qarzdorlardan biri qisman to'lagan, 1–2 tasi "Kutilmoqda" (keyingi kunlarga va'da)
  const debtors = plan.students.filter((s) => s.debtor)
  const thisMonth = monthStart(now.getFullYear(), now.getMonth())
  if (debtors[0]) {
    const s = debtors[0]
    const date = notAfter(atTime(new Date(Math.max(thisMonth.getTime(), now.getTime() - 3 * DAY)), 11, 15), now, rng.int(1, 40))
    const customerId = customerIds.get(s)
    if (customerId) {
      transactions.push({
        id: nextId(),
        type: 'income',
        amount: Math.round(studentFee(plan, s) / 2 / 1000) * 1000,
        method: 'cash',
        category: 'course_fee',
        note: `${courseShort(courses[s.courseIndex])} — qisman to'lov`,
        customerId,
        customerName: customerById.get(customerId)?.name,
        status: 'paid',
        date: date.toISOString(),
        enrollmentId: enrollmentIds.get(s),
        period: periodKey(addMonths(thisMonth, -1)),
      })
    }
  }
  for (const s of debtors.slice(1, 1 + rng.int(1, 2))) {
    const customerId = customerIds.get(s)
    if (!customerId) continue
    transactions.push({
      id: nextId(),
      type: 'income',
      amount: studentFee(plan, s),
      method: 'transfer',
      category: 'course_fee',
      note: `${courseShort(courses[s.courseIndex])} — to'lashga va'da berdi`,
      customerId,
      customerName: customerById.get(customerId)?.name,
      status: 'pending',
      date: atTime(new Date(now.getTime() + rng.int(2, 6) * DAY), 10, 0).toISOString(),
      enrollmentId: enrollmentIds.get(s),
      period: periodKey(addMonths(thisMonth, -1)),
    })
  }
  // Bekor qilingan (xato kiritilgan) to'lov
  const today = startOfDay(now).getTime()
  const old = transactions.find((t) => t.type === 'income' && today - Date.parse(t.date) > 60 * DAY && Date.parse(t.date) > today - 120 * DAY)
  if (old) transactions.push({ ...old, id: nextId(), note: `${old.note} (xato kiritilgan, bekor qilindi)`, status: 'cancelled' })

  transactions.push(...monthlyExpenses(plan, payments, rng, nextId))
  transactions.sort((a, b) => b.date.localeCompare(a.date))

  const { attendance, lessonExceptions } = demoAttendance(plan, groups, enrollments, teachers, new Rng(`eduflow-demo-att:${dayKey(now)}`))
  return { customers, transactions, courses, teachers, groups, enrollments, attendance, lessonExceptions, plan, customerIds, payments }
}

const historyStart = (plan: DemoPlan) => plan.historyStart

// O'zbekistondagi dam olish kunlari (sana o'zgarmaydiganlari)
const HOLIDAYS: Record<string, string> = {
  '01-01': 'Yangi yil',
  '03-08': 'Xotin-qizlar kuni',
  '03-21': 'Navro\'z',
  '05-09': 'Xotira va qadrlash kuni',
  '09-01': 'Mustaqillik kuni',
  '10-01': 'O\'qituvchilar kuni',
  '12-08': 'Konstitutsiya kuni',
}

// Oxirgi 8 hafta davomati (~85–92% kelgan). Bugungi tugagan darslardan oxirgisi belgilanmagan qoladi
// ("Dars tugadi, lekin davomat belgilanmagan" eslatmasi uchun); bitta o'quvchi ketma-ket 3 darsga kelmagan
function demoAttendance(plan: DemoPlan, groups: readonly Group[], enrollments: readonly Enrollment[], teachers: readonly Teacher[], rng: Rng) {
  const { now } = plan
  const today = dayKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const attendance: AttendanceRecord[] = []
  const lessonExceptions: LessonException[] = []
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ATTENDANCE_WEEKS * 7)
  // Bitta guruhda bir dars o'qituvchi kasalligi sababli bekor qilingan (taxminan 2–3 hafta oldin)
  const sickGroup = groups[3]
  let sickDay = ''
  for (let back = 15; back < 25 && !sickDay; back++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    if (sickGroup && sickGroup.days.includes(WEEKDAY_BY_NUMBER[date.getDay()])) sickDay = dayKey(date)
  }
  if (sickGroup && sickDay) lessonExceptions.push({ id: 'x1', groupId: sickGroup.id, date: sickDay, reason: 'O\'qituvchi kasal' })
  // Ketma-ket kelmayotgan o'quvchi: eng ko'p o'quvchisi bor guruhdan bir nafar
  const truant = rng.pick(enrollments.filter((e) => e.status === 'active' && e.startDate < dayKey(from)))
  const endedToday = groups.filter((g) => g.days.includes(WEEKDAY_BY_NUMBER[now.getDay()]) && toMinutes(g.endTime) <= nowMinutes)
  const unmarked = endedToday.sort((a, b) => toMinutes(b.endTime) - toMinutes(a.endTime))[0]
  for (let date = new Date(from); dayKey(date) <= today; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
    const day = dayKey(date)
    const holiday = HOLIDAYS[day.slice(5)]
    for (const group of groups) {
      if (!group.days.includes(WEEKDAY_BY_NUMBER[date.getDay()])) continue
      if (holiday) {
        lessonExceptions.push({ id: `x-${group.id}-${day}`, groupId: group.id, date: day, reason: `Bayram: ${holiday}` })
        continue
      }
      if (lessonExceptions.some((e) => e.groupId === group.id && e.date === day)) continue
      const teacher = teachers.find((t) => t.id === group.teacherId)
      for (const e of enrollments) {
        if (e.groupId !== group.id || e.startDate > day || (e.endDate && e.endDate < day)) continue
        if (e.status === 'paused' && e.pausedFrom && e.pausedFrom <= day) continue
        // PRNG har dars uchun bir xil iste'mol qilinadi (kun ichidagi soatdan qat'i nazar)
        const status: AttendanceStatus = rng.weighted([['present', 86], ['late', 4], ['absent', 6], ['excused', 4]] as const)
        // Bugun: faqat tugagan darslar (oxirgisidan tashqari)
        if (day === today && (toMinutes(group.endTime) > nowMinutes || group === unmarked)) continue
        attendance.push({ id: `d${attendance.length + 1}`, groupId: group.id, customerId: e.customerId, date: day, status, markedBy: teacher?.name, updatedAt: atTime(date, 20, 0).toISOString() })
      }
    }
  }
  // Oxirgi 3 belgilangan dars — "kelmadi"
  if (truant) {
    const marked = attendance.filter((r) => r.customerId === truant.customerId && r.groupId === truant.groupId).sort((a, b) => a.date.localeCompare(b.date))
    for (const r of marked.slice(-3)) r.status = 'absent'
  }
  return { attendance, lessonExceptions }
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Har oy: ijara (1-sana), maosh (keyingi oyning 5-sanasi, o'qituvchi qoidasi bo'yicha), marketing (manba bilan),
// kommunal (15-sana), ba'zan jihozlar. Faqat hozirgacha
function monthlyExpenses(plan: DemoPlan, payments: readonly DemoPayment[], rng: Rng, nextId: () => string): Transaction[] {
  const { now, historyStart } = plan
  const result: Transaction[] = []
  const add = (planned: Date, amount: number, category: TransactionCategory, note: string, method: PaymentMethod, source?: CustomerSource, extra?: Pick<Transaction, 'teacherId' | 'period'>) => {
    const date = clampToNow(planned, now, rng.int(1, 40))
    if (!date) return
    result.push({ id: nextId(), type: 'expense', amount, method, category, note, status: 'paid', date: date.toISOString(), ...(source ? { source } : {}), ...extra })
  }
  for (let month = new Date(historyStart); month.getTime() <= now.getTime(); month = addMonths(month, 1)) {
    const y = month.getFullYear()
    const m = month.getMonth()
    const label = `${MONTH_NAMES[m]} ${y}`
    add(new Date(y, m, 1, 10, 0), 6_000_000, 'rent', `Xona ijarasi — ${label}`, 'transfer')
    add(new Date(y, m, 15, 12, 0), Math.round(rng.int(900, 1300)) * 1000, 'utilities', `Elektr, gaz va internet — ${label}`, 'card')
    add(new Date(y, m, 8, 11, 0), rng.int(10, 18) * 100_000, 'marketing', 'Instagram target reklama', 'card', 'instagram')
    add(new Date(y, m, 20, 15, 0), rng.int(5, 10) * 100_000, 'marketing', 'Telegram kanalda reklama', 'card', 'telegram')
    if (m % 3 === 1) add(new Date(y, m, 25, 16, 0), 400_000, 'marketing', 'Sayt va Google reklama', 'card', 'website')
    if (m % 4 === 2) add(new Date(y, m, 12, 13, 0), rng.int(10, 30) * 100_000, 'equipment', 'Proyektor va o\'quv jihozlari', 'cash')
    // Maosh: shu oy uchun, keyingi oyning 5-sanasida
    const payDate = workday(new Date(y, m + 1, 5, 17, 0))
    const monthStartDate = new Date(y, m, 1)
    const monthEndDate = monthEnd(monthStartDate)
    DEMO_TEACHERS.forEach((teacher, teacherIndex) => {
      const groups = DEMO_GROUPS.map((g, index) => ({ g, index })).filter(({ g }) => g.teacherIndex === teacherIndex).map(({ index }) => index)
      const own = plan.students.filter((s) => groups.includes(s.groupIndex))
      let amount: number
      if (teacher.payRule.type === 'fixed') amount = teacher.payRule.amount
      else if (teacher.payRule.type === 'perStudent') {
        amount = own.filter((s) => s.start.getTime() <= monthEndDate.getTime() && s.end.getTime() >= monthStartDate.getTime()).length * teacher.payRule.amount
      } else {
        const revenue = payments
          .filter((p) => own.includes(p.student) && p.date.getTime() >= monthStartDate.getTime() && p.date.getTime() <= monthEndDate.getTime())
          .reduce((sum, p) => sum + p.amount, 0)
        amount = Math.round((revenue * teacher.payRule.percent) / 100 / 10_000) * 10_000
      }
      if (amount > 0) add(payDate, amount, 'salary', `Maosh: ${teacher.name} — ${label}`, 'transfer', undefined, { teacherId: `p${teacherIndex + 1}`, period: periodKey(monthStartDate) })
    })
  }
  return result
}
