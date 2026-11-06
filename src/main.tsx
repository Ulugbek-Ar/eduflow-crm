import { StrictMode } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './i18n'
import { currentRoute } from './router'
import { initStorageNamespace } from './services/storage.service'

// Tab demo rejimda ochilgan bo'lsa (sessionStorage), demo ma'lumot bilan davom etadi
initStorageNamespace()

// Har sahifa o'z bo'lagida: landing panel kodini yuklamaydi va aksincha
async function loadPage(): Promise<ComponentType> {
  switch (currentRoute()) {
    case 'app':
      return (await import('./App.tsx')).default
    case 'privacy':
    case 'terms':
      return (await import('./landing/LegalPage.tsx')).LegalPage
    default:
      return (await import('./landing/LandingPage.tsx')).LandingPage
  }
}

// Til lug'ati sahifa modullaridan oldin yuklanadi — yorliqlar birinchi chizishdayoq to'g'ri tilda
initI18n()
  .then(loadPage)
  .then((Page) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Page />
      </StrictMode>,
    )
  })
