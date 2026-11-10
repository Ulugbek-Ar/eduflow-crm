// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Call = { op: string; table: string; args?: unknown }
const calls: Call[] = []
const USER = { id: 'u-cloud', email: 'admin@bilim.uz', user_metadata: {} }
let signedIn = false

const tables: Record<string, Array<Record<string, unknown>>> = {
  profiles: [{ id: 'u-cloud', organization_id: 'org-1', full_name: 'Dilshod Karimov', title: 'Direktor', role: 'admin', status: 'active', must_change_password: false, created_at: '2026-10-01T00:00:00Z' }],
  organizations: [{ id: 'org-1', name: 'Bilim Bulut', plan: 'standard', status: 'active', trial_ends_at: null, paid_until: null, settings: { currency: 'UZS' } }],
  customers: [{ organization_id: 'org-1', id: 'c1', name: 'Serverdagi Mijoz', phone: '+998 90 111 22 33', course: 'IELTS', status: 'new', source: 'website', created_at: '2026-11-01T00:00:00Z' }],
  transactions: [],
  courses: [],
  audit_log: [],
}

class Query {
  private filters: Array<[string, unknown]> = []
  private single = false
  private window: [number, number] | null = null
  private table: string
  constructor(table: string) {
    this.table = table
  }
  select() { return this }
  order() { return this }
  limit() { return this }
  range(from: number, to: number) { this.window = [from, to]; return this }
  in() { return this }
  eq(col: string, value: unknown) { this.filters.push([col, value]); return this }
  maybeSingle() { this.single = true; return this }
  single_() { return this }
  upsert(rows: unknown) { calls.push({ op: 'upsert', table: this.table, args: rows }); return this }
  update(values: unknown) { calls.push({ op: 'update', table: this.table, args: values }); return this }
  delete() { calls.push({ op: 'delete', table: this.table }); return this }
  then(ok?: (v: { data: unknown; error: null }) => unknown, bad?: (e: unknown) => unknown) {
    const matched = (tables[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v))
    const rows = this.window ? matched.slice(this.window[0], this.window[1] + 1) : matched
    return Promise.resolve({ data: this.single ? (rows[0] ?? null) : rows, error: null as null, count: matched.length }).then(ok, bad)
  }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => new Query(table),
    rpc: (name: string, args: unknown) => {
      calls.push({ op: 'rpc', table: name, args })
      return Promise.resolve({ data: name === 'org_writable' ? true : null, error: null })
    },
    functions: { invoke: vi.fn() },
    auth: {
      signInWithPassword: async ({ password }: { password: string }) => {
        if (password !== 'BulutParol2026') return { error: { message: 'Invalid login credentials', status: 400 } }
        signedIn = true
        return { error: null }
      },
      getUser: async () => ({ data: { user: signedIn ? USER : null } }),
      getSession: async () => ({ data: { session: signedIn ? { user: USER } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: async () => {
        signedIn = false
        return { error: null }
      },
    },
  }),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.unstubAllEnvs()
})

describe('Bulutli rejim (Supabase sozlangan)', () => {
  it('email bilan kirish, ma\'lumot serverdan, yangi mijoz serverga yuboriladi', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'a'.repeat(60))
    vi.resetModules()
    const { default: App } = await import('../App')
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('button', { name: /Ro'yxatdan o'tish/ })).toBeTruthy()
    await user.type(screen.getAllByLabelText('Email')[0], 'admin@bilim.uz')
    await user.type(screen.getByLabelText(/^Parol( \*)?$/, { selector: 'input' }), 'xato-parol')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    expect(await screen.findByText(/Login yoki parol noto'g'ri/)).toBeTruthy()

    await user.type(screen.getByLabelText(/^Parol( \*)?$/, { selector: 'input' }), 'BulutParol2026')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    expect(await screen.findByText('Bilim Bulut', {}, { timeout: 4000 })).toBeTruthy()
    expect(calls.some((c) => c.op === 'rpc' && c.table === 'touch_login')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Mijozlar va lidlar' }))
    expect(await screen.findByRole('button', { name: 'Serverdagi Mijoz' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Yangi mijoz' }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi mijoz' })
    await user.type(within(dialog).getByLabelText(/Ism familiya/), 'Bulutdagi Yangi')
    await user.type(within(dialog).getByLabelText(/Telefon/), '935554433')
    await user.click(within(dialog).getByRole('button', { name: 'Qo\'shish' }))
    await screen.findByText('"Bulutdagi Yangi" mijozlar bazasiga qo\'shildi')
    await vi.waitFor(() => expect(calls.some((c) => c.op === 'upsert' && c.table === 'customers')).toBe(true))
    const upsert = calls.find((c) => c.op === 'upsert' && c.table === 'customers')
    expect(upsert?.args).toMatchObject([{ organization_id: 'org-1', name: 'Bulutdagi Yangi' }])
    // Lokal xotiraga mijozlar yozilmaydi
    expect(localStorage.getItem('apex:customers')).toBeNull()
  })
})
