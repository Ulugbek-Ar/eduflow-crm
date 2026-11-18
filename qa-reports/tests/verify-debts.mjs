// Qarzni README qoidalariga ko'ra mustaqil hisoblash (ilova kodini import qilmasdan)
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('/home/user/qa/logs/demo-data.json'))
const S = d.settings, dueDay = Math.min(28, Math.max(1, S.paymentDueDay ?? 10)), prorate = !!S.prorateFirstMonth
const now = new Date(); const pad = n => String(n).padStart(2, '0')
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const ym = s => s.slice(0, 7)
const daysIn = p => new Date(+p.slice(0, 4), +p.slice(5, 7), 0).getDate()
const next = p => { const y = +p.slice(0, 4), m = +p.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}` }
const dd = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1
const course = id => d.courses.find(c => c.id === id)
const grp = id => d.groups.find(g => g.id === id)
const fee = e => Math.round((e.priceOverride ?? course(grp(e.groupId)?.courseId)?.monthlyPrice ?? 0) * (1 - Math.min(100, Math.max(0, e.discountPercent ?? 0)) / 100))
const endOf = e => e.endDate ?? ((e.status === 'left' || e.status === 'finished') ? (e.updatedAt ?? e.createdAt).slice(0, 10) : null)
function expectedFor(e, p) {
  const f = fee(e); if (f <= 0) return 0
  const from = `${p}-01`, to = `${p}-${pad(daysIn(p))}`, end = endOf(e)
  const a = e.startDate > from ? e.startDate : from, b = end && end < to ? end : to
  if (a > b) return 0
  let act = dd(a, b), paused = false
  const pf = e.pausedFrom ?? (e.status === 'paused' ? (e.updatedAt ?? e.createdAt).slice(0, 10) : null)
  if (pf) { const pt = e.pausedTo ?? '9999-12-31'; const of = pf > a ? pf : a, ot = pt < b ? pt : b; if (of <= ot) { paused = true; act -= dd(of, ot) } }
  if (act <= 0) return 0
  if (paused || (p === ym(e.startDate) && prorate)) return Math.round(f * act / daysIn(p))
  return f
}
const payOf = e => d.transactions.filter(t => t.type === 'income' && t.status === 'paid' && t.enrollmentId === e.id)
const res = {}
for (const e of d.enrollments) {
  const end = endOf(e); const last = [ym(today), end ? ym(end) : ym(today)].sort()[0]
  let exp = 0
  for (let p = ym(e.startDate); p <= last; p = next(p)) {
    const due = p === ym(e.startDate) ? e.startDate : `${p}-${pad(dueDay)}`
    if (today > due) exp += expectedFor(e, p)
  }
  const paid = payOf(e).reduce((s, t) => s + t.amount, 0)
  const r = (res[e.customerId] ??= { exp: 0, paid: 0 }); r.exp += exp; r.paid += paid
}
const debtors = Object.entries(res).map(([id, r]) => ({ id, name: d.customers.find(c => c.id === id)?.name, debt: Math.max(0, r.exp - r.paid) })).filter(x => x.debt > 0).sort((a, b) => b.debt - a.debt)
console.log('settings', { dueDay, prorate }, '| debtors', debtors.length, 'total', debtors.reduce((s, x) => s + x.debt, 0))
for (const x of debtors) console.log(' ', x.name.padEnd(22), x.debt)
