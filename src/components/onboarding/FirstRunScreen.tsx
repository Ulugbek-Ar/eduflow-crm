import { useEffect, useState } from 'react'
import { Icon } from '../../constants/navigation'
import type { IconName } from '../../constants/navigation'
import { saveErrorMessage, startFresh } from '../../services/storage.service'
import { pageTitle } from '../../constants/app'

type Mode = 'empty' | 'demo'

const OPTIONS: Array<{ mode: Mode; icon: IconName; title: string; description: string }> = [
  {
    mode: 'empty',
    icon: 'plus',
    title: 'Bo\'sh boshlash',
    description: 'Mijozlar va to\'lovlar ro\'yxati bo\'sh bo\'ladi — o\'z ma\'lumotlaringizni kiritasiz',
  },
  {
    mode: 'demo',
    icon: 'database',
    title: 'Demo ma\'lumot bilan tanishish',
    description: 'Namunaviy mijozlar va to\'lovlar yuklanadi. Keyin bitta tugma bilan tozalash mumkin',
  },
]

// Birinchi kirishda bir marta ko'rinadi: ma'lumot avtomatik yozilmaydi, foydalanuvchi o'zi tanlaydi
export function FirstRunScreen({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = pageTitle('Boshlash')
  }, [])

  const choose = (mode: Mode) => {
    const saved = startFresh(mode)
    if (!saved.ok) {
      setError(saveErrorMessage(saved.reason))
      return
    }
    onDone()
  }

  return (
    <main className="login-page">
      <section className="login-card first-run" aria-labelledby="first-run-title">
        <div className="login-brand">
          <span className="logo-mark">
            <Icon name="logo" size={22} />
          </span>
          <div>
            <h1 id="first-run-title">Xush kelibsiz!</h1>
            <p className="muted">Qanday boshlaymiz?</p>
          </div>
        </div>

        <div className="first-run-options">
          {OPTIONS.map((option) => (
            <button key={option.mode} type="button" className="first-run-option" onClick={() => choose(option.mode)}>
              <span className="first-run-icon">
                <Icon name={option.icon} size={20} />
              </span>
              <span>
                <strong>{option.title}</strong>
                <small className="muted">{option.description}</small>
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
