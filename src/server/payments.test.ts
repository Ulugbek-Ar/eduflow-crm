import { describe, expect, it } from 'vitest'
import { clickSign, handleClick } from '../../supabase/functions/_shared/click'
import type { ClickConfig } from '../../supabase/functions/_shared/click'
import { md5, safeEqual } from '../../supabase/functions/_shared/hash'
import { accountPhone } from '../../supabase/functions/_shared/payments'
import type { PaymentCustomer, PaymentStore, PaymentTx } from '../../supabase/functions/_shared/payments'
import { handlePayme, PAYME_TIMEOUT_MS, paymeAuthorized } from '../../supabase/functions/_shared/payme'
import type { PaymeConfig, PaymeResponse } from '../../supabase/functions/_shared/payme'

// Xotiradagi ombor: SQL funksiyalari bilan bir xil qoidalar (takror yaratish — mavjudi, bajarish — bir marta kirim)
function memoryStore(customers: Record<string, PaymentCustomer>) {
  const txs = new Map<string, PaymentTx>()
  const incomes: Array<{ providerId: string; customerId: string; som: number; status: 'paid' | 'cancelled' }> = []
  let seq = 0
  const store: PaymentStore = {
    findCustomer: async (phone) => customers[phone] ?? null,
    get: async (id) => txs.get(id) ?? null,
    create: async (input) => {
      const known = txs.get(input.providerId)
      if (known) return known
      seq += 1
      const tx: PaymentTx = { provider: 'payme', id: `pt${seq}`, num: seq, state: 1, performTime: null, cancelTime: null, reason: null, ...input }
      txs.set(input.providerId, tx)
      return tx
    },
    perform: async (id, now) => {
      const tx = txs.get(id)
      if (!tx) throw new Error('yo\'q')
      if (tx.state === 1) {
        incomes.push({ providerId: id, customerId: tx.customerId, som: Math.round(tx.amount / 100), status: 'paid' })
        txs.set(id, { ...tx, state: 2, performTime: now })
      }
      return txs.get(id) as PaymentTx
    },
    cancel: async (id, reason, now) => {
      const tx = txs.get(id)
      if (!tx) throw new Error('yo\'q')
      if (tx.state === 2) {
        const income = incomes.find((i) => i.providerId === id)
        if (income) income.status = 'cancelled'
      }
      if (tx.state > 0) txs.set(id, { ...tx, state: tx.state === 2 ? -2 : -1, cancelTime: now, reason })
      return txs.get(id) as PaymentTx
    },
    statement: async (from, to) => [...txs.values()].filter((t) => t.createTime >= from && t.createTime <= to),
  }
  return { store, txs, incomes }
}

const CUSTOMERS = { '901234567': { id: 'c1', name: 'Aziza Karimova' } }

describe('MD5 va solishtirish', () => {
  it('RFC 1321 namunalari va UTF-8', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6')
    expect(md5('a'.repeat(1000))).toBe('cabe45dcc9ae5b66ba86600cca6b8ba8')
    expect(md5('Salom, dunyo! ʻ')).toBe('f82e710b25100385551fd3ac3f42ac95')
    expect(safeEqual('kalit', 'kalit')).toBe(true)
    expect(safeEqual('kalit', 'kalit2')).toBe(false)
  })

  it('hisob raqami: 9 xonali yoki 998 bilan', () => {
    expect(accountPhone('901234567')).toBe('901234567')
    expect(accountPhone('+998 90 123-45-67')).toBe('901234567')
    expect(accountPhone(998901234567)).toBe('901234567')
    expect(accountPhone('12345')).toBeNull()
    expect(accountPhone('012345678')).toBeNull()
    expect(accountPhone(null)).toBeNull()
  })
})

describe('Payme Merchant API', () => {
  const config: PaymeConfig = { key: 'asosiy-kalit', testKey: 'test-kalit' }
  const auth = (key: string) => `Basic ${btoa(`Paycom:${key}`)}`
  const T0 = 1_762_500_000_000
  const call = (method: string, params: Record<string, unknown>, ctx: Partial<Parameters<typeof handlePayme>[1]> & { store: PaymentStore }) =>
    handlePayme({ id: 7, method, params }, { authorization: auth('asosiy-kalit'), config, now: T0, ...ctx })
  const errorCode = (r: PaymeResponse) => ('error' in r ? r.error.code : 0)
  const result = (r: PaymeResponse) => ('result' in r ? r.result : {})

  it('kalit: Basic Paycom:<kalit> (asosiy yoki test); boshqasi — -32504', async () => {
    expect(paymeAuthorized(auth('asosiy-kalit'), config)).toBe(true)
    expect(paymeAuthorized(auth('test-kalit'), config)).toBe(true)
    expect(paymeAuthorized(auth('xato'), config)).toBe(false)
    expect(paymeAuthorized(`Basic ${btoa('Boshqa:asosiy-kalit')}`, config)).toBe(false)
    expect(paymeAuthorized('Bearer x', config)).toBe(false)
    expect(paymeAuthorized(auth('asosiy-kalit'), null)).toBe(false)
    const { store } = memoryStore(CUSTOMERS)
    const r = await call('CheckPerformTransaction', { amount: 65_000_000, account: { phone: '901234567' } }, { store, authorization: auth('xato') })
    expect(r).toMatchObject({ id: 7, error: { code: -32504 } })
    expect(await handlePayme('buzuq', { authorization: null, config, store, now: T0 })).toMatchObject({ error: { code: -32700 } })
  })

  it('CheckPerformTransaction: hisob, summa chegarasi, fiskal chek (MXIK berilsa)', async () => {
    const { store } = memoryStore(CUSTOMERS)
    expect(result(await call('CheckPerformTransaction', { amount: 65_000_000, account: { phone: '901234567' } }, { store }))).toEqual({ allow: true })
    expect(await call('CheckPerformTransaction', { amount: 65_000_000, account: { phone: '931112233' } }, { store })).toMatchObject({ error: { code: -31050, data: 'phone' } })
    expect(errorCode(await call('CheckPerformTransaction', { amount: 50_000, account: { phone: '901234567' } }, { store }))).toBe(-31001)
    expect(errorCode(await call('CheckPerformTransaction', { amount: 65_000_000.5, account: { phone: '901234567' } }, { store }))).toBe(-31001)
    const fiscal = await handlePayme(
      { id: 1, method: 'CheckPerformTransaction', params: { amount: 65_000_000, account: { phone: '998901234567' } } },
      { authorization: auth('asosiy-kalit'), config: { ...config, ikpu: '10305008002000000', packageCode: '1545643' }, store, now: T0 },
    )
    expect(result(fiscal)).toMatchObject({ allow: true, detail: { receipt_type: 0, items: [{ price: 65_000_000, count: 1, code: '10305008002000000', package_code: '1545643', vat_percent: 0 }] } })
  })

  it('Create → Perform → takrorlar → Check → Cancel (bajarilgach): bitta kirim, keyin bekor', async () => {
    const { store, incomes } = memoryStore(CUSTOMERS)
    const create = await call('CreateTransaction', { id: 'pm-1', time: T0 - 1000, amount: 65_000_000, account: { phone: '901234567' } }, { store })
    expect(result(create)).toEqual({ create_time: T0 - 1000, transaction: 'pt1', state: 1 })
    // Takror — o'sha natija
    expect(result(await call('CreateTransaction', { id: 'pm-1', time: T0 - 1000, amount: 65_000_000, account: { phone: '901234567' } }, { store }))).toEqual({ create_time: T0 - 1000, transaction: 'pt1', state: 1 })
    const perform = await call('PerformTransaction', { id: 'pm-1' }, { store })
    expect(result(perform)).toEqual({ transaction: 'pt1', perform_time: T0, state: 2 })
    expect(result(await call('PerformTransaction', { id: 'pm-1' }, { store, now: T0 + 5000 }))).toEqual({ transaction: 'pt1', perform_time: T0, state: 2 })
    expect(incomes).toEqual([{ providerId: 'pm-1', customerId: 'c1', som: 650_000, status: 'paid' }])
    expect(result(await call('CheckTransaction', { id: 'pm-1' }, { store }))).toEqual({ create_time: T0 - 1000, perform_time: T0, cancel_time: 0, transaction: 'pt1', state: 2, reason: null })
    // Bajarilgan tranzaksiyani yaratib bo'lmaydi
    expect(errorCode(await call('CreateTransaction', { id: 'pm-1', time: T0, amount: 65_000_000, account: { phone: '901234567' } }, { store }))).toBe(-31008)
    const cancel = await call('CancelTransaction', { id: 'pm-1', reason: 5 }, { store, now: T0 + 9000 })
    expect(result(cancel)).toEqual({ transaction: 'pt1', cancel_time: T0 + 9000, state: -2 })
    expect(incomes[0].status).toBe('cancelled')
    // Takror bekor — o'zgarmaydi
    expect(result(await call('CancelTransaction', { id: 'pm-1', reason: 5 }, { store, now: T0 + 99_000 }))).toEqual({ transaction: 'pt1', cancel_time: T0 + 9000, state: -2 })
    expect(errorCode(await call('PerformTransaction', { id: 'pm-1' }, { store }))).toBe(-31008)
  })

  it('12 soatdan keyin bajarish — bekor (sabab 4) va -31008; topilmagan — -31003; statement va noma\'lum metod', async () => {
    const { store, incomes, txs } = memoryStore(CUSTOMERS)
    await call('CreateTransaction', { id: 'pm-2', time: T0, amount: 10_000_000, account: { phone: '901234567' } }, { store })
    expect(errorCode(await call('PerformTransaction', { id: 'pm-2' }, { store, now: T0 + PAYME_TIMEOUT_MS + 1 }))).toBe(-31008)
    expect(txs.get('pm-2')).toMatchObject({ state: -1, reason: 4 })
    expect(incomes).toEqual([])
    // Eskirgan vaqt bilan yangi tranzaksiya — yaratilmaydi
    expect(errorCode(await call('CreateTransaction', { id: 'pm-3', time: T0 - PAYME_TIMEOUT_MS - 1, amount: 10_000_000, account: { phone: '901234567' } }, { store }))).toBe(-31008)
    expect(errorCode(await call('PerformTransaction', { id: 'yoq' }, { store }))).toBe(-31003)
    expect(errorCode(await call('CheckTransaction', { id: 'yoq' }, { store }))).toBe(-31003)
    const statement = result(await call('GetStatement', { from: T0 - 1, to: T0 + 1 }, { store }))
    expect(statement).toEqual({ transactions: [expect.objectContaining({ id: 'pm-2', time: T0, amount: 10_000_000, account: { phone: '901234567' }, transaction: 'pt1', state: -1, reason: 4 })] })
    expect(errorCode(await call('Boshqa', {}, { store }))).toBe(-32601)
  })

  it('ChangePassword yangi kalitni saqlaydi; ombor xatosi — -32400', async () => {
    const { store } = memoryStore(CUSTOMERS)
    const saved: string[] = []
    expect(result(await call('ChangePassword', { password: 'yangi-kalit-123' }, { store, changeKey: async (k) => void saved.push(k) }))).toEqual({ success: true })
    expect(saved).toEqual(['yangi-kalit-123'])
    const broken: PaymentStore = { ...store, findCustomer: async () => Promise.reject(new Error('db')) }
    expect(errorCode(await call('CheckPerformTransaction', { amount: 65_000_000, account: { phone: '901234567' } }, { store: broken }))).toBe(-32400)
  })
})

describe('Click SHOP API', () => {
  const config: ClickConfig = { serviceId: '12345', secretKey: 'click-maxfiy' }
  const now = 1_762_500_000_000
  const request = (patch: Record<string, string>) => {
    const p: Record<string, string> = { click_trans_id: '9001', service_id: '12345', click_paydoc_id: '55', merchant_trans_id: '901234567', amount: '650000.00', action: '0', error: '0', error_note: 'Success', sign_time: '2026-11-08 10:00:00', ...patch }
    return { ...p, sign_string: patch.sign_string ?? clickSign(p, 'click-maxfiy') }
  }

  it('Prepare → Complete: bitta kirim; takror Complete — -4; imzo, summa va foydalanuvchi xatolari', async () => {
    const { store, incomes } = memoryStore(CUSTOMERS)
    const prepare = await handleClick(request({}), { config, store, now })
    expect(prepare).toEqual({ click_trans_id: '9001', merchant_trans_id: '901234567', merchant_prepare_id: 1, error: 0, error_note: 'Success' })
    // Takror Prepare — o'sha id
    expect((await handleClick(request({}), { config, store, now })).merchant_prepare_id).toBe(1)
    const complete = await handleClick(request({ action: '1', merchant_prepare_id: '1' }), { config, store, now })
    expect(complete).toMatchObject({ merchant_confirm_id: 1, error: 0 })
    expect(incomes).toEqual([{ providerId: '9001', customerId: 'c1', som: 650_000, status: 'paid' }])
    expect((await handleClick(request({ action: '1', merchant_prepare_id: '1' }), { config, store, now })).error).toBe(-4)

    expect((await handleClick(request({ sign_string: 'abc' }), { config, store, now })).error).toBe(-1)
    expect((await handleClick(request({ click_trans_id: '9002', amount: '10' }), { config, store, now })).error).toBe(-2)
    expect((await handleClick(request({ click_trans_id: '9003', merchant_trans_id: '931112233' }), { config, store, now })).error).toBe(-5)
    expect((await handleClick(request({ click_trans_id: '9004', action: '5' }), { config, store, now })).error).toBe(-3)
    expect((await handleClick(request({ service_id: '999' }), { config, store, now })).error).toBe(-8)
    expect((await handleClick(request({}), { config: null, store, now })).error).toBe(-8)
  })

  it('Click xato bilan Complete yuborsa — bekor (-9); boshqa prepare id — -6; summa farqi — -2', async () => {
    const { store, incomes, txs } = memoryStore(CUSTOMERS)
    await handleClick(request({ click_trans_id: '7001' }), { config, store, now })
    expect((await handleClick(request({ click_trans_id: '7001', action: '1', merchant_prepare_id: '99' }), { config, store, now })).error).toBe(-6)
    expect((await handleClick(request({ click_trans_id: '7001', action: '1', merchant_prepare_id: '1', amount: '650001' }), { config, store, now })).error).toBe(-2)
    const failed = await handleClick(request({ click_trans_id: '7001', action: '1', merchant_prepare_id: '1', error: '-5017' }), { config, store, now })
    expect(failed.error).toBe(-9)
    expect(txs.get('7001')?.state).toBe(-1)
    expect(incomes).toEqual([])
    expect((await handleClick(request({ click_trans_id: '7001' }), { config, store, now })).error).toBe(-9)
  })
})
