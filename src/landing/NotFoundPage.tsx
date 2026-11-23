import { useEffect } from 'react'
import { tr } from '../i18n'
import { APP_NAME } from '../constants/app'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { routeHref } from '../router'

// QA-15: noma'lum manzil — landing o'rniga aniq "Sahifa topilmadi" (qidiruv tizimlari indekslamaydi)
export function NotFoundPage() {
  useEffect(() => {
    document.title = `${tr('Sahifa topilmadi')} · ${APP_NAME}`
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.append(meta)
    return () => meta.remove()
  }, [])
  return (
    <main className="login-page">
      <div className="login-card auth-form" role="alert">
        <LanguageSwitch />
        <h1>{tr('Sahifa topilmadi')}</h1>
        <p className="muted">{tr('Manzil noto\'g\'ri yoki sahifa o\'chirilgan.')}</p>
        <a className="btn btn-primary btn-block" href={routeHref('landing')}>
          {tr('Bosh sahifa')}
        </a>
        <a className="btn btn-ghost btn-block" href={routeHref('app')}>
          {tr('Kirish')}
        </a>
      </div>
    </main>
  )
}
