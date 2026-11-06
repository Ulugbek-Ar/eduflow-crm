import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useConfirm } from '../../hooks/useConfirm'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'
import { isFirstRun, readStored } from '../../services/storage.service'
import { Button } from '../ui/Button'

// Bulutli rejim: shu brauzerda avval lokal rejimda kiritilgan ma'lumotni markaz bazasiga ko'chirish
export function CloudMigration() {
  const { cloud } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  // Lokal ma'lumot bir marta o'qiladi (bulutli rejimda u o'zgarmaydi)
  const [local] = useState(() => (isFirstRun() ? null : readStored().data))
  if (!cloud || !local || local.customers.length + local.transactions.length + local.courses.length === 0) return null

  const migrate = async () => {
    const ok = await confirm({
      title: tr('Bulutga ko\'chirish'),
      message: tr('Brauzerdagi {0} mijoz, {1} tranzaksiya va {2} kurs markaz bazasiga yoziladi. Bir xil yozuvlar yangilanadi, takrorlanmaydi.', {
        0: local.customers.length,
        1: local.transactions.length,
        2: local.courses.length,
      }),
      confirmLabel: tr('Ko\'chirish'),
      tone: 'primary',
    })
    if (!ok) return
    setBusy(true)
    const result = await cloud.importLocal(local)
    setBusy(false)
    if (!result.ok) return toast.error(result.error)
    toast.success(tr('Ma\'lumot bulutga ko\'chirildi'))
    window.location.reload()
  }

  return (
    <div className="setting-row notice notice-info">
      <div>
        <strong>{tr('Brauzerda lokal ma\'lumot bor')}</strong>
        <small>
          {tr('{0} mijoz, {1} tranzaksiya, {2} kurs — bulutli bazaga ko\'chirish mumkin', {
            0: local.customers.length,
            1: local.transactions.length,
            2: local.courses.length,
          })}
        </small>
      </div>
      <Button icon="upload" onClick={migrate} disabled={busy}>
        {busy ? tr('Ko\'chirilmoqda...') : tr('Bulutga ko\'chirish')}
      </Button>
    </div>
  )
}
