// Supabase bilan ishlash (bulutli rejim). Bu modul faqat VITE_SUPABASE_* berilganda yuklanadi —
// lokal/demo rejimda supabase-js umuman yuklab olinmaydi
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditEntry } from '../services/audit.service'
import type { StoredData } from '../services/storage.service'
import type { Subscription } from '../services/subscription.service'
import type { TrashEntry, TrashKind } from '../services/trash.service'
import type { Settings } from '../types/dashboard.types'
import type { PublicUser, Role, UserStatus } from '../types/user.types'
import type { ListKey } from '../services/storage.service'
import { sanitizeSettings } from '../utils/guards'
import { cloudConfig } from './config'
import { diffById } from './diff'
import type { Changes } from './diff'
import {
  attendanceToRow,
  courseToRow,
  customerToRow,
  enrollmentToRow,
  exceptionToRow,
  groupToRow,
  rowToAttendance,
  rowToCourse,
  rowToCustomer,
  rowToEnrollment,
  rowToException,
  rowToGroup,
  rowToTeacher,
  rowToTransaction,
  teacherToRow,
  transactionToRow,
} from './mappers'
import type { Row } from './mappers'

let client: SupabaseClient | null = null

export function getClient(): SupabaseClient {
  if (client) return client
  const config = cloudConfig()
  if (!config) throw new Error('Supabase sozlanmagan')
  client = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'eduflow-cloud-auth' } })
  return client
}

// Testlar uchun: soxta mijozni o'rnatish
export function setClient(next: SupabaseClient | null): void {
  client = next
}

export interface CloudProfile extends PublicUser {
  organizationId: string
}

export interface CloudOrg {
  id: string
  name: string
  settings: Settings
  subscription: Subscription
}

type TrashTable = 'customers' | 'transactions' | 'courses' | 'teachers' | 'groups' | 'enrollments'
const TABLES: Record<TrashKind, TrashTable> = {
  customer: 'customers',
  transaction: 'transactions',
  course: 'courses',
  teacher: 'teachers',
  group: 'groups',
  enrollment: 'enrollments',
}

function profileFromRow(r: Row, email = ''): CloudProfile {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    login: email || String(r.email ?? r.id),
    fullName: String(r.full_name ?? ''),
    title: String(r.title ?? ''),
    role: r.role as Role,
    status: r.status as UserStatus,
    mustChange: Boolean(r.must_change_password),
    createdAt: String(r.created_at),
    ...(r.last_login_at ? { lastLoginAt: String(r.last_login_at) } : {}),
  }
}

function orgFromRow(r: Row): CloudOrg {
  return {
    id: String(r.id),
    name: String(r.name),
    settings: sanitizeSettings({ ...(r.settings as object), orgName: r.name }),
    subscription: {
      plan: r.plan as Subscription['plan'],
      status: r.status as Subscription['status'],
      ...(r.trial_ends_at ? { trialEndsAt: String(r.trial_ends_at) } : {}),
      ...(r.paid_until ? { paidUntil: String(r.paid_until) } : {}),
      enforced: true,
    },
  }
}

function fail(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message)
}

// ===== Kirish =====
export type CloudLoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'blocked' | 'network'; message?: string }

export async function signIn(email: string, password: string): Promise<CloudLoginResult> {
  const { error } = await getClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) return { ok: false, reason: error.status && error.status >= 500 ? 'network' : 'invalid', message: error.message }
  const profile = await loadOwnProfile()
  if (!profile || profile.status === 'blocked') {
    await getClient().auth.signOut()
    return { ok: false, reason: 'blocked' }
  }
  await getClient().rpc('touch_login')
  await logEvent('auth.login', profile.login)
  return { ok: true }
}

// Ro'yxatdan o'tish: Auth foydalanuvchi + markaz (14 kun sinov). Email tasdiqlash yoqilgan bo'lsa — seans keyin
export async function signUp(input: { email: string; password: string; orgName: string; fullName: string; title: string }): Promise<'ready' | 'confirm-email'> {
  const sb = getClient()
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}app`, data: { org_name: input.orgName, full_name: input.fullName, title: input.title } },
  })
  fail(error)
  if (!data.session) return 'confirm-email'
  const { error: orgError } = await sb.rpc('create_organization', { p_name: input.orgName, p_full_name: input.fullName, p_title: input.title })
  fail(orgError)
  return 'ready'
}

// Kirgan foydalanuvchi profili; email tasdiqlangach birinchi kirishda markaz hali yaratilmagan bo'lsa —
// ro'yxatdan o'tishda berilgan ma'lumot bilan yaratiladi. Profil bir marta o'qiladi (ortiqcha so'rovsiz)
export async function ensureOrganization(): Promise<CloudProfile | null> {
  const sb = getClient()
  const profile = await loadOwnProfile()
  if (profile) return profile
  const { data } = await sb.auth.getUser()
  const meta = (data.user?.user_metadata ?? {}) as Record<string, string>
  if (!data.user || !meta.org_name) return null
  const { error } = await sb.rpc('create_organization', { p_name: meta.org_name, p_full_name: meta.full_name ?? data.user.email ?? '', p_title: meta.title ?? '' })
  // Markaz yaratilmasa (masalan, allaqachon bor) — avvalgidek profilsiz davom etamiz, ulanish xatosi emas
  if (error) return null
  return loadOwnProfile()
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await getClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}app`,
  })
  fail(error)
}

export async function changePassword(newPassword: string): Promise<void> {
  const sb = getClient()
  const { error } = await sb.auth.updateUser({ password: newPassword })
  fail(error)
  await sb.rpc('password_changed')
  await logEvent('auth.password', 'Parol almashtirildi')
}

// Joriy parolni tekshirish (login/parol almashtirishdan oldin)
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const { error } = await getClient().auth.signInWithPassword({ email, password })
  return !error
}

export async function changeEmail(email: string): Promise<void> {
  const { error } = await getClient().auth.updateUser({ email: email.trim().toLowerCase() })
  fail(error)
}

export async function signOut(scope: 'local' | 'others' | 'global' = 'local'): Promise<void> {
  if (scope === 'local') await logEvent('auth.logout', '').catch(() => undefined)
  await getClient().auth.signOut({ scope })
}

export async function currentEmail(): Promise<string | null> {
  const { data } = await getClient().auth.getSession()
  return data.session?.user.email ?? null
}

// ===== Profil, xodimlar, markaz =====
// Seans yo'q — null. Tarmoq/server xatosi — istisno (foydalanuvchi "chiqib ketgan" deb ko'rsatilmasin)
export async function loadOwnProfile(): Promise<CloudProfile | null> {
  const sb = getClient()
  const { data: session } = await sb.auth.getSession()
  if (!session.session) return null
  const { data: auth, error: authError } = await sb.auth.getUser()
  if (authError) {
    // Token yaroqsiz yoki foydalanuvchi o'chirilgan — haqiqatan ham kirilmagan
    const status = (authError as { status?: number }).status
    if (status && status >= 400 && status < 500) return null
    throw new Error(authError.message)
  }
  if (!auth.user) return null
  const { data, error } = await sb.from('profiles').select('*').eq('id', auth.user.id).maybeSingle()
  fail(error)
  return data ? profileFromRow(data as Row, auth.user.email ?? '') : null
}

export async function loadStaff(): Promise<CloudProfile[]> {
  const { data, error } = await getClient().from('profiles').select('*').order('created_at')
  fail(error)
  return ((data ?? []) as Row[]).map((r) => profileFromRow(r))
}

export async function loadOrganization(): Promise<CloudOrg | null> {
  const { data } = await getClient().from('organizations').select('*').maybeSingle()
  return data ? orgFromRow(data as Row) : null
}

export async function saveSettings(org: string, settings: Settings): Promise<void> {
  // RLS ruxsat bermasa (muddat tugagan, huquq yo'q) UPDATE xatosiz 0 qator qaytaradi — buni xato deb bilamiz,
  // aks holda ilova "saqlandi" deb o'ylab qoladi
  const { data, error } = await getClient().from('organizations').update({ name: settings.orgName, settings }).eq('id', org).select('id')
  fail(error)
  if (Array.isArray(data) && data.length === 0) throw new Error('Sozlamalar saqlanmadi: ruxsat yo\'q yoki tarif muddati tugagan')
}

export async function updateOwnProfile(fullName: string, title: string): Promise<void> {
  const { error } = await getClient().rpc('update_own_profile', { p_full_name: fullName, p_title: title })
  fail(error)
}

export async function updateStaff(id: string, patch: { role?: Role; status?: UserStatus; fullName?: string; title?: string }): Promise<void> {
  const { error } = await getClient().rpc('update_staff', {
    p_id: id,
    p_role: patch.role ?? null,
    p_status: patch.status ?? null,
    p_full_name: patch.fullName ?? null,
    p_title: patch.title ?? null,
  })
  fail(error)
}

async function invokeStaff(body: Record<string, unknown>): Promise<{ id?: string; password: string }> {
  const { data, error } = await getClient().functions.invoke('staff', { body })
  if (error) {
    // Edge Function xato matni javob tanasida
    const context = (error as { context?: Response }).context
    const detail = context ? await context.json().catch(() => null) : null
    throw new Error((detail as { error?: string } | null)?.error ?? error.message)
  }
  return data as { id?: string; password: string }
}

export function inviteStaff(input: { email: string; fullName: string; title: string; role: Role; password: string; teacherId?: string }) {
  return invokeStaff({ action: 'invite', ...input })
}

export function resetStaffPassword(id: string) {
  return invokeStaff({ action: 'reset', id })
}

// ===== Ma'lumot =====
export interface CloudSnapshot {
  data: StoredData
  trash: TrashEntry[]
}

// role — kirgan xodim roli: o'qituvchi mijozlar jadvalini ko'rmaydi (RLS) — o'quvchilar ismi teacher_roster() dan
// (telefonsiz); o'qituvchilar ro'yxatini (maosh qoidasi bilan) faqat teachers.manage / payroll.view ko'radi,
// qolganlar teacher_directory() dan ism va fanlarni oladi
// Supabase (PostgREST) bitta javobda ko'pi bilan ~1000 qator beradi (loyiha sozlamasi "Max rows"), .limit() buni
// oshirmaydi. Shuning uchun katta jadvallar sahifalab o'qiladi: hammasi kelguncha .range() bilan
export const PAGE_SIZE = 1000
type Page = { data: unknown[] | null; error: { message: string } | null; count?: number | null }
type Pager = (from: number, to: number) => PromiseLike<Page>

export async function fetchAll(page: Pager, pageSize = PAGE_SIZE): Promise<{ data: Row[]; error: { message: string } | null }> {
  const all: Row[] = []
  for (;;) {
    const res = await page(all.length, all.length + pageSize - 1)
    if (res.error) return { data: all, error: res.error }
    const rows = (res.data ?? []) as Row[]
    all.push(...rows)
    // Jami soni ma'lum bo'lsa — unga qarab; bo'lmasa sahifa to'lmagan bo'lsa tugadi. Server sahifani kichikroq
    // kessa ham (max_rows < pageSize), count bo'yicha davom etadi
    const total = typeof res.count === 'number' ? res.count : null
    if (rows.length === 0 || (total !== null ? all.length >= total : rows.length < pageSize)) return { data: all, error: null }
  }
}

export async function loadSnapshot(org: CloudOrg, role: Role = 'admin'): Promise<CloudSnapshot> {
  const sb = getClient()
  const seesTeachers = role === 'admin' || role === 'cashier' || role === 'viewer' || role === 'teacher'
  const table = (name: string, order = 'id') => fetchAll((from, to) => sb.from(name).select('*', { count: 'exact' }).order(order).range(from, to))
  const [customers, transactions, courses, teachers, groups, enrollments, attendance, exceptions] = await Promise.all([
    role === 'teacher' ? fetchAll((from, to) => sb.rpc('teacher_roster').order('id').range(from, to)) : table('customers'),
    table('transactions'),
    table('courses'),
    seesTeachers ? table('teachers') : fetchAll((from, to) => sb.rpc('teacher_directory').order('id').range(from, to)),
    table('groups'),
    table('enrollments'),
    table('attendance'),
    table('lesson_exceptions'),
  ])
  for (const r of [customers, transactions, courses, teachers, groups, enrollments, attendance, exceptions]) fail(r.error)
  const active = (rows: unknown[] | null) => ((rows ?? []) as Row[]).filter((r) => !r.deleted_at)
  const deleted = (rows: unknown[] | null) => ((rows ?? []) as Row[]).filter((r) => r.deleted_at)
  const meta = (r: Row) => ({ id: String(r.id), deletedAt: String(r.deleted_at), deletedBy: String(r.deleted_by ?? '') })
  const trash: TrashEntry[] = [
    ...deleted(customers.data).map((r) => ({ kind: 'customer' as const, ...meta(r), item: rowToCustomer(r) })),
    ...deleted(transactions.data).map((r) => ({ kind: 'transaction' as const, ...meta(r), item: rowToTransaction(r) })),
    ...deleted(courses.data).map((r) => ({ kind: 'course' as const, ...meta(r), item: rowToCourse(r) })),
    ...deleted(teachers.data).map((r) => ({ kind: 'teacher' as const, ...meta(r), item: rowToTeacher(r) })),
    ...deleted(groups.data).map((r) => ({ kind: 'group' as const, ...meta(r), item: rowToGroup(r) })),
    ...deleted(enrollments.data).map((r) => ({ kind: 'enrollment' as const, ...meta(r), item: rowToEnrollment(r) })),
  ]
  return {
    data: {
      customers: active(customers.data).map(rowToCustomer),
      transactions: active(transactions.data).map(rowToTransaction),
      courses: active(courses.data).map(rowToCourse),
      settings: org.settings,
      teachers: active(teachers.data).map(rowToTeacher),
      groups: active(groups.data).map(rowToGroup),
      enrollments: active(enrollments.data).map(rowToEnrollment),
      attendance: ((attendance.data ?? []) as Row[]).map(rowToAttendance),
      lessonExceptions: ((exceptions.data ?? []) as Row[]).map(rowToException),
    },
    trash,
  }
}

const UPSERT_CHUNK = 500
// O'chirish so'rovida id'lar URL'da (?id=in.(...)) ketadi — juda uzun URL (414) bo'lmasin: 150 tadan
const DELETE_CHUNK = 150

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Holat o'zgarishini serverga yuborish: yangi/o'zgarganlar — upsert, olib tashlanganlar — savatchaga (trash_move).
// Savatchada turgan id qayta paydo bo'lsa — tiklash (trash_restore)
export class CloudSync {
  private trashed: Set<string>
  private org: string

  constructor(org: string, trash: readonly TrashEntry[]) {
    this.org = org
    this.trashed = new Set(trash.map((e) => `${e.kind}:${e.id}`))
  }

  // Serverdan yangilangan savatcha (boshqa xodim o'chirgan yozuvni tiklash ham trash_restore orqali bo'lsin)
  setTrash(trash: readonly TrashEntry[]) {
    this.trashed = new Set(trash.map((e) => `${e.kind}:${e.id}`))
  }

  private async apply<T extends { id: string }>(kind: TrashKind, changes: Changes<T>, toRow: (item: T, org: string) => Row) {
    const sb = getClient()
    const table = TABLES[kind]
    if (changes.upserts.length) {
      // Katta import (5000 qatorgacha) bitta so'rovga sig'masin: 500 tadan
      for (let i = 0; i < changes.upserts.length; i += UPSERT_CHUNK) {
        const { error } = await sb.from(table).upsert(changes.upserts.slice(i, i + UPSERT_CHUNK).map((item) => toRow(item, this.org)), { onConflict: 'organization_id,id' })
        fail(error)
      }
      const restored = changes.upserts.filter((item) => this.trashed.has(`${kind}:${item.id}`)).map((item) => item.id)
      if (restored.length) {
        const { error: restoreError } = await sb.rpc('trash_restore', { p_table: table, p_ids: restored })
        fail(restoreError)
        for (const id of restored) this.trashed.delete(`${kind}:${id}`)
      }
    }
    if (changes.removedIds.length) {
      const { error } = await sb.rpc('trash_move', { p_table: table, p_ids: changes.removedIds })
      fail(error)
      for (const id of changes.removedIds) this.trashed.add(`${kind}:${id}`)
    }
  }

  customers(prev: StoredData['customers'], next: StoredData['customers']) {
    return this.apply('customer', diffById(prev, next), customerToRow)
  }

  transactions(prev: StoredData['transactions'], next: StoredData['transactions']) {
    return this.apply('transaction', diffById(prev, next), transactionToRow)
  }

  courses(prev: StoredData['courses'], next: StoredData['courses']) {
    return this.apply('course', diffById(prev, next), courseToRow)
  }

  // Savatchasiz jadvallar (davomat, bekor qilingan darslar): o'zgargani — upsert (noyob kalit bo'yicha), olib tashlangani — o'chiriladi
  private async plain<T extends { id: string }>(table: 'attendance' | 'lesson_exceptions', changes: Changes<T>, toRow: (item: T, org: string) => Row, conflict: string) {
    const sb = getClient()
    for (const part of chunks(changes.upserts, UPSERT_CHUNK)) {
      const { error } = await sb.from(table).upsert(part.map((item) => toRow(item, this.org)), { onConflict: conflict })
      fail(error)
    }
    for (const part of chunks(changes.removedIds, DELETE_CHUNK)) {
      const { error } = await sb.from(table).delete().eq('organization_id', this.org).in('id', part)
      fail(error)
    }
  }

  // DashboardContext: istalgan ro'yxat o'zgarishi
  list<K extends ListKey>(key: K, prev: StoredData[K], next: StoredData[K]): Promise<void> {
    switch (key) {
      case 'customers':
        return this.customers(prev as StoredData['customers'], next as StoredData['customers'])
      case 'transactions':
        return this.transactions(prev as StoredData['transactions'], next as StoredData['transactions'])
      case 'courses':
        return this.courses(prev as StoredData['courses'], next as StoredData['courses'])
      case 'teachers':
        return this.apply('teacher', diffById(prev as StoredData['teachers'], next as StoredData['teachers']), teacherToRow)
      case 'groups':
        return this.apply('group', diffById(prev as StoredData['groups'], next as StoredData['groups']), groupToRow)
      case 'enrollments':
        return this.apply('enrollment', diffById(prev as StoredData['enrollments'], next as StoredData['enrollments']), enrollmentToRow)
      case 'attendance':
        return this.plain('attendance', diffById(prev as StoredData['attendance'], next as StoredData['attendance']), attendanceToRow, 'organization_id,group_id,customer_id,date')
      default:
        return this.plain(
          'lesson_exceptions',
          diffById(prev as StoredData['lessonExceptions'], next as StoredData['lessonExceptions']),
          exceptionToRow,
          'organization_id,group_id,date',
        )
    }
  }

  settings(next: Settings) {
    return saveSettings(this.org, next)
  }

  async purge(kind: TrashKind, ids: readonly string[]) {
    // Katta savatcha (masalan, bekor qilingan import) — bo'laklab: id'lar URL'da ketadi
    for (const part of chunks(ids, DELETE_CHUNK)) {
      const { error } = await getClient().from(TABLES[kind]).delete().eq('organization_id', this.org).in('id', part)
      fail(error)
      for (const id of part) this.trashed.delete(`${kind}:${id}`)
    }
  }
}

// ===== Jurnal =====
const CLIENT_EVENTS = new Set(['auth.login', 'auth.logout', 'auth.password', 'data.export', 'data.backup', 'session.revoke', 'reminder.sent', 'import.run', 'import.undo'])

export async function logEvent(action: string, summary: string, entityId?: string): Promise<void> {
  // Ma'lumot o'zgarishlari server triggerlari bilan yoziladi — ikki marta yozmaymiz
  if (!CLIENT_EVENTS.has(action)) return
  await getClient().rpc('log_event', { p_action: action, p_summary: summary.slice(0, 200), p_entity: entityId ?? null })
}

export async function listAudit(): Promise<AuditEntry[]> {
  // Oxirgi 3000 ta hodisa (sahifalab: server bir javobda 1000 tadan ko'p bermaydi)
  const all: Row[] = []
  for (let from = 0; from < 3000; from += PAGE_SIZE) {
    const { data: page, error } = await getClient().from('audit_log').select('*').order('at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
    fail(error)
    all.push(...((page ?? []) as Row[]))
    if ((page ?? []).length < PAGE_SIZE) break
  }
  const data = all
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    at: String(r.at),
    action: r.action as AuditEntry['action'],
    userId: String(r.user_id ?? ''),
    userName: String(r.user_name ?? ''),
    ...(r.role ? { role: r.role as Role } : {}),
    summary: String(r.summary ?? ''),
    ...(r.entity_id ? { entityId: String(r.entity_id) } : {}),
  }))
}

// ===== Ko'chirish (lokal / JSON -> bulut) =====
export async function importBackup(data: StoredData): Promise<{ customers: number; transactions: number; courses: number; groups?: number; enrollments?: number }> {
  const { data: result, error } = await getClient().rpc('import_backup', { p_data: data })
  fail(error)
  return result as { customers: number; transactions: number; courses: number; groups?: number; enrollments?: number }
}

export { diffById }
