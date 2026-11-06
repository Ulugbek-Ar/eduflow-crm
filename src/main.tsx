import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './i18n'
import { initStorageNamespace } from './services/storage.service'

// Tab demo rejimda ochilgan bo'lsa (sessionStorage), demo ma'lumot bilan davom etadi
initStorageNamespace()

// Til lug'ati ilova modullaridan oldin yuklanadi — yorliqlar birinchi chizishdayoq to'g'ri tilda
initI18n()
  .then(() => import('./App.tsx'))
  .then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
