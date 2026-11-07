// Edge Function "staff": administrator xodim qo'shadi yoki parolini tiklaydi (service role kaliti faqat serverda).
// Chaqirish: supabase.functions.invoke('staff', { body: { action: 'invite' | 'reset', ... } })
// Deploy: supabase functions deploy staff
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STAFF_LIMIT: Record<string, number | null> = { trial: 3, standard: 5, pro: null }
const ROLES = ['admin', 'manager', 'cashier', 'viewer', 'teacher']

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Chalkash belgilarsiz vaqtinchalik parol (ilovadagi bilan bir xil alifbo)
function tempPassword(length = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2))
  let out = ''
  for (const b of bytes) {
    if (b < 256 - (256 % alphabet.length)) out += alphabet[b % alphabet.length]
    if (out.length === length) break
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // Chaqiruvchi — shu markaz administratori bo'lishi kerak (uning tokeni bilan tekshiriladi)
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: me } = await asCaller.from('profiles').select('id, organization_id, role, status').single()
  if (!me || me.role !== 'admin' || me.status !== 'active') return json(403, { error: 'Faqat administrator' })
  const { data: writable } = await asCaller.rpc('org_writable')
  if (!writable) return json(403, { error: 'Tarif muddati tugagan yoki markaz to\'xtatilgan' })

  const admin = createClient(url, service)
  const body = await req.json().catch(() => ({}))

  if (body.action === 'invite') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const fullName = String(body.fullName ?? '').trim()
    const role = String(body.role ?? 'viewer')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Email noto\'g\'ri' })
    if (fullName.length < 2) return json(400, { error: 'Ism familiyani kiriting' })
    if (!ROLES.includes(role)) return json(400, { error: 'Rol noto\'g\'ri' })

    const { data: org } = await admin.from('organizations').select('plan').eq('id', me.organization_id).single()
    // O'qituvchi kirishlari tarif limitiga kirmaydi
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', me.organization_id).eq('status', 'active').neq('role', 'teacher')
    const limit = STAFF_LIMIT[org?.plan ?? 'trial']
    if (role !== 'teacher' && limit !== null && (count ?? 0) >= limit) return json(409, { error: `Tarifingizda ${limit} tagacha xodim` })

    // Ilova yaratgan vaqtinchalik parol (administrator uni xodimga beradi) yoki serverda yangisi
    const given = String(body.password ?? '')
    const password = given.length >= 8 && given.length <= 128 ? given : tempPassword()
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !created.user) return json(409, { error: error?.message ?? 'Foydalanuvchi yaratilmadi' })
    const { error: profileError } = await admin.from('profiles').insert({
      id: created.user.id,
      organization_id: me.organization_id,
      full_name: fullName,
      title: String(body.title ?? '').trim().slice(0, 40),
      role,
      must_change_password: true,
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json(400, { error: profileError.message })
    }
    await admin.from('audit_log').insert({ organization_id: me.organization_id, user_id: me.id, action: 'staff.create', summary: `${fullName} (${role})`, entity_id: created.user.id })
    // O'qituvchi kirishi: o'qituvchi yozuviga bog'lanadi (RLS "o'z guruhlari"ni shu orqali aniqlaydi)
    const teacherId = String(body.teacherId ?? '')
    if (role === 'teacher' && teacherId) {
      await admin.from('teachers').update({ user_id: created.user.id }).eq('organization_id', me.organization_id).eq('id', teacherId)
      await admin.from('audit_log').insert({ organization_id: me.organization_id, user_id: me.id, action: 'teacher.access', summary: fullName, entity_id: teacherId })
    }
    return json(200, { id: created.user.id, password })
  }

  if (body.action === 'reset') {
    const id = String(body.id ?? '')
    const { data: target } = await admin.from('profiles').select('id, organization_id, full_name').eq('id', id).single()
    if (!target || target.organization_id !== me.organization_id) return json(404, { error: 'Xodim topilmadi' })
    const password = tempPassword()
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return json(400, { error: error.message })
    await admin.from('profiles').update({ must_change_password: true }).eq('id', id)
    // Eski parol bilan ochilgan seans JWT muddati (1 soat) tugaguncha ishlaydi; kirishda yangi parol majburiy (must_change_password)
    await admin.from('audit_log').insert({ organization_id: me.organization_id, user_id: me.id, action: 'staff.password', summary: target.full_name, entity_id: id })
    return json(200, { password })
  }

  return json(400, { error: 'Noma\'lum amal' })
})
