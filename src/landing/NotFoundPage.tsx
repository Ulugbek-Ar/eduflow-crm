// Noma'lum manzil (QA-15): "Sahifa topilmadi" — avval bosh sahifa ochilardi va qidiruv tizimlari uni takroriy sahifa
// deb hisoblardi. Bosh sahifa va kirishga havolalar; qidiruvdan yashiriladi (noindex)
import { useEffect } from 'react'
import { APP_NAME } from '../constants/app'
import { BrandMark } from '../components/ui/BrandMark'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { tr } from '../i18n'
import { routeHref } from '../router'
import './landing.css'

export function NotFoundPage() {
  useEffect(() => {
    document.title = `${tr('Sahifa topilmadi')} · ${APP_NAME}`
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href={routeHref('landing')}>
          <span className="logo-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <strong>{APP_NAME}</strong>
        </a>
        <div className="lp-header-actions">
          <LanguageSwitch />
        </div>
      </header>
      <main className="lp-legal lp-notfound">
        <p className="muted">404</p>
        <h1>{tr('Sahifa topilmadi')}</h1>
        <p>{tr('Bunday sahifa yo\'q yoki manzil noto\'g\'ri yozilgan.')}</p>
        <p className="lp-legal-links">
          <a className="btn btn-primary" href={routeHref('landing')}>
            {tr('Bosh sahifa')}
          </a>
          <a className="btn btn-ghost" href={routeHref('app')}>
            {tr('Kirish')}
          </a>
        </p>
      </main>
    </div>
  )
}
