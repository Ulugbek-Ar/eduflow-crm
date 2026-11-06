import { useAuth } from '../../hooks/useAuth'
import { tr } from '../../i18n'
import { planOf } from '../../services/subscription.service'

// Tarif muddati tugashiga oz qolganda yoki tugaganda — barcha sahifalarda ko'rinadigan tasma
export function SubscriptionBanner() {
  const { access, subscription, can, mode } = useAuth()
  if (mode === 'demo' || !['expiring', 'expired', 'blocked'].includes(access.state)) return null
  const admin = can('staff.manage') || access.readOnly
  const plan = planOf(subscription.plan).name
  const message =
    access.state === 'blocked'
      ? tr('Markaz hisobi to\'xtatilgan.')
      : access.state === 'expired'
        ? tr('"{0}" tarifi muddati tugadi.', { 0: plan })
        : tr('"{0}" tarifi tugashiga {1} kun qoldi.', { 0: plan, 1: access.daysLeft ?? 0 })
  const hint = access.readOnly
    ? tr('Hozir faqat ko\'rish mumkin — ma\'lumotlar saqlanib turibdi.')
    : ''
  return (
    <div className={access.state === 'expiring' ? 'plan-bar is-warning' : 'plan-bar is-danger'} role="status">
      <strong>{message}</strong> {hint}{' '}
      {admin ? tr('Davom ettirish uchun sotuvchi bilan bog\'laning (Yordam → Bog\'lanish).') : tr('Administratorga xabar bering.')}
    </div>
  )
}
