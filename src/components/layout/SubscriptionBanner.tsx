import { useAuth } from '../../hooks/useAuth'
import { tr } from '../../i18n'
import { planOf } from '../../services/subscription.service'

// Tarif muddati tugashiga oz qolganda yoki tugaganda — qisqa tasma (bitta jumla). Faqat bulutli rejimda (tarif
// majburiy); lokal rejimda tarif faqat ma'lumot uchun — Sozlamalar → Tarif'da ko'rinadi, tasma chiqmaydi
export function SubscriptionBanner() {
  const { access, subscription, mode } = useAuth()
  if (mode === 'demo' || !subscription.enforced || !['expiring', 'expired', 'blocked'].includes(access.state)) return null
  const plan = planOf(subscription.plan).name
  const message =
    access.state === 'blocked'
      ? tr('Markaz to\'xtatilgan — faqat ko\'rish mumkin.')
      : access.state === 'expired'
        ? tr('"{0}" tarifi tugadi — faqat ko\'rish mumkin.', { 0: plan })
        : tr('"{0}" tarifi: {1} kun qoldi.', { 0: plan, 1: access.daysLeft ?? 0 })
  return (
    <div className={access.state === 'expiring' ? 'plan-bar is-warning' : 'plan-bar is-danger'} role="status">
      {message}
    </div>
  )
}
