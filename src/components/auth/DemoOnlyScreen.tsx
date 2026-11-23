import { lazy, Suspense, useState } from 'react'
import { APP_NAME } from '../../constants/app'
import { hasSupportContacts, MAIN_SITE_URL } from '../../constants/support'
import { useAuth } from '../../hooks/useAuth'
import { tr } from '../../i18n'
import { routeHref } from '../../router'
import { Button } from '../ui/Button'
import { AuthBrand } from './LoginScreen'

const ApplyModal = lazy(() => import('../../landing/ApplyModal').then((m) => ({ default: m.ApplyModal })))

// Namoyish sayti (GitHub Pages, VITE_DEMO_ONLY=1): ro'yxatdan o'tish va haqiqiy ma'lumot yo'q — faqat demo markaz.
// Berk ko'cha yo'q: asosiy sayt berilgan bo'lsa — o'sha yerda ro'yxatdan o'tish, bo'lmasa — sotuvchiga ariza
export function DemoOnlyScreen() {
  const { enterDemo } = useAuth()
  const [applyOpen, setApplyOpen] = useState(false)
  return (
    <main className="login-page">
      <div className="login-card auth-form">
        <AuthBrand title={APP_NAME} subtitle={tr('Namoyish sayti')} />
        <p className="muted">{tr('Bu sahifa — tanishish uchun. Namunaviy markazda barcha imkoniyatlarni sinab ko\'ring: ma\'lumotlar faqat shu brauzerda va chiqishda o\'chadi.')}</p>
        <Button icon="play" className="btn-block" onClick={() => enterDemo()}>
          {tr('Demo\'ni ko\'rish')}
        </Button>
        {MAIN_SITE_URL ? (
          <a className="btn btn-ghost btn-block" href={`${MAIN_SITE_URL}/app`}>
            {tr('O\'z markazingizni ochish')}
          </a>
        ) : (
          hasSupportContacts() && (
            <Button variant="ghost" icon="mail" className="btn-block" aria-haspopup="dialog" onClick={() => setApplyOpen(true)}>
              {tr('Ulanish uchun ariza')}
            </Button>
          )
        )}
        <a className="auth-home" href={routeHref('landing')}>
          ← {tr('Bosh sahifa')}
        </a>
      </div>
      {applyOpen && (
        <Suspense fallback={null}>
          <ApplyModal onClose={() => setApplyOpen(false)} siteUrl={`${window.location.origin}${routeHref('landing')}`} />
        </Suspense>
      )}
    </main>
  )
}
