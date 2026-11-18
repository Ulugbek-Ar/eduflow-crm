import { useContext, useState } from 'react'
import type { FormEvent } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { AuthContext } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { tr } from '../../i18n'
import type { Branch } from '../../types/branch.types'
import { formatPhone } from '../../utils/phone'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { Input } from '../ui/Input'

const EMPTY = { name: '', address: '', phone: '' }

// Sozlamalar → Filiallar: qo'shish, tahrirlash, arxivlash, (ishlatilmagan bo'lsa) o'chirish.
// Hisoblar butun markaz bo'yicha (Header'da tanlangan filialdan qat'i nazar)
export function BranchSettings() {
  const { branches, addBranch, updateBranch, removeBranch, exportData } = useDashboard()
  const branchLimit = useContext(AuthContext)?.access.branchLimit ?? null
  const confirm = useConfirm()
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [assign, setAssign] = useState(true)

  const data = exportData()
  const hasData = data.groups.length + data.customers.length + data.transactions.length > 0
  const activeCount = branches.filter((b) => b.status === 'active').length
  const limitReached = branchLimit !== null && activeCount >= branchLimit

  const startEdit = (branch: Branch) => {
    setEditingId(branch.id)
    setForm({ name: branch.name, address: branch.address, phone: branch.phone })
    setError('')
    document.getElementById('branch-name')?.focus()
  }

  const reset = () => {
    setEditingId(null)
    setForm(EMPTY)
    setError('')
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = form.name.trim()
    if (name.length < 2 || name.length > 60) {
      setError(tr('Filial nomini kiriting (2–60 belgi)'))
      document.getElementById('branch-name')?.focus()
      return
    }
    if (branches.some((b) => b.id !== editingId && b.name.toLowerCase() === name.toLowerCase())) {
      setError(tr('"{0}" nomli filial bor', { 0: name }))
      document.getElementById('branch-name')?.focus()
      return
    }
    const input = { name, address: form.address.trim().slice(0, 120), phone: form.phone.trim().slice(0, 20) }
    if (editingId) {
      updateBranch(editingId, input)
      reset()
      return
    }
    const created = addBranch({ ...input, status: 'active' }, { assignExisting: branches.length === 0 && hasData && assign })
    if (created) reset()
  }

  const remove = async (branch: Branch) => {
    const ok = await confirm({
      title: tr('Filialni o\'chirish'),
      message: tr('Ishlatilmagan filial butunlay o\'chiriladi. Guruhi, o\'quvchisi, to\'lovi yoki xodimi bo\'lsa — o\'chirish o\'rniga arxivlanadi (ma\'lumot saqlanadi).'),
      confirmLabel: tr('O\'chirish'),
    })
    if (ok) removeBranch(branch.id)
  }

  return (
    <div className="stack">
      {branchLimit !== null && (
        <p className="notice notice-info">{tr('Tarifingizda {0} ta filial. Bir nechta filial — Pro tarifida.', { 0: branchLimit })}</p>
      )}

      {branches.length === 0 ? (
        <p className="muted">
          {tr('Hozircha filial yo\'q — markaz bitta manzilda ishlaydi. Ikkinchi manzil ochilsa, filiallarni qo\'shing: guruh, o\'quvchi va to\'lovlar filial bo\'yicha yuritiladi, xodimni bitta filialga cheklash mumkin.')}
        </p>
      ) : (
        <ul className="branch-list">
          {branches.map((branch) => {
            const groups = data.groups.filter((g) => g.branchId === branch.id && g.status === 'active').length
            const students = data.customers.filter((c) => c.branchId === branch.id).length
            return (
              <li key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>{' '}
                  <Badge tone={branch.status === 'active' ? 'paid' : 'neutral'}>{branch.status === 'active' ? tr('Faol') : tr('Arxivda')}</Badge>
                  <small className="muted cell-block">{[branch.address, branch.phone].filter(Boolean).join(' · ') || tr('Manzil ko\'rsatilmagan')}</small>
                  <small className="muted cell-block">{tr('{0} ta faol guruh · {1} ta mijoz', { 0: groups, 1: students })}</small>
                </div>
                <div className="branch-actions">
                  <IconButton icon="edit" label={tr('{0}: tahrirlash', { 0: branch.name })} onClick={() => startEdit(branch)} />
                  {branch.status === 'active' ? (
                    <IconButton icon="archive" label={tr('{0}: arxivlash', { 0: branch.name })} onClick={() => updateBranch(branch.id, { status: 'archived' })} />
                  ) : (
                    <IconButton icon="refresh" label={tr('{0}: arxivdan qaytarish', { 0: branch.name })} onClick={() => updateBranch(branch.id, { status: 'active' })} />
                  )}
                  <IconButton icon="trash" label={tr('{0}: o\'chirish', { 0: branch.name })} onClick={() => void remove(branch)} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form className="form integration" onSubmit={submit} noValidate aria-label={editingId ? tr('Filialni tahrirlash') : tr('Yangi filial')}>
        <h3>{editingId ? tr('Filialni tahrirlash') : tr('Yangi filial')}</h3>
        <div className="form-row">
          <Input
            id="branch-name"
            label={tr('Filial nomi')}
            required
            maxLength={60}
            value={form.name}
            error={error}
            placeholder={tr('Masalan: Chilonzor filiali')}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              setError('')
            }}
          />
          <Input label={tr('Telefon')} inputMode="tel" value={form.phone} placeholder="+998 71 200 00 00" onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
        </div>
        <Input label={tr('Manzil')} maxLength={120} value={form.address} placeholder={tr('Masalan: Toshkent, Chilonzor 9-kvartal')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        {!editingId && branches.length === 0 && hasData && (
          <label className="check-field">
            <input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} />
            <span>
              {tr('Mavjud guruhlar, mijozlar va to\'lovlarni shu filialga biriktirish')}
              <small className="muted cell-block">{tr('Tavsiya etiladi: hozirgi ma\'lumot birinchi filialniki bo\'ladi')}</small>
            </span>
          </label>
        )}
        <div className="toolbar">
          <Button type="submit" icon={editingId ? 'check' : 'plus'} disabled={!editingId && limitReached}>
            {editingId ? tr('Saqlash') : tr('Filial qo\'shish')}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={reset}>
              {tr('Bekor qilish')}
            </Button>
          )}
        </div>
        {!editingId && limitReached && <small className="field-hint">{tr('Tarifingizdagi filiallar soni to\'lgan')}</small>}
      </form>
    </div>
  )
}
