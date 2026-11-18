// Mustaqil hisob: kassa balansi, shu oy kirim/chiqim, faol o'quvchilar, davomat foizlari
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('/home/user/qa/logs/demo-data.json'))
const tx = d.transactions, now = new Date()
const paid = tx.filter(t => t.status === 'paid')
const inc = paid.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
const exp = paid.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
const inMonth = t => new Date(t.date) >= mStart && new Date(t.date) <= now
console.log('cash balance', inc - exp)
console.log('month income', paid.filter(t => t.type === 'income' && inMonth(t)).reduce((s, t) => s + t.amount, 0), 'month expense', paid.filter(t => t.type === 'expense' && inMonth(t)).reduce((s, t) => s + t.amount, 0), 'month tx count (all statuses)', tx.filter(inMonth).length)
console.log('statuses', Object.entries(tx.reduce((m, t) => (m[t.status] = (m[t.status] || 0) + 1, m), {})))
// Shubhali yozuvlar
console.log('negative/zero amounts', tx.filter(t => !(t.amount > 0)).length, '| future paid', paid.filter(t => new Date(t.date) > now).length, '| income course_fee w/o customer', tx.filter(t => t.type === 'income' && t.category === 'course_fee' && !t.customerId).length)
const today = now.toISOString().slice(0, 10)
const activeEnr = d.enrollments.filter(e => e.status === 'active' && e.startDate <= today && (!e.endDate || e.endDate >= today))
console.log('enrollments', d.enrollments.length, 'active now', activeEnr.length, 'distinct active students', new Set(activeEnr.map(e => e.customerId)).size)
console.log('enr statuses', Object.entries(d.enrollments.reduce((m, e) => (m[e.status] = (m[e.status] || 0) + 1, m), {})))
// Davomat yozuvi strukturasi
console.log('attendance sample', d.attendance[0], 'count', d.attendance.length)
console.log('enrollment sample', d.enrollments[0])
console.log('group sample', d.groups[0])
console.log('tx sample', tx.find(t => t.enrollmentId), tx.find(t => t.type === 'income' && !t.enrollmentId && t.customerId))
console.log('tx income w/o enrollmentId (paid, w/ customer):', paid.filter(t => t.type === 'income' && t.customerId && !t.enrollmentId).length)
