import { useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useOnline } from '../../hooks/useOnline'
import { useToast } from '../../hooks/useToast'
import { tr } from '../../i18n'

// Internet uzilsa — tasma; qaytsa — bir martalik xabar. Lokal rejimda ish to'xtamaydi
export function OfflineBanner() {
  const online = useOnline()
  const { cloud } = useAuth()
  const toast = useToast()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      toast.success(cloud ? tr('Internet qaytdi — o\'zgarishlar serverga yuborilmoqda') : tr('Internet qaytdi'))
    }
  }, [online, cloud, toast])

  if (online) return null
  return (
    <div className="plan-bar is-warning offline-bar" role="status">
      <strong>{tr('Internet yo\'q.')}</strong>{' '}
      {cloud
        ? tr('Kiritgan o\'zgarishlaringiz internet qaytgach serverga yuboriladi. Sahifani yopmang.')
        : tr('Ish davom etadi — ma\'lumotlar shu brauzerda saqlanadi.')}
    </div>
  )
}
