import { useAuth } from '../../hooks/useAuth'
import { tr } from '../../i18n'
import { routeHref } from '../../router'
import { planOf } from '../../services/subscription.service'
import { formatDateWith, formatNumber } from '../../utils/format'
import { useDashboard } from '../../context/useDashboard'
import { Badge } from '../ui/Badge'
import type { BadgeTone } from '../ui/Badge'

const STATE_TONE: Record<string, BadgeTone> = { trial: 'primary', active: 'paid', expiring: 'warning', expired: 'cancelled', blocked: 'cancelled' }

export function PlanSettings() {
  const { subscription, access, users } = useAuth()
  const { settings } = useDashboard()
  const plan = planOf(subscription.plan)
  const staff = users.filter((u) => u.status === 'active' && u.role !== 'teacher').length
  const end = subscription.plan === 'trial' ? subscription.trialEndsAt : subscription.paidUntil
  const STATE_LABELS: Record<string, string> = {
    trial: tr('Sinov davri'),
    active: tr('Faol'),
    expiring: tr('Tugayapti'),
    expired: tr('Muddati tugagan'),
    blocked: tr('To\'xtatilgan'),
  }
  return (
    <div className="plan-card">
      <dl className="detail-list">
        <div>
          <dt>{tr('Tarif')}</dt>
          <dd>
            <strong>{plan.name}</strong> <Badge tone={STATE_TONE[access.state]}>{STATE_LABELS[access.state]}</Badge>
          </dd>
        </div>
        <div>
          <dt>{tr('Narx')}</dt>
          <dd>{plan.priceMonthly ? tr('{0} so\'m / oy', { 0: formatNumber(plan.priceMonthly) }) : tr('Bepul')}</dd>
        </div>
        <div>
          <dt>{tr('Amal qiladi')}</dt>
          <dd>{end ? `${formatDateWith(end, settings.dateFormat)}${access.daysLeft !== null && access.daysLeft > 0 ? ` · ${tr('{0} kun qoldi', { 0: access.daysLeft })}` : ''}` : tr('Muddatsiz')}</dd>
        </div>
        <div>
          <dt>{tr('Xodimlar')}</dt>
          <dd>{plan.staffLimit === null ? tr('{0} ta (cheksiz)', { 0: staff }) : `${staff} / ${plan.staffLimit}`}</dd>
        </div>
      </dl>
      {!subscription.enforced && (
        <p className="muted small-note">
          {tr('Lokal rejim: tarif muddati faqat eslatma sifatida ko\'rsatiladi, ish to\'xtamaydi. Bulutli rejimda tarifni sotuvchi boshqaradi.')}
        </p>
      )}
      <a className="link-btn" href={`${routeHref('landing')}#pricing`}>
        {tr('Tariflarni solishtirish')}
      </a>
    </div>
  )
}
