import { StrictMode } from 'react'
import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './i18n'
import { currentRoute } from './router'
import { loadWithRetry } from './utils/lazyRetry'
import { initStorageNamespace } from './services/storage.service'

// Tab demo rejimda ochilgan bo'lsa (sessionStorage), demo ma'lumot bilan davom etadi
initStorageNamespace()

// Har sahifa o'z bo'lagida: landing panel kodini yuklamaydi va aksincha
async function loadPage(): Promise<ComponentType> {
  return loadWithRetry(pageModule)
}

async function pageModule(): Promise<ComponentType> {
  switch (currentRoute()) {
    case 'app':
      return (await import('./App.tsx')).default
    case 'owner':
      return (await import('./owner/OwnerConsole.tsx')).OwnerConsole
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
  .catch(() => {
    // Sahifa kodi yuklanmadi (internet yo'q): oddiy HTML xabar — React'siz
    const root = document.getElementById('root')
    if (!root) return
    root.innerHTML = `<main class="login-page"><div class="login-card auth-form" role="alert"><h1>Sahifa yuklanmadi</h1>
      <p class="muted">Internet aloqasini tekshiring. / Проверьте подключение к интернету.</p>
      <button type="button" class="btn btn-primary btn-block" id="boot-retry">Qayta urinish / Повторить</button></div></main>`
    document.getElementById('boot-retry')?.addEventListener('click', () => window.location.reload())
  })
