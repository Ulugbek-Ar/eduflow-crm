import { APP_NAME } from '../../constants/app'
import { useAuth } from '../../hooks/useAuth'
import { tr } from '../../i18n'
import { routeHref } from '../../router'
import { Button } from '../ui/Button'
import { AuthBrand } from './LoginScreen'

// Namoyish sayti (GitHub Pages, VITE_DEMO_ONLY=1): ro'yxatdan o'tish va haqiqiy ma'lumot yo'q — faqat demo markaz
export function DemoOnlyScreen() {
  const { enterDemo } = useAuth()
  const main = import.meta.env.VITE_MAIN_SITE_URL?.trim()
  return (
    <main className="login-page">
      <div className="login-card auth-form">
        <AuthBrand title={APP_NAME} subtitle={tr('Namoyish sayti')} />
        <p className="muted">{tr('Bu sahifa — tanishish uchun. Namunaviy markazda barcha imkoniyatlarni sinab ko\'ring: ma\'lumotlar faqat shu brauzerda va chiqishda o\'chadi.')}</p>
        <Button icon="play" className="btn-block" onClick={() => enterDemo()}>
          {tr('Demo\'ni ko\'rish')}
        </Button>
        {main && (
          <a className="btn btn-ghost btn-block" href={main}>
            {tr('O\'z markazingizni ochish')}
          </a>
        )}
        <a className="auth-home" href={routeHref('landing')}>
          ← {tr('Bosh sahifa')}
        </a>
      </div>
    </main>
  )
}
