import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useDashboard } from '../../context/useDashboard'
import { callIntegrations, functionUrl, integrationStatus } from '../../data/integrations'
import type { IntegrationProvider, ProviderStatus } from '../../data/integrations'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CopyField } from '../ui/CopyField'
import { Input } from '../ui/Input'
import { PasswordInput } from '../ui/PasswordInput'

// Server qaytargan maydon kodi -> tushunarli matn
const FIELD_ERRORS: Record<string, string> = {
  key: tr('Kassa kaliti 10–200 belgi (Payme kabineti → Kassa → Kalitlar)'),
  testKey: tr('Test kaliti 10–200 belgi'),
  ikpu: tr('MXIK (IKPU) kodi — 17 ta raqam'),
  serviceId: tr('Service ID — raqamlar (Click kabineti)'),
  secretKey: tr('Secret key 6–200 belgi'),
}

const ERRORS: Record<string, string> = {
  forbidden: tr('Bu amal uchun ruxsatingiz yo\'q'),
  readonly: tr('Tarif muddati tugagan — markaz faqat o\'qish rejimida'),
  auth: tr('Seans tugagan — qayta kiring'),
}

const serverError = (result: { error: string; field?: string }) =>
  (result.field && FIELD_ERRORS[result.field]) || ERRORS[result.error] || tr('Server bilan bog\'lanib bo\'lmadi. "integrations" Edge Function deploy qilinganini tekshiring (DEPLOY.md).')

function ProviderBlock({ title, status, children }: { title: string; status: ProviderStatus | undefined; children: ReactNode }) {
  return (
    <section className="integration" aria-label={title}>
      <div className="integration-head">
        <h3>{title}</h3>
        <Badge tone={status?.configured ? 'paid' : 'neutral'}>{status?.configured ? tr('Ulangan') : tr('Ulanmagan')}</Badge>
      </div>
      {children}
    </section>
  )
}

// Bulutli rejim: Payme va Click. Ochiq id'lar sozlamalarda (to'lov havolasi uchun), kalitlar — serverda
export function IntegrationsSettings({ orgId }: { orgId: string }) {
  const { settings, updateSettings } = useDashboard()
  const toast = useToast()
  const confirm = useConfirm()
  const [status, setStatus] = useState<Record<string, ProviderStatus> | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState<IntegrationProvider | null>(null)
  const [error, setError] = useState<Partial<Record<IntegrationProvider, string>>>({})
  const [payme, setPayme] = useState({ merchantId: settings.paymeMerchantId, key: '', testKey: '', ikpu: '' })
  const [click, setClick] = useState({ serviceId: settings.clickServiceId, merchantId: settings.clickMerchantId, secretKey: '' })

  const apply = (next: Record<string, ProviderStatus> | null) => {
    setStatus(next ?? {})
    setLoadFailed(next === null)
  }
  const refresh = () => integrationStatus().then(apply)

  useEffect(() => {
    let alive = true
    void integrationStatus().then((next) => {
      if (!alive) return
      setStatus(next ?? {})
      setLoadFailed(next === null)
    })
    return () => {
      alive = false
    }
  }, [])

  const save = async (provider: 'payme' | 'click', secret: Record<string, unknown>, publicIds: Partial<typeof settings>) => {
    setBusy(provider)
    setError((prev) => ({ ...prev, [provider]: undefined }))
    const result = await callIntegrations({ action: 'save', provider, secret })
    setBusy(null)
    if (!result.ok) return setError((prev) => ({ ...prev, [provider]: serverError(result) }))
    updateSettings({ ...settings, ...publicIds }, { silent: true })
    toast.success(provider === 'payme' ? tr('Payme ulandi') : tr('Click ulandi'))
    if (provider === 'payme') setPayme((p) => ({ ...p, key: '', testKey: '' }))
    else setClick((c) => ({ ...c, secretKey: '' }))
    void refresh()
  }

  const remove = async (provider: 'payme' | 'click') => {
    const ok = await confirm({
      title: provider === 'payme' ? tr('Payme\'ni o\'chirish') : tr('Click\'ni o\'chirish'),
      message: tr('Kalit serverdan o\'chiriladi, eslatmalarda to\'lov havolasi chiqmaydi. Avval kelgan to\'lovlar saqlanadi.'),
      confirmLabel: tr('O\'chirish'),
    })
    if (!ok) return
    setBusy(provider)
    const result = await callIntegrations({ action: 'remove', provider })
    setBusy(null)
    if (!result.ok) return setError((prev) => ({ ...prev, [provider]: serverError(result) }))
    updateSettings(provider === 'payme' ? { ...settings, paymeMerchantId: '' } : { ...settings, clickServiceId: '', clickMerchantId: '' }, { silent: true })
    toast.success(tr('O\'chirildi'))
    void refresh()
  }

  const submitPayme = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const merchantId = payme.merchantId.trim().toLowerCase()
    if (!/^[0-9a-f]{24}$/.test(merchantId)) return setError((prev) => ({ ...prev, payme: tr('Merchant ID — 24 belgili kod (Payme kabineti → Kassa)') }))
    if (!status?.payme?.configured && !payme.key.trim()) return setError((prev) => ({ ...prev, payme: FIELD_ERRORS.key }))
    void save('payme', { key: payme.key, testKey: payme.testKey, ikpu: payme.ikpu }, { paymeMerchantId: merchantId })
  }

  const submitClick = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const serviceId = click.serviceId.trim()
    const merchantId = click.merchantId.trim()
    if (!/^\d{1,10}$/.test(serviceId) || !/^\d{1,10}$/.test(merchantId)) return setError((prev) => ({ ...prev, click: tr('Service ID va Merchant ID — raqamlar (Click kabineti)') }))
    if (!status?.click?.configured && !click.secretKey.trim()) return setError((prev) => ({ ...prev, click: FIELD_ERRORS.secretKey }))
    void save('click', { serviceId, secretKey: click.secretKey }, { clickServiceId: serviceId, clickMerchantId: merchantId })
  }

  const keyHint = (value: unknown) => (typeof value === 'string' && value ? tr('Saqlangan: {0}. Bo\'sh qoldirsangiz o\'zgarmaydi', { 0: value }) : undefined)

  return (
    <div className="stack">
      {loadFailed && <p className="notice notice-error" role="alert">{serverError({ error: 'network' })}</p>}
      <ProviderBlock title="Payme" status={status?.payme}>
        <form className="form" onSubmit={submitPayme} noValidate>
          <div className="form-row">
            <Input label={tr('Merchant ID (kassa id)')} value={payme.merchantId} maxLength={24} onChange={(e) => setPayme({ ...payme, merchantId: e.target.value })} placeholder="5e730e8e0b852a417aa49ceb" />
            <PasswordInput label={tr('Kassa kaliti')} value={payme.key} autoComplete="off" hint={keyHint(status?.payme?.key)} onChange={(e) => setPayme({ ...payme, key: e.target.value })} />
          </div>
          <div className="form-row">
            <Input label={tr('Test kaliti (ixtiyoriy)')} type="password" autoComplete="off" value={payme.testKey} hint={keyHint(status?.payme?.testKey)} onChange={(e) => setPayme({ ...payme, testKey: e.target.value })} />
            <Input label={tr('MXIK (IKPU) kodi — fiskal chek uchun (ixtiyoriy)')} inputMode="numeric" maxLength={17} value={payme.ikpu} onChange={(e) => setPayme({ ...payme, ikpu: e.target.value.replace(/\D/g, '') })} />
          </div>
          <CopyField label={tr('Endpoint manzili (Payme kabinetiga kiriting)')} value={functionUrl('payme', orgId)} />
          <p className="small-note muted">{tr('Payme kabinetida hisob maydoni: phone — "Telefon raqami". Ota-ona o\'quvchi telefoni bilan to\'laydi, to\'lov kassaga avtomatik kirim bo\'ladi.')}</p>
          {error.payme && <p className="notice notice-error" role="alert">{error.payme}</p>}
          <div className="toolbar">
            <Button type="submit" icon="check" disabled={busy !== null}>
              {status?.payme?.configured ? tr('Saqlash') : tr('Payme\'ni ulash')}
            </Button>
            {status?.payme?.configured && (
              <Button variant="ghost" icon="trash" disabled={busy !== null} onClick={() => void remove('payme')}>
                {tr('O\'chirish')}
              </Button>
            )}
          </div>
        </form>
      </ProviderBlock>

      <ProviderBlock title="Click" status={status?.click}>
        <form className="form" onSubmit={submitClick} noValidate>
          <div className="form-row">
            <Input label="Service ID" inputMode="numeric" value={click.serviceId} onChange={(e) => setClick({ ...click, serviceId: e.target.value.replace(/\D/g, '') })} />
            <Input label="Merchant ID" inputMode="numeric" value={click.merchantId} onChange={(e) => setClick({ ...click, merchantId: e.target.value.replace(/\D/g, '') })} />
          </div>
          <PasswordInput label="Secret key" value={click.secretKey} autoComplete="off" hint={keyHint(status?.click?.secretKey)} onChange={(e) => setClick({ ...click, secretKey: e.target.value })} />
          <CopyField label={tr('Prepare va Complete manzili (Click kabinetiga kiriting)')} value={functionUrl('click', orgId)} />
          {error.click && <p className="notice notice-error" role="alert">{error.click}</p>}
          <div className="toolbar">
            <Button type="submit" icon="check" disabled={busy !== null}>
              {status?.click?.configured ? tr('Saqlash') : tr('Click\'ni ulash')}
            </Button>
            {status?.click?.configured && (
              <Button variant="ghost" icon="trash" disabled={busy !== null} onClick={() => void remove('click')}>
                {tr('O\'chirish')}
              </Button>
            )}
          </div>
        </form>
      </ProviderBlock>
    </div>
  )
}
