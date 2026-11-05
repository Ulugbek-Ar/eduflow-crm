import type { IconName } from '../constants/navigation'
import { useDashboard } from '../context/useDashboard'
import { useCan } from './useAuth'

export interface QuickAddAction {
  id: string
  label: string
  description: string
  icon: IconName
  run: () => void
}

// "+ Qo'shish": header (kompyuter) va pastki menyu (telefon) uchun bir xil ro'yxat — faqat ruxsat berilganlari
export function useQuickAdd(): QuickAddAction[] {
  const { openModal } = useDashboard()
  const can = useCan()
  const actions: Array<QuickAddAction & { allowed: boolean }> = [
    {
      id: 'customer',
      label: 'Yangi mijoz',
      description: 'Lid yoki o\'quvchi',
      icon: 'userPlus',
      run: () => openModal({ type: 'customer' }),
      allowed: can('customers.edit'),
    },
    {
      id: 'income',
      label: 'To\'lov qabul qilish',
      description: 'Kurs to\'lovi yoki boshqa kirim',
      icon: 'card',
      run: () => openModal({ type: 'transaction', payload: { kind: 'income' } }),
      allowed: can('payments.create'),
    },
    {
      id: 'expense',
      label: 'Xarajat yozish',
      description: 'Ijara, maosh, reklama',
      icon: 'receipt',
      run: () => openModal({ type: 'transaction', payload: { kind: 'expense' } }),
      allowed: can('payments.manage'),
    },
    {
      id: 'course',
      label: 'Yangi kurs',
      description: 'Kurs yoki xizmat, narxi bilan',
      icon: 'bookOpen',
      run: () => openModal({ type: 'course' }),
      allowed: can('courses.edit'),
    },
  ]
  return actions.filter((a) => a.allowed).map(({ allowed: _allowed, ...action }) => action)
}
