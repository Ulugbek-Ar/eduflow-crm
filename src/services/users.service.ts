// Xodimlar (lokal rejim): login, rol, holat va parol xeshi brauzerda (apex:users).
// Supabase rejimida xodimlar Auth + profiles jadvalida saqlanadi (supabase/migrations)
import { tr } from '../i18n'
import type { PublicUser, Role, StaffUser, UserStatus } from '../types/user.types'
import { createId } from '../utils/format'
import { isIsoDate, isOptionalString, isRecord, isText, keepValid, oneOf } from '../utils/guards'
import {
  burnPasswordCheck,
  checkPassword,
  createHash,
  generateTempPassword,
  isPasswordHashFields,
  needsRehash,
  randomHex,
  readLegacyCredentials,
  validateLogin,
  validatePassword,
} from './auth.service'
import { readJson, setItem, STORAGE_KEYS } from './storage.service'

export const USERS_KEY = 'apex:users'

const ROLE_SET: Record<Role, true> = { admin: true, manager: true, cashier: true, viewer: true, teacher: true }
const STATUS_SET: Record<UserStatus, true> = { active: true, blocked: true }

export const MAX_NAME_LENGTH = 60
export const MAX_TITLE_LENGTH = 40

export function isStaffUser(value: unknown): value is StaffUser {
  return (
    isRecord(value) &&
    isText(value.id) &&
    typeof value.login === 'string' &&
    validateLogin(value.login) === null &&
    typeof value.fullName === 'string' &&
    typeof value.title === 'string' &&
    oneOf(ROLE_SET, value.role) &&
    oneOf(STATUS_SET, value.status) &&
    isPasswordHashFields(value) &&
    typeof value.mustChange === 'boolean' &&
    isIsoDate(value.createdAt) &&
    isOptionalString(value.updatedAt) &&
    isOptionalString(value.lastLoginAt)
  )
}

export function toPublicUser(user: StaffUser): PublicUser {
  const { salt: _salt, passwordHash: _hash, algo: _algo, iterations: _iterations, ...rest } = user
  return rest
}

export function displayName(user: Pick<PublicUser, 'fullName' | 'login'>): string {
  return user.fullName.trim() || user.login
}

function sameLogin(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function saveUsers(users: readonly StaffUser[]): boolean {
  return setItem(USERS_KEY, users).ok
}

// 27-bosqichgacha bitta login bo'lgan (apex:auth): u birinchi administrator sifatida ko'chiriladi.
// Ism va lavozim eski profil sozlamalaridan olinadi; standart parol bo'lsa (mustChange) — keyingi kirishda almashtiriladi
function migrateLegacyAdmin(): StaffUser[] {
  const legacy = readLegacyCredentials()
  if (!legacy || validateLogin(legacy.login)) return []
  const settings = readJson(STORAGE_KEYS.settings)
  const profileName = isRecord(settings) && typeof settings.profileName === 'string' ? settings.profileName.trim().slice(0, MAX_NAME_LENGTH) : ''
  const profileRole = isRecord(settings) && isText(settings.profileRole) ? settings.profileRole.trim().slice(0, MAX_TITLE_LENGTH) : ''
  const admin: StaffUser = {
    id: createId('u'),
    login: legacy.login,
    fullName: profileName,
    title: profileRole && profileRole !== 'Administrator' ? profileRole : tr('Direktor'),
    role: 'admin',
    status: 'active',
    salt: legacy.salt,
    passwordHash: legacy.passwordHash,
    algo: legacy.algo,
    iterations: legacy.iterations,
    mustChange: legacy.mustChange,
    createdAt: new Date().toISOString(),
  }
  saveUsers([admin])
  return [admin]
}

// Saqlangan ro'yxat (buzuq yozuvlar tashlab yuboriladi). Ro'yxat hali yo'q bo'lsa — eski logindan ko'chiriladi
export function loadUsers(): StaffUser[] {
  const raw = readJson(USERS_KEY)
  if (Array.isArray(raw)) return keepValid(raw, isStaffUser)
  return migrateLegacyAdmin()
}

export function activeAdmins(users: readonly StaffUser[]): StaffUser[] {
  return users.filter((u) => u.role === 'admin' && u.status === 'active')
}

export type UserField = 'fullName' | 'title' | 'login' | 'password' | 'current' | 'role' | 'status'

export type UserResult = { ok: true; user: StaffUser; users: StaffUser[] } | { ok: false; field?: UserField; error: string }

export type LoginOutcome = { ok: true; user: StaffUser; users: StaffUser[] } | { ok: false; reason: 'invalid' | 'blocked' }

export async function authenticate(login: string, password: string): Promise<LoginOutcome> {
  const users = loadUsers()
  const user = users.find((u) => sameLogin(u.login, login))
  if (!user) {
    await burnPasswordCheck(password)
    return { ok: false, reason: 'invalid' }
  }
  if (!(await checkPassword(user, password))) return { ok: false, reason: 'invalid' }
  // Bloklangan hisob haqida faqat to'g'ri parolni bilgan kishiga aytiladi
  if (user.status === 'blocked') return { ok: false, reason: 'blocked' }
  // Migratsiya: eski SHA-256 yoki kam iteratsiyali xesh to'g'ri parol bilan kirilganda yangilanadi
  const hash = needsRehash(user) ? await createHash(password) : null
  const next: StaffUser = { ...user, ...hash, lastLoginAt: new Date().toISOString() }
  const list = users.map((u) => (u.id === user.id ? next : u))
  saveUsers(list)
  return { ok: true, user: next, users: list }
}

export interface NewUserInput {
  fullName: string
  title: string
  login: string
  role: Role
  password: string
  // O'qituvchi kirishi: shu o'qituvchi yozuviga bog'lanadi (bulutda Edge Function teachers.user_id ni yozadi)
  teacherId?: string
}

function validateProfile(fullName: string, title: string): { field: UserField; error: string } | null {
  if (fullName.trim().length < 2) return { field: 'fullName', error: tr('Ism familiyani kiriting (kamida 2 ta harf)') }
  if (fullName.trim().length > MAX_NAME_LENGTH) return { field: 'fullName', error: tr('Ism {0} belgidan oshmasin', { 0: MAX_NAME_LENGTH }) }
  if (title.trim().length > MAX_TITLE_LENGTH) return { field: 'title', error: tr('Lavozim {0} belgidan oshmasin', { 0: MAX_TITLE_LENGTH }) }
  return null
}

function validateNewAccount(users: readonly StaffUser[], login: string, password: string): { field: UserField; error: string } | null {
  const loginError = validateLogin(login)
  if (loginError) return { field: 'login', error: loginError }
  if (users.some((u) => sameLogin(u.login, login))) return { field: 'login', error: tr('Bu login band — boshqasini tanlang') }
  const passwordError = validatePassword(password, login)
  if (passwordError) return { field: 'password', error: passwordError }
  return null
}

async function buildUser(input: NewUserInput, mustChange: boolean): Promise<StaffUser> {
  return {
    id: createId('u'),
    login: input.login.trim(),
    fullName: input.fullName.trim(),
    title: input.title.trim(),
    role: input.role,
    status: 'active',
    ...(await createHash(input.password)),
    mustChange,
    createdAt: new Date().toISOString(),
  }
}

// Birinchi ishga tushish: xodim hali yo'q — markaz egasi administrator hisobini o'zi yaratadi
export async function createFirstAdmin(input: Omit<NewUserInput, 'role'>): Promise<UserResult> {
  const users = loadUsers()
  if (users.length > 0) return { ok: false, error: tr('Administrator allaqachon yaratilgan. Sahifani yangilang.') }
  const invalid = validateProfile(input.fullName, input.title) ?? validateNewAccount(users, input.login.trim(), input.password)
  if (invalid) return { ok: false, ...invalid }
  // Hisob yaratilishi bilan kirilgan hisoblanadi
  const user: StaffUser = { ...(await buildUser({ ...input, role: 'admin' }, false)), lastLoginAt: new Date().toISOString() }
  if (!saveUsers([user])) return { ok: false, error: tr('Brauzer saqlashni bloklagan — hisob yaratilmadi') }
  return { ok: true, user, users: [user] }
}

// Administrator xodim qo'shadi: berilgan parol vaqtinchalik — xodim birinchi kirishda o'zinikiga almashtiradi
export async function addUser(input: NewUserInput): Promise<UserResult> {
  const users = loadUsers()
  const invalid = validateProfile(input.fullName, input.title) ?? validateNewAccount(users, input.login.trim(), input.password)
  if (invalid) return { ok: false, ...invalid }
  const user = await buildUser(input, true)
  const list = [...users, user]
  if (!saveUsers(list)) return { ok: false, error: tr('Brauzer saqlashni bloklagan — xodim qo\'shilmadi') }
  return { ok: true, user, users: list }
}

export interface UserPatch {
  fullName?: string
  title?: string
  role?: Role
  status?: UserStatus
}

// Kamida bitta faol administrator doim qoladi; o'z rolini va holatini o'zgartirib bo'lmaydi (o'zini qulflab qo'ymaslik uchun)
export function updateUser(actorId: string, id: string, patch: UserPatch): UserResult {
  const users = loadUsers()
  const target = users.find((u) => u.id === id)
  if (!target) return { ok: false, error: tr('Xodim topilmadi') }
  if (id === actorId && patch.role !== undefined && patch.role !== target.role) {
    return { ok: false, field: 'role', error: tr('O\'z rolingizni o\'zgartira olmaysiz — buni boshqa administrator qiladi') }
  }
  if (id === actorId && patch.status === 'blocked') return { ok: false, field: 'status', error: tr('O\'zingizni bloklay olmaysiz') }
  const next: StaffUser = {
    ...target,
    ...(patch.fullName !== undefined ? { fullName: patch.fullName.trim() } : {}),
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    updatedAt: new Date().toISOString(),
  }
  const invalid = validateProfile(next.fullName, next.title)
  if (invalid) return { ok: false, ...invalid }
  const list = users.map((u) => (u.id === id ? next : u))
  if (activeAdmins(list).length === 0) {
    return { ok: false, field: patch.status ? 'status' : 'role', error: tr('Kamida bitta faol administrator qolishi kerak') }
  }
  if (!saveUsers(list)) return { ok: false, error: tr('Brauzer saqlashni bloklagan — o\'zgarish saqlanmadi') }
  return { ok: true, user: next, users: list }
}

export type ResetResult = { ok: true; user: StaffUser; users: StaffUser[]; password: string } | { ok: false; error: string }

// Yangi vaqtinchalik parol: faqat bir marta ko'rsatiladi, xodim keyingi kirishda almashtiradi
export async function resetPassword(id: string): Promise<ResetResult> {
  const users = loadUsers()
  const target = users.find((u) => u.id === id)
  if (!target) return { ok: false, error: tr('Xodim topilmadi') }
  const password = generateTempPassword()
  const next: StaffUser = { ...target, ...(await createHash(password)), mustChange: true, updatedAt: new Date().toISOString() }
  const list = users.map((u) => (u.id === id ? next : u))
  if (!saveUsers(list)) return { ok: false, error: tr('Brauzer saqlashni bloklagan — parol tiklanmadi') }
  return { ok: true, user: next, users: list, password }
}

// Profil: ism va lavozimni har kim o'zi o'zgartiradi
export function updateOwnProfile(id: string, fullName: string, title: string): UserResult {
  const users = loadUsers()
  const target = users.find((u) => u.id === id)
  if (!target) return { ok: false, error: tr('Hisob topilmadi') }
  const invalid = validateProfile(fullName, title)
  if (invalid) return { ok: false, ...invalid }
  const next: StaffUser = { ...target, fullName: fullName.trim(), title: title.trim(), updatedAt: new Date().toISOString() }
  const list = users.map((u) => (u.id === id ? next : u))
  if (!saveUsers(list)) return { ok: false, error: tr('Brauzer saqlashni bloklagan — o\'zgarish saqlanmadi') }
  return { ok: true, user: next, users: list }
}

// Login va/yoki parolni almashtirish (joriy parol bilan tasdiqlanadi)
export async function changeOwnCredentials(id: string, currentPassword: string, newLogin: string, newPassword: string): Promise<UserResult> {
  const users = loadUsers()
  const target = users.find((u) => u.id === id)
  if (!target) return { ok: false, error: tr('Hisob topilmadi') }
  if (!(await checkPassword(target, currentPassword))) return { ok: false, field: 'current', error: tr('Joriy parol noto\'g\'ri') }
  const login = newLogin.trim()
  const loginError = validateLogin(login)
  if (loginError) return { ok: false, field: 'login', error: loginError }
  if (users.some((u) => u.id !== id && sameLogin(u.login, login))) return { ok: false, field: 'login', error: tr('Bu login band — boshqasini tanlang') }
  if (newPassword) {
    const passwordError = validatePassword(newPassword, login)
    if (passwordError) return { ok: false, field: 'password', error: passwordError }
  }
  // Parol o'zgarmasa ham eski formatdagi xesh joriy parol bilan yangilanadi
  const hash = newPassword ? await createHash(newPassword) : needsRehash(target) ? await createHash(currentPassword) : null
  const next: StaffUser = { ...target, ...hash, login, mustChange: newPassword ? false : target.mustChange, updatedAt: new Date().toISOString() }
  const list = users.map((u) => (u.id === id ? next : u))
  if (!saveUsers(list)) return { ok: false, error: tr('Brauzer saqlashni bloklagan — o\'zgarish saqlanmadi') }
  return { ok: true, user: next, users: list }
}

// Vaqtinchalik (yoki eski standart) parol bilan kirgandan keyin — majburiy almashtirish
export async function completePasswordChange(id: string, newPassword: string): Promise<UserResult> {
  const users = loadUsers()
  const target = users.find((u) => u.id === id)
  if (!target) return { ok: false, error: tr('Hisob topilmadi') }
  const passwordError = validatePassword(newPassword, target.login)
  if (passwordError) return { ok: false, field: 'password', error: passwordError }
  if (await checkPassword(target, newPassword)) {
    return { ok: false, field: 'password', error: tr('Yangi parol vaqtinchalik paroldan farq qilishi kerak') }
  }
  const next: StaffUser = { ...target, ...(await createHash(newPassword)), mustChange: false, updatedAt: new Date().toISOString() }
  const list = users.map((u) => (u.id === id ? next : u))
  if (!saveUsers(list)) return { ok: false, error: tr('Brauzer saqlashni bloklagan — parol saqlanmadi') }
  return { ok: true, user: next, users: list }
}

// Demo xodimlar: parol bilan kirib bo'lmaydi (xesh tasodifiy) — faqat "Demo'ni ko'rish" orqali
export const DEMO_STAFF: ReadonlyArray<Pick<StaffUser, 'login' | 'fullName' | 'title' | 'role'>> = [
  { login: 'demo.admin', fullName: 'Dilshod Rahimov', title: tr('Direktor'), role: 'admin' },
  { login: 'demo.menejer', fullName: 'Malika Yusupova', title: tr('Sotuv menejeri'), role: 'manager' },
  { login: 'demo.kassir', fullName: 'Sardor Qodirov', title: tr('Buxgalter'), role: 'cashier' },
  { login: 'demo.kuzatuvchi', fullName: 'Nodira Karimova', title: tr('Ta\'sischi'), role: 'viewer' },
  // id: demo-u5 (DEMO_TEACHER_USER_ID) — demo markazdagi "Nodira Saidova" o'qituvchi yozuviga bog'langan
  { login: 'demo.oqituvchi', fullName: 'Nodira Saidova', title: tr('Ingliz tili o\'qituvchisi'), role: 'teacher' },
]

export function createDemoStaff(now = new Date()): StaffUser[] {
  return DEMO_STAFF.map((staff, index) => ({
    ...staff,
    id: `demo-u${index + 1}`,
    status: 'active',
    salt: randomHex(),
    passwordHash: randomHex(32),
    algo: 'pbkdf2-sha256',
    iterations: 1,
    mustChange: false,
    createdAt: new Date(now.getTime() - (90 - index * 20) * 86_400_000).toISOString(),
  }))
}

export function saveDemoStaff(): StaffUser[] {
  const staff = createDemoStaff()
  saveUsers(staff)
  return staff
}
